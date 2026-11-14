/** Validates the single authoritative Skill catalog; maintains a read-only compatibility projection. */
import { readdirSync, readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
const catalog=JSON.parse(readFileSync(join(root,'assets/skills-catalog.json'),'utf8'));
const fail=(m)=>{throw Error(`Skill catalog: ${m}`);};
if(catalog.schemaVersion!==1||!Array.isArray(catalog.skills)||catalog.skills.length<15)fail('schemaVersion/skills invalid');
const seen=new Set(),dirs=new Set();
for(const spec of catalog.skills){
  const {id,dir,description,category,tier,signals}=spec;
  if(typeof id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||id.length>64||seen.has(id))fail(`invalid/duplicate id ${id}`);
  seen.add(id);
  if(!/^skills\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/.test(dir)||dir.includes('..')||dirs.has(dir))fail(`invalid/duplicate dir ${dir}`);
  dirs.add(dir);
  if(typeof description!=='string'||!description.trim()||description.length>240)fail(`description invalid ${id}`);
  if(!['language','framework','platform','database','toolchain','infrastructure','methodology'].includes(category)||!['existing','required','recommended'].includes(tier))fail(`category/tier invalid ${id}`);
  if(!signals||!['extensions','markers','keywords','dependencies'].every(k=>Array.isArray(signals[k])&&signals[k].every(x=>typeof x==='string'&&x.length>0&&x.length<=128)))fail(`signals invalid ${id}`);
  const path=join(root,dir,'SKILL.md');
  if(!existsSync(path)||!lstatSync(path).isFile())fail(`missing SKILL.md ${dir}`);
  const md=readFileSync(path,'utf8');
  if(!md.startsWith('---\n')||!/\n---\n/.test(md)||new RegExp(`^name:\\s*${id}$`,'m').test(md)===false||!/^description:\s*\S/m.test(md))fail(`frontmatter mismatch ${dir}`);
}
const found=[];
function walk(p,depth){if(depth>6)return;for(const e of readdirSync(p,{withFileTypes:true})){
  if(e.isSymbolicLink())fail(`symlink in package skills ${e.name}`);
  const f=join(p,e.name);
  if(e.isDirectory())walk(f,depth+1);
  else if(e.name==='SKILL.md')found.push(relative(root,dirname(f)).replace(/\\/g,'/'));
}}
walk(join(root,'skills'),0);
for(const f of found)if(!dirs.has(f))fail(`orphan SKILL ${f}`);
const languages={"$schema":"internal:languages", "generatedFrom":"assets/skills-catalog.json", languages:catalog.skills.filter(x=>x.category==='language').map(x=>({
  id:x.id.replace(/^lang-/,''),display:x.display??x.id.replace(/^lang-/,''),
  ...(x.baseline?{baseline:x.baseline}:{}),
  ...(x.mechanicalKeys?{mechanicalKeys:x.mechanicalKeys}:{}),
  tools:x.tools??[],skillId:x.id
}))};
const target=join(root,'assets/languages.json');
const wanted=JSON.stringify(languages,null,2)+'\n';
if(check){
  if(!existsSync(target)||readFileSync(target,'utf8')!==wanted)fail('languages.json stale; run npm run skill-sync');
  console.log(`skills-sync --check OK: ${catalog.skills.length} skills, ${languages.languages.length} languages, no orphan`);
}else{
  writeFileSync(target,wanted);
  console.log(`skills-sync OK: ${catalog.skills.length} skills, ${languages.languages.length} languages`);
}
