/** Regression tests for the refactor's evidence and Flash context decisions.
 * Uses disposable projects; never mutates this package's design authority.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectProjectEvidence, readJsonlStrict, scanDesignTree, EvidenceError } from '../src/lib/evidence.mjs';
import { gates } from '../src/lib/gates.ts';
import { COMMANDS } from '../src/lib/registry.ts';
import { isFlash, contextBudget, composeContext, asData } from '../src/lib/model-policy.ts';
const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const commands = COMMANDS.map(x=>x.name);
function put(root, name, body) {
  const path = join(root,name); mkdirSync(dirname(path), {recursive:true});
  writeFileSync(path, body); return path;
}
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'ddd-refactor-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  put(root,'docs/REQUIREMENTS.md','---\nstatus: frozen\n---\n# requirements\n## 裁决记录\n| 编号 | 状态 |\n|---|---|\n| R-01 | 已决 |\n');
  put(root,'docs/ARCHITECTURE.md', '# architecture\n## 技术栈\nTypeScript and nodejs project runtime\n## 核心依赖\nDependencies from npm package\n## 目录结构\nProject source and documentation trees\n## 环境探查\nLinux and Windows are tested\n');
  put(root,'docs/ddd/src/lib/DESIGN-widget.md','---\nlevel: file\ntarget: src/lib/widget.ts\nstatus: frozen\nlanded: true\n---\n# Widget\n## 定位与边界\nThis is source code\n');
  put(root,'docs/ddd/src/lib/UNIT-TESTS-widget.md','---\ntarget: src/lib/widget.ts\n---\n# Tests\n| UT-widget-001 | test |\n');
  put(root,'src/lib/widget.ts','export const widget = { enabled: true, id: 1 };\n');
  put(root,'docs/board/board.jsonl','');
  put(root,'docs/temp.jsonl','');
  put(root,'docs/defects.jsonl','');
  put(root,'package.json',JSON.stringify({name:'@example/demo',version:'1.2.3'}));
  put(root,'docs/CHANGELOG.jsonl',JSON.stringify({version:'v1.2.3'})+'\n');
  put(root,'opencode.json',JSON.stringify({plugin:['@example/demo@1.2.3']}));
  return root;
}
const evidence=(root)=>collectProjectEvidence(root,{commandNames:commands,packageRoot:pkg});
const readings=(root)=>{const {state}=evidence(root);return [gates.G1(state),gates.G2(state),gates.G3(state),gates.G4(state),gates.G5(state),gates.G6(state)];};
test('All G1-G6 receive live evidence; release ready on a complete fixture', t=> {
  const root=fixture(t); const result=evidence(root);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(readings(root).map(x=>x.verdict),Array(6).fill('pass'));
});
test('CLI release success uses the same gate decisions', t=>{
  const root=fixture(t);
  const p=spawnSync('node',['--experimental-strip-types',join(pkg,'scripts/validate.mjs'),'--root',root,'--release','--check'],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr+'\n'+p.stdout);
  assert.match(p.stdout,/readyForRelease=true/);
});
test('Unfrozen requirement blocks G1 without touching the report',t=>{
  const root=fixture(t);put(root,'docs/REQUIREMENTS.md','---\nstatus: draft\n---\n## 裁决记录\n| A | 未决 |\n');
  assert.equal(readings(root)[0].verdict,'block');
});
test('Missing ruling section is not interpreted as zero unresolved rulings',t=>{
  const root=fixture(t);put(root,'docs/REQUIREMENTS.md','---\nstatus: frozen\n---\n# Nothing\n');
  assert.notEqual(readings(root)[0].verdict,'pass'); assert.ok(evidence(root).errors.some(x=>x.includes('G1')));
});
test('Architecture headings without content do not pass G2',t=>{
  const root=fixture(t);put(root,'docs/ARCHITECTURE.md','## 技术栈\nTODO\n## 核心依赖\n## 目录结构\n## 环境探查\n');
  assert.equal(readings(root)[1].verdict,'block');
});
test('Missing landed source blocks G3 and G5',t=>{
  const root=fixture(t);put(root,'docs/ddd/src/lib/DESIGN-widget.md','---\nlevel: file\ntarget: src/lib/missing.ts\nstatus: frozen\nlanded: true\n---\n');
  assert.equal(readings(root)[2].verdict,'block');assert.equal(readings(root)[4].verdict,'block');
});
test('A declared but not yet landed file never passes G5',t=>{
  const root=fixture(t);put(root,'docs/ddd/src/lib/DESIGN-widget.md','---\nlevel: file\ntarget: src/lib/widget.ts\nstatus: frozen\nlanded: false\n---\n');
  assert.equal(readings(root)[4].verdict,'block');
});
test('Missing unit test coverage blocks G4',t=>{
  const root=fixture(t);put(root,'docs/ddd/src/lib/DESIGN-other.md','---\nlevel: file\ntarget: src/lib/other.ts\nstatus: draft\nlanded: false\n---\n');
  assert.equal(readings(root)[3].verdict,'block');
});
test('Out-of-root and symlink targets cannot count as valid landing',t=>{
  const root=fixture(t);
  put(root,'docs/ddd/src/lib/DESIGN-widget.md','---\nlevel: file\ntarget: src/lib/../../../escape.ts\nstatus: frozen\nlanded: true\n---\n');
  assert.equal(readings(root)[2].verdict,'block');
  put(root,'docs/ddd/src/lib/DESIGN-widget.md','---\nlevel: file\ntarget: src/lib/widget.ts\nstatus: frozen\nlanded: true\n---\n');
  const outside=join(mkdtempSync(join(tmpdir(),'ddd-outside-')),'unsafe.ts');
  t.after(()=>rmSync(dirname(outside),{recursive:true,force:true}));
  writeFileSync(outside,'export const secret = true;\n');
  rmSync(join(root,'src/lib/widget.ts'));
  symlinkSync(outside,join(root,'src/lib/widget.ts'));
  assert.equal(readings(root)[2].verdict,'block');
  assert.equal(readings(root)[4].verdict,'block');
});
test('JSONL parser fails closed and identifies the broken line',t=>{
  const root=fixture(t);
  const path=put(root,'docs/board/board.jsonl','{"kind":"task","taskId":"T1"}\n{broken\n');
  assert.throws(()=>readJsonlStrict(path), /:2 JSONL 损坏/);
  assert.equal(readings(root)[5].verdict,'block');
  assert.ok(evidence(root).errors.length);
});
test('JSONL parser differentiates missing file and optional empty file',t=>{
  const root=fixture(t);
  assert.deepEqual(readJsonlStrict(join(root,'missing.jsonl')),[]);
  assert.throws(()=>readJsonlStrict(join(root,'missing.jsonl'),{optional:false}),EvidenceError);
});
test('Blocked dependent tasks remain active for G6 even if hidden from the UI projection',t=>{
  const root=fixture(t);
  put(root,'docs/board/board.jsonl',JSON.stringify({kind:'task',taskId:'T-01',seq:1,priority:'P1',title:'blocked task',acceptance:'tested',dependsOn:['T-00'],status:'blocked'})+'\n');
  assert.equal(evidence(root).state.wrapup.boardActive,1);assert.equal(readings(root)[5].verdict,'block');
});
test('A bad defects register stops G6',t=>{
  const root=fixture(t);
  put(root,'docs/defects.jsonl','{garbage}\n');
  assert.equal(readings(root)[5].verdict,'block');
  assert.equal(evidence(root).state.wrapup.defectsRegister,false);
});
test('Release version pin must match declared version',t=>{
  const root=fixture(t);put(root,'opencode.json','{"plugin":["@example/demo@9.9.9"]}');
  assert.equal(evidence(root).state.wrapup.versionPlaces,2);
  assert.equal(readings(root)[5].verdict,'block');
});
test('Runtime command drift blocks G3',t=>{
  const root=fixture(t); const x=collectProjectEvidence(root,{commandNames:['ddd-unregistered'],packageRoot:pkg});
  assert.equal(gates.G3(x.state).verdict,'block');
});
test('DeepSeek V4.1 Flash official and legacy IDs recognized',()=>{
  for(const model of ['deepseek/deepseek-flash','deepseek/deepseek-v4.1-flash',{providerID:'deepseek',id:'v4.1-flash'},'deepseek-flash']) assert.ok(isFlash(model));
  for(const model of ['deepseek/deepseek-reasoner','openai/gpt-6','other/flash']) assert.equal(isFlash(model),false);
});
test('Flash receives smaller bounded context without editing model protocol',()=>{
  const flash=contextBudget({providerID:'deepseek',id:'deepseek-flash'});
  const def=contextBudget('openai/gpt-6');
  assert.ok(flash.maxChars<def.maxChars);
  assert.equal(contextBudget('deepseek-flash',999999).maxChars,flash.maxChars);
  const txt=composeContext({budget:flash,phase:'design',intent:'bugfix',board:'B'.repeat(2000),memory:'M'.repeat(2000),slices:[{id:'core',source:'skills/base'}],errors:['CORRUPT JSONL']});
  assert.ok(txt.length<=flash.maxChars);
  assert.ok(txt.includes('CORRUPT JSONL'));
  assert.ok(txt.includes('skills/base'));
});
test('Control characters and newlines in external data are normalized',()=>{
  assert.equal(asData('abc\u0000\nhello',100),'abc hello');
});
