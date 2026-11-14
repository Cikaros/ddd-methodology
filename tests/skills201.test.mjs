import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SKILLS, auditRegistrations } from '../src/lib/registry.ts';
import { selectSkills, inventory } from '../src/lib/skill-router.ts';
import { composeContext, contextBudget } from '../src/lib/model-policy.ts';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const materialize=join(root,'scripts/materialize.mjs');
function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'ddd-skills201-'));
  try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}
}
function write(dir,name,text='') { const f=join(dir,name);mkdirSync(resolve(f,'..'),{recursive:true});writeFileSync(f,text); }
function run(rootPath,flags=[]) {return spawnSync(process.execPath,[materialize,'skills','--root',rootPath,...flags],{encoding:'utf8'});}
const ids=()=>new Set(SKILLS.map(s=>s.id));

test('single catalog: preserves 15 previous skills and supplies exactly 6+5+3+4 agreed skills',()=>{
  assert.equal(SKILLS.length,33);
  const present=ids();
  for(const id of ['ddd-methodology','dev-tools','frontend-variant-contract','lang-java','lang-sql','lang-vue'])assert.ok(present.has(id));
  for(const id of ['lang-typescript','lang-go','lang-rust','lang-csharp','lang-kotlin','lang-php',
    'framework-react','framework-nextjs','framework-spring-boot','framework-fastapi','framework-flutter',
    'database-postgresql','database-mongodb','database-clickhouse',
    'tool-playwright','tool-vite','tool-kubernetes','tool-github-actions'])assert.ok(present.has(id),id);
  assert.equal(SKILLS.filter(s=>s.tier==='required').length,6);
  assert.equal(SKILLS.filter(s=>s.tier==='recommended').length,12);
  assert.deepEqual(auditRegistrations(),[]);
});
test('typescript + React + Vite detection from package dependencies, without loading all skills',()=>fixture(dir=>{
  write(dir,'package.json',JSON.stringify({dependencies:{react:'^19',vite:'^7',typescript:'^5'}}));
  write(dir,'tsconfig.json','{}');write(dir,'src/App.tsx','export default function App() {}');
  const got=selectSkills(dir,SKILLS,{limit:5});const found=new Set(got.matches.map(x=>x.id));
  assert.ok(found.has('lang-typescript'),JSON.stringify(got));
  assert.ok(found.has('framework-react'),JSON.stringify(got));
  assert.ok(found.has('tool-vite'),JSON.stringify(got));
  assert.ok(!found.has('lang-go'));
  assert.ok(got.matches.length<=5);
}));
test('a generic YAML file must not imply Kubernetes or GitHub Actions',()=>fixture(dir=>{
  write(dir,'config.yml','key: value');
  const found=idsOf(selectSkills(dir,SKILLS));
  assert.ok(!found.has('tool-kubernetes'));assert.ok(!found.has('tool-github-actions'));
}));
function idsOf(x){return new Set(x.matches.map(x=>x.id));}
test('Go, Rust, C#, Kotlin, PHP and Flutter can be selected from project markers',()=>{
  const fixtures=[['go.mod','module example.org/a\ngo 1.23','lang-go'],['Cargo.toml','[package]\nname="a"','lang-rust'],['src/App.cs','class App {}','lang-csharp'],['src/Main.kt','fun main() {}','lang-kotlin'],['composer.json','{"require":{"php":"^8.2"}}','lang-php'],['pubspec.yaml','name: app','framework-flutter']];
  for(const [file,body,id] of fixtures)fixture(dir=>{write(dir,file,body);assert.ok(idsOf(selectSkills(dir,SKILLS)).has(id),`${id} not found`);});
});
test('Spring Boot, ClickHouse, MongoDB and PostgreSQL select by explicit task/dependencies',()=>fixture(dir=>{
  write(dir,'pom.xml','<dependency>org.springframework.boot</dependency>');
  let found=idsOf(selectSkills(dir,SKILLS,{text:'使用 Spring Boot 开发接口'}));
  assert.ok(found.has('framework-spring-boot'));
  found=idsOf(selectSkills(dir,SKILLS,{text:'检查 ClickHouse MergeTree 数据库导入'}));
  assert.ok(found.has('database-clickhouse'));
  found=idsOf(selectSkills(dir,SKILLS,{text:'MongoDB 索引优化'}));
  assert.ok(found.has('database-mongodb'));
  found=idsOf(selectSkills(dir,SKILLS,{text:'PostgreSQL 迁移'}));
  assert.ok(found.has('database-postgresql'));
}));
test('inventory skips symlinks, secrets and dependency directories',()=>fixture(dir=>{
  const foreign=mkdtempSync(join(tmpdir(),'ddd-skills-foreign-'));
  try{
    write(dir,'.env','SECRET=1');write(dir,'node_modules/pkg/go.mod','module bad');
    write(foreign,'go.mod','module bad');symlinkSync(foreign,join(dir,'linked'),'dir');
    const got=inventory(dir);
    assert.ok(!got.paths.some(x=>x.includes('node_modules')||x.includes('.env')||x.includes('linked')));
    assert.ok(!idsOf(selectSkills(dir,SKILLS)).has('lang-go'));
  }finally{rmSync(foreign,{recursive:true,force:true});}
}));
test('materialize installs all 33 discoverable Skills with references; second run is idempotent',()=>fixture(dir=>{
  const first=run(dir); assert.equal(first.status,0,first.stderr);
  for(const id of ids())assert.ok(existsSync(join(dir,'.opencode','skills',id,'SKILL.md')),id);
  const example=join(dir,'.opencode/skills/framework-spring-boot/references/operational.md');
  assert.ok(existsSync(example));
  const second=run(dir);assert.equal(second.status,0,second.stderr);
  assert.match(second.stdout,/物化 0/);
}));
test('materialize fails on a custom existing Skill, without overwriting or writing unrelated files',()=>fixture(dir=>{
  write(dir,'.opencode/skills/tool-vite/SKILL.md','# user customized skill\n');
  const result=run(dir);assert.notEqual(result.status,0);
  assert.equal(readFileSync(join(dir,'.opencode/skills/tool-vite/SKILL.md'),'utf8'),'# user customized skill\n');
  assert.ok(!existsSync(join(dir,'.opencode/skills/lang-java/SKILL.md')),'preflight should run before writing');
}));
test('materialize rejects symlink destinations to external files',()=>fixture(dir=>{
  const external=mkdtempSync(join(tmpdir(),'ddd-skills-outside-'));
  try{
    mkdirSync(join(dir,'.opencode','skills'),{recursive:true});
    symlinkSync(external,join(dir,'.opencode','skills','lang-go'),'dir');
    const r=run(dir);assert.notEqual(r.status,0);
    assert.deepEqual(readdirSync(external),[]);
  }finally{rmSync(external,{recursive:true,force:true});}
}));
test('Flash runtime lists exact skill IDs, never full skill markdown, bounded by budget',()=>{
  const b=contextBudget('deepseek/deepseek-flash',undefined,'implement','backend');
  const out=composeContext({budget:b,phase:'implement',intent:'backend',slices:[],skills:['lang-typescript','framework-react','tool-vite'],board:'sample'});
  assert.match(out,/@lang-typescript/);assert.match(out,/@framework-react/);
  assert.ok(out.length<=b.maxChars);
  assert.ok(!out.includes('## 实施约束'));
});
test('generated languages.json contains languages, not frameworks or platform skills',()=>{
  const lang=JSON.parse(readFileSync(join(root,'assets/languages.json'),'utf8'));
  assert.equal(lang.generatedFrom,'assets/skills-catalog.json');
  assert.ok(lang.languages.some(x=>x.id==='typescript'));
  assert.ok(!lang.languages.some(x=>x.id==='vue'||x.id==='android'));
});
