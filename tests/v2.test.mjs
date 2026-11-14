/** 2.0.0 regression suite: failure paths, concurrent writes, receipts, verification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { join,dirname,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readBoardRows,boardPaths } from '../src/lib/board-store.mjs';
import { validateBoardHistory } from '../src/lib/board.ts';
import { readCheckpoint,recordDispatch,resumeHint } from '../src/lib/workflow-store.mjs';
import { saveIntentDraft } from '../src/lib/intent-store.mjs';
import { verifyExecutable,fingerprint } from '../src/lib/executable-verifier.mjs';
import { evaluateProject } from '../src/lib/gate-evaluator.ts';
import { composeContext,contextBudget,estimateTokens,isFlash } from '../src/lib/model-policy.ts';
import { Diagnostics } from '../src/lib/diagnostics.ts';
import { makeHandler } from '../src/lib/command-dispatcher.ts';
import { Ddd } from '../src/rpc.ts';
import { COMMANDS } from '../src/lib/registry.ts';
const pkg=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function fixture(t){const root=mkdtempSync(join(tmpdir(),'ddd-v2-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root;}
function put(root,name,data){const target=join(root,name);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,data);return target;}
function runBoard(root,...argv){return spawnSync('node',['--experimental-strip-types',join(pkg,'scripts/board.mjs'),...argv,'--root',root],{encoding:'utf8'});}
function runBoardAsync(root,...argv){return new Promise((done)=>{const child=spawn('node',['--experimental-strip-types',join(pkg,'scripts/board.mjs'),...argv,'--root',root],{stdio:'ignore'});child.on('exit',code=>done(code));child.on('error',()=>done(-1));});}

test('board strict replay rejects nonexistent archives, stale from-state, and duplicate tasks',()=>{
  assert.throws(()=>validateBoardHistory([{kind:'archive',taskId:'none',seq:1,ts:''}]),/只有存在/);
  const rows=[{kind:'task',taskId:'T1',title:'alpha',acceptance:'works',priority:'P1',status:'pending',seq:1,ts:''}];
  assert.throws(()=>validateBoardHistory([...rows,{...rows[0],seq:2}]),/重复创建/);
  assert.throws(()=>validateBoardHistory([...rows,{kind:'move',taskId:'T1',from:'done',to:'in_progress',seq:2,ts:''}]),/非法状态转换/);
});
test('board CLI cannot archive an unknown task or a pending task',t=>{
  const root=fixture(t);assert.equal(runBoard(root,'archive','--task','unknown').status,1);
  assert.equal(runBoard(root,'add','--title','Example','--acceptance','verified').status,0);
  assert.equal(runBoard(root,'archive','--task','BRD-0001').status,1);
  assert.equal(readBoardRows(root).length,1);
});
test('board replay --check never overwrites tampered view',t=>{
  const root=fixture(t);assert.equal(runBoard(root,'add','--title','Task','--acceptance','PASS').status,0);
  const {md}=boardPaths(root);put(root,'docs/board/BOARD.md','TAMPERED\n');
  const result=runBoard(root,'replay','--check');assert.equal(result.status,1);
  assert.equal(readFileSync(md,'utf8'),'TAMPERED\n');
  assert.equal(runBoard(root,'replay').status,0);
  assert.equal(runBoard(root,'replay','--check').status,0);
});
test('board concurrent writers preserve unique monotonic sequence and all rows',async t=>{
  const root=fixture(t);
  const results=await Promise.all(Array.from({length:7},(_,i)=>runBoardAsync(root,'add','--title',`task-${i}`,'--acceptance','must pass')));
  assert.deepEqual(results,Array(7).fill(0));
  const rows=readBoardRows(root);assert.equal(rows.length,7);
  assert.deepEqual(rows.map(x=>x.seq),[1,2,3,4,5,6,7]);
  assert.equal(new Set(rows.map(x=>x.taskId)).size,7);
});
test('board validates symlinks and corrupt history before any append',t=>{
  const root=fixture(t),outside=fixture(t);
  mkdirSync(join(root,'docs'),{recursive:true});symlinkSync(outside,join(root,'docs','board'));
  assert.equal(runBoard(root,'add','--title','bad','--acceptance','x').status,1);
  assert.equal(existsSync(join(outside,'board.jsonl')),false);
});
test('workflow receipts persist across invocations without storing raw user prompts',async t=>{
  const root=fixture(t);
  assert.equal(readCheckpoint(root,'session-A'),null);
  const a=await recordDispatch(root,'session-A','design','prepared','Sensitive request: pass-123');
  assert.equal(a.status,'prepared');
  const b=await recordDispatch(root,'session-A','design','dispatched','Sensitive request: pass-123');
  assert.equal(b.seq,2);assert.equal(b.history.length,2);
  assert.match(resumeHint(readCheckpoint(root,'session-A')),/尚无完成证明/);
  assert.ok(!JSON.stringify(b).includes('pass-123'));
  assert.equal(readCheckpoint(root,'session-B'),null);
});
test('workflow state machine rejects dispatched without prepare and corrupt snapshot',async t=>{
  const root=fixture(t);
  await assert.rejects(recordDispatch(root,'x','test','dispatched'),/未准备/);
  assert.equal(readCheckpoint(root,'x'),null);
  await recordDispatch(root,'x','test','prepared');
  await assert.rejects(recordDispatch(root,'x','design','failed'),/未准备/);
});
test('intent capture persists draft and never freezes docs/REQUIREMENTS',t=>{
  const root=fixture(t);
  const result=saveIntentDraft(root,{scenario:'incremental',who:'Dev',result:'API',accept:'',notdoing:''});
  assert.deepEqual(result,{saved:true,missing:2});
  const saved=JSON.parse(readFileSync(join(root,'.ddd/state/intent-draft.json'),'utf8'));
  assert.equal(saved.schema,1);assert.equal(saved.who,'Dev');
  assert.equal(existsSync(join(root,'docs/REQUIREMENTS.md')),false);
  assert.throws(()=>saveIntentDraft(root,{scenario:'bad',who:'',result:'',accept:'',notdoing:''}),/场景越域/);
  assert.ok(Ddd.methods.intentCapture.input.required.includes('scenario'));
});
test('executable verification is not falsely green when no tests configured',t=>{
  const root=fixture(t);put(root,'package.json',JSON.stringify({name:'fixture',version:'1.0.0'}));
  assert.equal(verifyExecutable(root).status,'unverified');
});
test('executable verification runs npm test and binds a source fingerprint',t=>{
  const root=fixture(t);put(root,'src/app.js','export const ok = true;\n');
  put(root,'package.json',JSON.stringify({name:'fixture',version:'1.0.0',scripts:{test:"node -e \"process.exit(require('fs').readFileSync('src/app.js','utf8').includes('true')?0:1)\""}}));
  const good=verifyExecutable(root);assert.equal(good.status,'passed',JSON.stringify(good));
  const old=good.fingerprint.sha256;put(root,'src/app.js','export const ok = false;\n');
  assert.notEqual(fingerprint(root).sha256,old);
  assert.equal(verifyExecutable(root).status,'failed');
});
test('executable verifier fails if test script modifies source mid-verification',t=>{
  const root=fixture(t);put(root,'src/app.js','export const a = 1;\n');
  put(root,'package.json',JSON.stringify({name:'fixture',version:'1.0.0',scripts:{test:"node -e \"require('fs').writeFileSync('src/app.js','changed')\""}}));
  const result=verifyExecutable(root);assert.equal(result.status,'failed');assert.match(result.reason,/修改了源码/);
});
test('gate evidence errors are assigned to G1 instead of unrelated G6',t=>{
  const root=fixture(t);put(root,'docs/REQUIREMENTS.md','---\nstatus: frozen\n---\n# No rulings\n');
  const result=evaluateProject(root,COMMANDS.map(x=>x.name),pkg);
  assert.equal(result.readings[0].verdict,'block');
  assert.ok(result.readings[0].unrecognized>=1);
  assert.equal(result.readings[5].verdict,'na');
});
test('DeepSeek Flash gets phase-dependent bounded context, stable cache prefix',()=>{
  assert.ok(isFlash('deepseek/deepseek-flash'));
  const simple=contextBudget('deepseek-flash',undefined,'intent');
  const complex=contextBudget('deepseek-flash',undefined,'implement');
  assert.ok(complex.maxChars>simple.maxChars);
  const data={phase:'implement',intent:'bugfix',slices:[{id:'design',source:'docs/ddd/src/DESIGN.md'}],errors:['Invalid JSONL'],board:'TASK'.repeat(3000),memory:'MEM'.repeat(3000),checkpoint:'Previous dispatch unverified'};
  const text=composeContext({...data,budget:complex});
  assert.ok(text.length<=complex.maxChars);assert.ok(estimateTokens(text)>0);
  assert.ok(text.includes('Invalid JSONL'));assert.ok(text.includes('Previous dispatch'));
  const other=composeContext({...data,phase:'test',budget:complex});
  assert.equal(text.split('\n')[0],other.split('\n')[0]);
});
test('diagnostics are bounded, redact secrets, and deduplicate emissions',()=>{
  const logs=[];const diag=new Diagnostics(2,x=>logs.push(x));
  diag.record('context',new Error('password=topsecret sk-abcdef1234567890'));
  diag.record('context',new Error('password=topsecret sk-abcdef1234567890'));
  diag.record('rpc',new Error('EPIPE'));
  assert.equal(diag.snapshot().length,2);assert.equal(logs.length,2);
  assert.ok(!logs.join('').includes('topsecret'));assert.ok(!logs.join('').includes('sk-abcdef'));
});
test('isolated prompt is never replayed if the child dispatched but receipt update fails',async t=>{
  const root=fixture(t);const prompts=[],created=[];
  const ctx={location:{directory:root},permission:{assert:async()=>{}},storage:{set:async()=>{}},session:{instructions:{entry:{put:async()=>{}}},create:async()=>({id:'child'}),switchAgent:async()=>{},prompt:async p=>{prompts.push(p);}}};
  const handler=makeHandler('ddd-review',ctx,[]);
  await handler({sessionID:'root',prompt:{text:'review me'}});
  assert.equal(prompts.length,1);assert.equal(prompts[0].sessionID,'child');
  const ck=readCheckpoint(root,'root');assert.equal(ck.status,'dispatched');
});
