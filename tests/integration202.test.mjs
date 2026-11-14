/** 2.0.2 cross-module integration regression: Skills ↔ Agents ↔ workflow ↔ RPC/TUI. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,symlinkSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {WorkflowController} from '../src/lib/workflow-controller.ts';
import {recordWorkflow,readCheckpoint} from '../src/lib/workflow-store.mjs';
import {readParentLink,linkChildSession} from '../src/lib/session-links.mjs';
import {readSessionOverview} from '../src/lib/session-overview.ts';
import {promptSkillHints,selectCurrentSkills} from '../src/lib/skill-plan.ts';
import {selectEvidence,projectEvidenceRevision} from '../src/lib/evidence-retrieval.mjs';
import {selectApplicableMemory} from '../src/lib/memory-policy.ts';
import {createContextHook} from '../src/lib/context-service.ts';
import {Diagnostics} from '../src/lib/diagnostics.ts';
import {setupRuntime} from '../src/runtime.ts';
import {Ddd} from '../src/rpc.ts';
const fixture=t=>{const root=mkdtempSync(join(tmpdir(),'ddd-202-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root;};
function put(root,file,text){const path=join(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);return path;}
const boardCfg={priorityDomain:['P0','P1','P2','P3'],defaultPriority:'P2',statusDomain:['pending','in_progress','blocked','done','dropped'],starvationWindow:8,starvationLimit:3,orphanHours:24,maxLineBytes:8192};
const memoryCfg={remindAt:2,promoteAt:5,consistency:.8,decayPerSession:1,injectTopN:5,redlines:[]};
const materialize=join(process.cwd(),'scripts/materialize.mjs');
function materializeRun(root,command='all',args=[]){return spawnSync(process.execPath,[materialize,command,'--root',root,...args],{encoding:'utf8'});}

test('child ownership survives new controller, events attribute only to its parent',async t=>{
  const root=fixture(t),ctl=new WorkflowController(root);
  await recordWorkflow(root,'parent',{phase:'review',status:'prepared',requestText:'Review API'});
  await ctl.trackChild('child','parent');
  const restarted=new WorkflowController(root);
  assert.equal(restarted.originalSession('child'),'parent');
  await restarted.onHostEvent({type:'session.execution.started',data:{sessionID:'child'}});
  await restarted.onHostEvent({type:'session.execution.succeeded',data:{sessionID:'child'}});
  assert.equal(readCheckpoint(root,'parent').status,'awaiting_verification');
  assert.equal(readCheckpoint(root,'child'),null);
});

test('child ownership cannot be reassigned and never follows a symlink',async t=>{
  const root=fixture(t),foreign=fixture(t);
  await linkChildSession(root,'child','parent');
  assert.equal(readParentLink(root,'child'),'parent');
  await assert.rejects(linkChildSession(root,'child','other'),/不同归属/);
  symlinkSync(foreign,join(root,'link'));
  const root2=join(root,'link');
  assert.throws(()=>readParentLink(root2,'child'),/符号链接/);
});

test('workspace changes invalidate Skill suggestions while task hints remain bounded',t=>{
  const root=fixture(t);
  put(root,'package.json',JSON.stringify({dependencies:{react:'19',vite:'7',typescript:'5'}}));
  put(root,'src/app.tsx','export const App=()=>null');
  const original=selectCurrentSkills(root,[]);
  assert.ok(original.includes('framework-react'));
  assert.ok(original.includes('tool-vite'));
  put(root,'package.json',JSON.stringify({dependencies:{'pg':'8'}}));
  rmSync(join(root,'src'),{recursive:true,force:true});
  const updated=selectCurrentSkills(root,[]);
  assert.ok(!updated.includes('framework-react'),updated.join(','));
  assert.ok(!updated.includes('tool-vite'));
  const hints=promptSkillHints(root,{text:'Fix MongoDB index performance'});
  assert.ok(hints.includes('database-mongodb'));
  assert.ok(selectCurrentSkills(root,hints).includes('database-mongodb'));
  assert.ok(selectCurrentSkills(root,['made-up','../../secret']).every(x=>!x.includes('secret')));
});

test('materialize all preflights agent+Skill conflicts without partial installation',t=>{
  const root=fixture(t);
  put(root,'.opencode/skills/tool-vite/SKILL.md','# user-owned\n');
  const failed=materializeRun(root);
  assert.notEqual(failed.status,0);
  assert.equal(readFileSync(join(root,'.opencode/skills/tool-vite/SKILL.md'),'utf8'),'# user-owned\n');
  assert.ok(!existsSync(join(root,'.opencode/agents/ddd-auditor.md')));
  const install=materializeRun(root,'all',['--force']);
  assert.equal(install.status,0,install.stderr);
  const rerun=materializeRun(root);
  assert.equal(rerun.status,0,rerun.stderr);
  assert.match(rerun.stdout,/agents: 物化 0/);
  assert.match(rerun.stdout,/skills: 物化 0/);
});

test('materialize agents refuses symlink target even with --force',t=>{
  const root=fixture(t),foreign=fixture(t);
  mkdirSync(join(root,'.opencode'),{recursive:true});
  symlinkSync(foreign,join(root,'.opencode/agents'),'dir');
  const result=materializeRun(root,'agents',['--force']);
  assert.notEqual(result.status,0);
  assert.ok(!existsSync(join(foreign,'ddd-auditor.md')));
});

test('overview returns one consistent read model for workflow, Skills, gates and board',async t=>{
  const root=fixture(t),ctl=new WorkflowController(root);
  put(root,'go.mod','module example.org/demo\ngo 1.23\n');
  await recordWorkflow(root,'p',{phase:'implement',status:'prepared'});
  await ctl.trackChild('c','p');
  const overview=await readSessionOverview(root,'c',ctl,async()=>['database-clickhouse'],boardCfg);
  assert.equal(overview.status,'prepared');assert.equal(overview.phase,'implement');
  assert.ok(overview.skills.includes('lang-go'));
  assert.ok(overview.skills.includes('database-clickhouse'));
  assert.equal(overview.canVerify,false);
  assert.equal(overview.board.pending,0);
  assert.ok(Array.isArray(overview.blockedGates));
  assert.deepEqual(Ddd.methods.overview.input.required,['sessionID']);
});

test('project evidence revision is phase-independent and changes when docs change',t=>{
  const root=fixture(t);
  put(root,'docs/REQUIREMENTS.md','# Requirements\ninitial\n');
  put(root,'docs/OUTLINE-DESIGN.md','# Architecture\ninitial\n');
  const a=projectEvidenceRevision(root);
  assert.match(a,/^[a-f0-9]{64}$/);
  selectEvidence(root,{phase:'intent'});selectEvidence(root,{phase:'arch'});
  assert.equal(projectEvidenceRevision(root),a);
  put(root,'docs/OUTLINE-DESIGN.md','# Architecture\nchanged\n');
  assert.notEqual(projectEvidenceRevision(root),a);
});

test('revision-bound memory is invalidated and legacy document sha remains compatible',t=>{
  const root=fixture(t);
  put(root,'docs/REQUIREMENTS.md','# Require\ncontract\n');
  const oldSha=selectEvidence(root,{phase:'intent'})[0].sha256;
  const newSha=projectEvidenceRevision(root);
  const cfg=memoryCfg;
  const items=[{id:'1',kind:'record',type:'pitfall',scope:'demo',key:'legacy',confidence:4,occurrences:5,sourceRevision:oldSha}];
  const selected=selectApplicableMemory(items,'demo',cfg,{revision:newSha,revisions:[oldSha]});
  assert.equal(selected.length,1);
  assert.equal(selectApplicableMemory(items,'demo',cfg,{revision:newSha,revisions:[]}).length,0);
});

test('context on child uses parent phase and Skills, preserves skill tool under read-only agent',async t=>{
  const root=fixture(t),ctl=new WorkflowController(root);
  put(root,'package.json',JSON.stringify({dependencies:{react:'19',typescript:'5'}}));
  put(root,'src/ui.tsx','export const View = ()=>null;');
  await recordWorkflow(root,'parent',{phase:'review',status:'prepared'});
  await ctl.trackChild('child','parent');
  const storage=new Map([['ddd:phase:parent','review'],['ddd:intent:parent','frontend'],['ddd:skill-hints:parent',['tool-playwright']]]);
  const ctx={location:{directory:root},storage:{get:async k=>storage.get(k),set:async(k,v)=>{storage.set(k,v)}},session:{instructions:{entry:{put:async()=>{}}}}};
  const hook=createContextHook(ctx,{options:{model:'deepseek/deepseek-flash'},boardCfg,memoryCfg,slices:[],roleTools:{'ddd-design-reviewer':['read','grep','glob','skill']},diagnostics:new Diagnostics(),ownerSession:s=>ctl.originalSession(s)});
  const ev={sessionID:'child',agent:'ddd-design-reviewer',system:[],model:'deepseek/deepseek-flash',tools:{read:{},skill:{},write:{}}};
  await hook(ev);
  const text=ev.system.map(p=>p.text).join('\n');
  assert.match(text,/phase=review/);
  assert.match(text,/@framework-react/);
  assert.match(text,/@tool-playwright/);
  assert.ok(ev.tools.skill);assert.equal(ev.tools.write,undefined);
});

test('broken evidence is represented in model context instead of dropping the whole context hook',async t=>{
  const root=fixture(t),outside=fixture(t);
  put(outside,'req.md','# foreign');
  mkdirSync(join(root,'docs'),{recursive:true});
  symlinkSync(join(outside,'req.md'),join(root,'docs/REQUIREMENTS.md'));
  const ctx={location:{directory:root},storage:{get:async()=>undefined,set:async()=>{}},session:{instructions:{entry:{put:async()=>{}}}}};
  const hook=createContextHook(ctx,{options:{model:'deepseek-flash'},boardCfg,memoryCfg,slices:[],roleTools:{},diagnostics:new Diagnostics()});
  const ev={sessionID:'s',system:[],model:'deepseek-flash',tools:{}};
  await hook(ev);
  assert.ok(ev.system.some(p=>/证据异常.*符号链接/.test(p.text)),JSON.stringify(ev.system));
});

test('runtime registers one overview RPC reading the live workspace and all command/skills',async t=>{
  const root=fixture(t),storage=new Map(),hooks={},cmds=[],skills=[];let handlers;
  put(root,'go.mod','module example.org/demo\ngo 1.23\n');
  const disposable={dispose:async()=>{}};
  const ctx={options:{},location:{directory:root},storage:{get:async k=>storage.get(k),set:async(k,v)=>storage.set(k,v)},
    command:{transform:async fn=>{fn({add:v=>cmds.push(v)});return disposable;}},
    skill:{transform:async fn=>{fn({add:v=>skills.push(v)});return disposable;}},
    session:{hook:async(name,fn)=>{hooks[name]=fn;return disposable;},instructions:{entry:{put:async()=>{}}}},
    tool:{hook:async()=>disposable},permission:{hook:async()=>disposable},
    rpc:{register:async(_spec,values)=>{handlers=values;return disposable;}},
  };
  const cleanup=await setupRuntime(ctx);
  assert.equal(cmds.length,15);assert.equal(skills.length,33);
  const o=await handlers.overview({sessionID:'s'});
  assert.ok(o.skills.includes('lang-go'));
  assert.equal(o.status,'missing');
  await hooks.prompt({sessionID:'s',prompt:{text:'Optimize ClickHouse ingestion',files:[]}});
  const updated=await handlers.overview({sessionID:'s'});
  assert.ok(updated.skills.includes('database-clickhouse'));
  await cleanup();
});

test('dry-run materialize checks the entire plan without making a project directory',t=>{
  const root=join(fixture(t),'new-project');
  const result=materializeRun(root,'all',['--check']);
  assert.equal(result.status,0,result.stderr);
  assert.ok(!existsSync(root));
});

test('scaffold preflight aborts before creating docs on an existing user Skill conflict',t=>{
  const root=fixture(t);
  put(root,'.opencode/skills/framework-react/SKILL.md','# user custom skill\n');
  const result=spawnSync(process.execPath,[join(process.cwd(),'scripts/scaffold.mjs'),'--root',root],{encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.equal(readFileSync(join(root,'.opencode/skills/framework-react/SKILL.md'),'utf8'),'# user custom skill\n');
  assert.ok(!existsSync(join(root,'AGENTS.md')));
  assert.ok(!existsSync(join(root,'docs/ARCHITECTURE.md')));
});

test('same-session read-only review fallback enforces role tools and recovers phase after storage loss',async t=>{
  const root=fixture(t),ctl=new WorkflowController(root);
  await recordWorkflow(root,'s',{phase:'review',status:'prepared',requestText:'review'});
  const ctx={location:{directory:root},storage:{get:async()=>undefined,set:async()=>{}},session:{instructions:{entry:{put:async()=>{}}}}};
  const hook=createContextHook(ctx,{options:{model:'deepseek/deepseek-flash'},boardCfg,memoryCfg,slices:[],roleTools:{'ddd-design-reviewer':['read','grep','glob','skill']},diagnostics:new Diagnostics(),ownerSession:s=>ctl.originalSession(s)});
  const ev={sessionID:'s',agent:'build',system:[],model:'deepseek/deepseek-flash',tools:{read:{},skill:{},write:{},shell:{}}};
  await hook(ev);
  assert.deepEqual(Object.keys(ev.tools),['read','skill']);
  assert.match(ev.system.map(x=>x.text).join('\n'),/phase=review/);
});

test('corrupt checkpoint fails closed for tools while showing evidence errors',async t=>{
  const root=fixture(t);
  await recordWorkflow(root,'s',{phase:'implement',status:'prepared'});
  const file=join(root,'.ddd/state/workflows');
  const files=(await import('node:fs')).readdirSync(file);
  writeFileSync(join(file,files[0]),'{ malformed JSON');
  const ctx={location:{directory:root},storage:{get:async()=>undefined,set:async()=>{}},session:{instructions:{entry:{put:async()=>{}}}}};
  const hook=createContextHook(ctx,{options:{},boardCfg,memoryCfg,slices:[],roleTools:{},diagnostics:new Diagnostics()});
  const ev={sessionID:'s',agent:'build',system:[],tools:{read:{},skill:{},write:{},shell:{}}};
  await hook(ev);
  assert.deepEqual(Object.keys(ev.tools),['read','skill']);
  assert.match(ev.system.map(x=>x.text).join('\n'),/检查点/);
});
