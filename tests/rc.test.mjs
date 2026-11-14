/** Release-candidate tests: observable execution, real verification, recovery, context and trace. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,symlinkSync,rmSync,utimesSync } from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {readCheckpoint,recordWorkflow,resumeHint} from '../src/lib/workflow-store.mjs';
import {WorkflowController,sessionOfEvent} from '../src/lib/workflow-controller.ts';
import {recordTrace,readTrace,exportEval} from '../src/lib/trace-store.mjs';
import {selectEvidence} from '../src/lib/evidence-retrieval.mjs';
import {selectApplicableMemory} from '../src/lib/memory-policy.ts';
import {composeContext,contextBudget} from '../src/lib/model-policy.ts';
import {buildHandoff} from '../src/lib/agent-handoff.ts';
import {detectChecks,verifyExecutable,fingerprint} from '../src/lib/executable-verifier.mjs';
import {Ddd} from '../src/rpc.ts';
import {withFileLock} from '../src/lib/file-lock.mjs';
import {readMemoryRows,foldMemoryRows,recordMemoryHit,recordSessionDecay} from '../src/lib/memory-store.mjs';
import {setupRuntime} from '../src/runtime.ts';
function temp(t){const d=mkdtempSync(join(tmpdir(),'ddd-rc-'));t.after(()=>rmSync(d,{recursive:true,force:true}));return d;}
function put(root,file,content){const path=join(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,content);return path;}
function nodeTest(root){put(root,'package.json',JSON.stringify({name:'ci',scripts:{test:'node -e "process.exit(0)"'}}));}

test('checkpoint completes only with real proof after host execution success',async t=>{
 const root=temp(t),ctl=new WorkflowController(root);nodeTest(root);
 await recordWorkflow(root,'s',{phase:'implement',status:'prepared',requestText:'task'});
 await ctl.prepared('s','implement','task');
 await ctl.onHostEvent({type:'session.execution.started',data:{sessionID:'s'}});
 assert.equal(ctl.current('s').status,'running');
 await ctl.onHostEvent({type:'session.execution.succeeded',data:{sessionID:'s'}});
 assert.equal(ctl.current('s').status,'awaiting_verification');
 const outcome=await ctl.verify('s');assert.equal(outcome.status,'verified',JSON.stringify(outcome));
 assert.equal(ctl.current('s').status,'verified');
 assert.match(ctl.current('s').proof.fingerprint,/^[a-f0-9]{64}$/);
});
test('execution success alone is not DDD verification',async t=>{
 const root=temp(t),ctl=new WorkflowController(root);
 await recordWorkflow(root,'s',{phase:'test',status:'prepared',requestText:'task'});
 await ctl.onHostEvent({type:'session.execution.succeeded',data:{sessionID:'s'}});
 assert.equal(ctl.current('s').status,'awaiting_verification');
 assert.equal((await ctl.verify('s')).status,'unverified');
 assert.equal(ctl.current('s').status,'awaiting_verification');
});
test('failed tests never generate a verified receipt',async t=>{
 const root=temp(t),ctl=new WorkflowController(root);
 put(root,'package.json',JSON.stringify({name:'ci',scripts:{test:'node -e "process.exit(5)"'}}));
 await recordWorkflow(root,'s',{phase:'test',status:'prepared'});
 await ctl.onHostEvent({type:'session.execution.succeeded',sessionID:'s'});
 const out=await ctl.verify('s');assert.equal(out.status,'failed');
 assert.equal(ctl.current('s').status,'failed');assert.equal(ctl.current('s').proof,undefined);
});
test('recovery never redispatches a command and records a superseded incomplete task',async t=>{
 const root=temp(t);
 await recordWorkflow(root,'s',{phase:'design',status:'prepared',requestText:'A'});
 await recordWorkflow(root,'s',{phase:'design',status:'dispatched'});
 await assert.rejects(recordWorkflow(root,'s',{phase:'design',status:'prepared',requestText:'A'}),/重复派发/);
 const ck=await recordWorkflow(root,'s',{phase:'test',status:'prepared',requestText:'B'});
 assert.equal(ck.history.at(-2).status,'superseded');
 assert.equal(ck.status,'prepared');assert.match(resumeHint(ck),/重复派发/);
});
test('invalid proof, stale stage and corrupt checkpoints fail closed',async t=>{
 const root=temp(t);
 await assert.rejects(recordWorkflow(root,'s',{phase:'test',status:'verified',proof:{status:'passed',fingerprint:{sha256:'0'.repeat(64)},checks:[{passed:true}]}}),/尚未/);
 await recordWorkflow(root,'s',{phase:'test',status:'prepared'});
 await assert.rejects(recordWorkflow(root,'s',{phase:'test',status:'verified',proof:{status:'passed',fingerprint:{sha256:'0'.repeat(64)},checks:[{passed:true}]}}),/非法/);
 await recordWorkflow(root,'s',{phase:'test',status:'dispatched'});
 await assert.rejects(recordWorkflow(root,'s',{phase:'test',status:'verified',proof:{status:'passed',fingerprint:{sha256:'0'.repeat(64)},checks:[{passed:true}]}}),/非法/);
});
test('child session execution events are attributed to parent without raw prompt storage',async t=>{
 const root=temp(t),ctl=new WorkflowController(root);nodeTest(root);
 await recordWorkflow(root,'root',{phase:'review',status:'prepared',requestText:'secret=never_write'});
 ctl.trackChild('child','root');
 await ctl.onHostEvent({type:'session.execution.started',data:{sessionID:'child'}});
 await ctl.onHostEvent({type:'session.execution.succeeded',data:{sessionID:'child'}});
 assert.equal(readCheckpoint(root,'root').status,'awaiting_verification');
 assert.equal(readCheckpoint(root,'child'),null);
 assert.ok(!JSON.stringify(readCheckpoint(root,'root')).includes('never_write'));
});
test('session extraction ignores event id',()=>{
 assert.equal(sessionOfEvent({id:'event-id',data:{}}),undefined);
 assert.equal(sessionOfEvent({type:'x',data:{session:{id:'session-id'}}}),'session-id');
});
test('trace records observed model / usage / tool failure only, no fake acceptance',async t=>{
 const root=temp(t),ctl=new WorkflowController(root);
 await recordWorkflow(root,'s',{phase:'test',status:'prepared'});await ctl.prepared('s','test','task-A');
 await ctl.onHostEvent({type:'session.model.selected',data:{sessionID:'s',model:{id:'deepseek-flash'}}});
 await ctl.onHostEvent({type:'session.usage.updated',data:{sessionID:'s',usage:{inputTokens:120,outputTokens:33,cacheReadTokens:100}}});
 await ctl.toolEvent('s',true);const tr=readTrace(root,'s');
 assert.equal(tr.toolCalls,1);assert.equal(tr.failedToolCalls,1);
 assert.equal(tr.inputTokens,120);assert.equal(tr.model,'deepseek-flash');
 assert.throws(()=>exportEval(tr),/指标不完整/);
 await recordTrace(root,'s',{type:'verified',accepted:false});
 assert.equal(exportEval(readTrace(root,'s')).accepted,false);
});
test('trace unknown metrics remain null and must not be exported as zero',async t=>{
 const root=temp(t);await recordTrace(root,'s',{type:'dispatch',phase:'test'});
 await recordTrace(root,'s',{type:'verified',accepted:false});
 assert.equal(readTrace(root,'s').cacheReadTokens,null);
 assert.throws(()=>exportEval(readTrace(root,'s')),/指标不完整/);
});
test('stage-aware evidence bounded, excludes private files and resists symlink',t=>{
 const root=temp(t),outside=temp(t);put(root,'docs/REQUIREMENTS.md','# Requirements\nAlways test first\n');
 put(root,'docs/OUTLINE-DESIGN.md','# Outline\nDesign contract\n');
 put(root,'.env','SECRET=123');
 const rows=selectEvidence(root,{phase:'arch',budgetTokens:70});
 assert.ok(rows.length>0);assert.ok(rows.every(x=>x.path.startsWith('docs/')));
 assert.ok(!JSON.stringify(rows).includes('SECRET'));
 rmSync(join(root,'docs/REQUIREMENTS.md'));symlinkSync(put(outside,'x','bad'),join(root,'docs/REQUIREMENTS.md'));
 assert.throws(()=>selectEvidence(root,{phase:'arch',budgetTokens:100}),/符号链接/);
});
test('context remains bounded and prefers evidence over repeated full markdown',()=>{
 const budget=contextBudget('deepseek-flash',undefined,'implement','bugfix');
 const s=composeContext({budget,phase:'implement',intent:'bugfix',slices:[],evidence:[{path:'docs/ddd/DESIGN.md',text:'proof '.repeat(150),sha256:'a'}],errors:['test failed'],checkpoint:'awaiting verification'});
 assert.ok(s.length<=budget.maxChars);assert.ok(s.includes('proof'));
 assert.ok(s.includes('test failed'));assert.ok(s.includes('验证'));
});
test('memory revision and expiration invalidate old observations; legacy marked unverified',()=>{
 const cfg={remindAt:2,promoteAt:5,consistency:.8,decayPerSession:1,injectTopN:3,redlines:[]};
 const all=[{id:'a',kind:'record',type:'pitfall',scope:'demo',key:'old',confidence:4,occurrences:3,sourceRevision:'old'},
 {id:'b',kind:'record',type:'pitfall',scope:'demo',key:'legacy',confidence:3,occurrences:3},
 {id:'c',kind:'record',type:'pitfall',scope:'demo',key:'expired',confidence:4,occurrences:3,validUntil:'2020-01-01'}];
 const got=selectApplicableMemory(all,'demo',cfg,{revision:'new',phase:'test',now:'2026-01-01'});
 assert.equal(got.length,1);assert.equal(got[0].entry.key,'legacy');assert.equal(got[0].confidence,'unverified');
});
test('handoff has evidence requirements, does not invent test success',()=>{
 const s=buildHandoff({name:'ddd-review',phase:'review',role:'ddd-design-reviewer',parentSession:'s',isolated:true,sources:['docs/ddd/DESIGN.md','docs/ddd/DESIGN.md']});
 assert.match(s,/重新读取真实源文件/);assert.match(s,/退出码/);assert.equal((s.match(/docs\/ddd\/DESIGN.md/g)??[]).length,1);
 assert.doesNotMatch(s,/已通过验收/);
});
test('non-node verifier has explicit safe fixed adapters',t=>{
 const root=temp(t);put(root,'go.mod','module example.org/demo\ngo 1.22\n');
 const p=detectChecks(root);assert.equal(p.kind,'go');assert.deepEqual(p.checks[0].args,['test','./...']);
 assert.equal(p.checks[0].command,'go');assert.match(fingerprint(root).sha256,/^[0-9a-f]{64}$/);
});
test('RPC contract exposes status, explicit test, explicit close',()=>{
 assert.ok(Ddd.methods.workflow.input.required.includes('sessionID'));
 assert.ok(Ddd.methods.workflowVerify.input.required.includes('confirmed'));
 assert.ok(Ddd.methods.workflowClose.input.required.includes('reason'));
});
test('CLI verify requires acknowledgment; status is read-only',async t=>{
 const root=temp(t);
 await recordWorkflow(root,'s',{phase:'test',status:'prepared'});
 const base=['--experimental-strip-types',join(process.cwd(),'scripts/workflow.mjs')];
 const status=spawnSync('node',[...base,'status','--root',root,'--session','s'],{encoding:'utf8'});
 assert.equal(status.status,0);assert.match(status.stdout,/prepared/);
 const denied=spawnSync('node',[...base,'verify','--root',root,'--session','s'],{encoding:'utf8'});
 assert.equal(denied.status,1);assert.match(denied.stderr,/ack-run-tests/);
 assert.equal(readCheckpoint(root,'s').status,'prepared');
});

test('shared lock recovers only stale dead owner and rejects symlink locks',async t=>{
 const root=temp(t),file=join(root,'state.lock');writeFileSync(file,'99999999');utimesSync(file,new Date(0),new Date(0));
 let called=0;await withFileLock(file,async()=>{called++;});assert.equal(called,1);
 assert.equal(existsSync(file),false);
 const outside=temp(t);symlinkSync(join(outside,'x'),file);
 await assert.rejects(withFileLock(file,async()=>{}),/符号链接/);
});
test('shared lock serializes simultaneous writers',async t=>{
 const root=temp(t),file=join(root,'state.lock'),events=[];
 await Promise.all(Array.from({length:8},(_,i)=>withFileLock(file,async()=>{events.push('begin'+i);await new Promise(r=>setTimeout(r,5));events.push('end'+i);}))); 
 for(let i=0;i<events.length;i+=2){assert.match(events[i],/^begin/);assert.match(events[i+1],/^end/);assert.equal(events[i].slice(5),events[i+1].slice(3));}
});

test('memory event writer is idempotent per session and supports real decay',async t=>{
 const root=temp(t),file=put(root,'docs/memory/memory.jsonl',JSON.stringify({id:'MEM-1',ts:'2026-01-01T00:00:00Z',kind:'record',type:'pitfall',scope:'p',key:'go',trigger:'tool:bash',occurrences:1,confidence:2})+'\n');
 const cfg={remindAt:2,promoteAt:5,consistency:.8,decayPerSession:1,injectTopN:5,redlines:[]};
 const entry=foldMemoryRows(readMemoryRows(root))[0];
 assert.equal((await recordMemoryHit(root,entry,'s',cfg)).written,1);
 assert.equal((await recordMemoryHit(root,entry,'s',cfg)).written,0);
 assert.equal((await recordSessionDecay(root,'s',cfg)).written,1); // session marker, hit is not decayed
 assert.equal((await recordSessionDecay(root,'s',cfg)).written,0);
 assert.equal(foldMemoryRows(readMemoryRows(root))[0].occurrences,2);
 const result=await recordSessionDecay(root,'another',cfg);
 assert.ok(result.written>=2);
 assert.equal(foldMemoryRows(readMemoryRows(root))[0].confidence,1);
 assert.ok(readFileSync(file,'utf8').includes('"kind":"decay"'));
});
test('memory state merges later partial archive events and rejects corrupt history',async t=>{
 const root=temp(t),cfg={remindAt:2,promoteAt:5,consistency:.8,decayPerSession:1,injectTopN:5,redlines:[]};
 const file=put(root,'docs/memory/memory.jsonl',JSON.stringify({id:'M',kind:'record',type:'pitfall',scope:'s',key:'k',confidence:5,occurrences:6})+'\n'+JSON.stringify({id:'M',kind:'archive',archived:true,confidence:1})+'\n');
 assert.equal(foldMemoryRows(readMemoryRows(root))[0].archived,true);
 assert.equal((await recordMemoryHit(root,foldMemoryRows(readMemoryRows(root))[0],'s',cfg)).written,0);
 const before=readFileSync(file,'utf8');put(root,'docs/memory/memory.jsonl',before+'broken\n');
 await assert.rejects(recordSessionDecay(root,'s',cfg),/JSON|解析|无效/);
 assert.equal(readFileSync(file,'utf8'),before+'broken\n');
});
test('workflow trace carries bounded tool summaries without raw arguments',async t=>{
 const root=temp(t);await recordTrace(root,'s',{type:'dispatch',phase:'implement'});
 for(let n=0;n<20;n++)await recordTrace(root,'s',{type:'tool',toolName:'bash',toolID:'id-'+n,failed:n%2===0});
 const trace=readTrace(root,'s');assert.equal(trace.toolCalls,20);assert.equal(trace.failedToolCalls,10);
 assert.equal(trace.recentTools.length,12);assert.ok(!JSON.stringify(trace).includes('raw-prompt'));
});
test('minimal context decreases only low risk while keeping bugfix budget',()=>{
 const standard=contextBudget('deepseek-flash',undefined,'intent','docs','standard');
 const minimal=contextBudget('deepseek-flash',undefined,'intent','docs','minimal');
 assert.ok(minimal.maxChars<standard.maxChars);
 const risky=contextBudget('deepseek-flash',undefined,'implement','bugfix','minimal');
 const same=contextBudget('deepseek-flash',undefined,'implement','bugfix','standard');
 assert.equal(risky.maxChars,same.maxChars);
});
