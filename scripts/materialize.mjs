/** Materialize bundled OpenCode agents, commands and Skills.
 * One preflight and one write plan across all selected categories prevents a Skill
 * conflict from leaving a half-installed set of agents. Existing user data is
 * preserved unless --force is explicitly supplied.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, lstatSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function fail(message, code=1) { console.error(`失败：${message}`); process.exit(code); }
function args(argv) {
  const parsed={ positional:[], root:process.cwd(), force:false, check:false };
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--force') parsed.force=true;
    else if(argv[i]==='--check') parsed.check=true;
    else if(argv[i]==='--root' && typeof argv[i+1]==='string' && !argv[i+1].startsWith('--')) parsed.root=resolve(argv[++i]);
    else if(argv[i].startsWith('--')) fail(`未知或缺失选项：${argv[i]}`,2);
    else parsed.positional.push(argv[i]);
  }
  return parsed;
}
const options=args(process.argv.slice(2));
const sub=options.positional[0],root=options.root,force=options.force,check=options.check;
if(options.positional.length!==1 || !['agents','commands','skills','all'].includes(sub))fail('用法：materialize.mjs <agents|commands|skills|all> [--root dir] [--force] [--check]',2);
function st(path) {
  try{return lstatSync(path);}catch(error){if(error?.code==='ENOENT')return null;throw error;}
}
function ensureSafe(path) {
  const relativePath=relative(root,path);
  if(isAbsolute(relativePath)||relativePath==='..'||relativePath.startsWith('..'+sep))fail(`目标路径越界：${path}`);
  let cursor=root;
  if(st(cursor)?.isSymbolicLink())fail('项目根目录是符号链接');
  for(const segment of relativePath.split(sep).filter(Boolean)){
    if(st(cursor)?.isSymbolicLink())fail(`目标路径含符号链接：${cursor}`);
    cursor=join(cursor,segment);
  }
  if(st(cursor)?.isSymbolicLink())fail(`目标路径为符号链接：${cursor}`);
}
const counts=new Map(),plan=[],destinations=new Set();
function add(kind,source,destination){
  const from=st(source);
  if(!from?.isFile()||from.isSymbolicLink())fail(`不安全或缺失的技能源：${source}`);
  if(from.size>512*1024)fail(`源文件过大：${source}`);
  ensureSafe(destination);
  if(destinations.has(destination))fail(`重复目标：${destination}`);
  destinations.add(destination);
  const target=st(destination);
  if(target&&!target.isFile())fail(`目标不是普通文件：${destination}`);
  const content=readFileSync(source,'utf8');
  const same=target?readFileSync(destination,'utf8')===content:false;
  if(target&&!same&&!force)fail(`已存在不同内容（未覆盖）：${relative(root,destination)}；需显式 --force`);
  plan.push({kind,destination,content,same});
}
function flat(kind){
  const source=join(packageRoot,kind);
  const stat=st(source);
  if(!stat && kind==='commands'){counts.set(kind,'missing');return;}
  if(!stat?.isDirectory()||stat.isSymbolicLink())fail(`缺少随包目录：${kind}`);
  for(const e of readdirSync(source,{withFileTypes:true})){
    if(e.isSymbolicLink())fail(`源目录含符号链接：${kind}/${e.name}`);
    if(e.isFile()&&e.name.endsWith('.md'))add(kind,join(source,e.name),join(root,'.opencode',kind,e.name));
  }
}
function skills(){
  const file=join(packageRoot,'assets/skills-catalog.json'),payload=JSON.parse(readFileSync(file,'utf8'));
  if(payload.schemaVersion!==1||!Array.isArray(payload.skills)||payload.skills.length===0)fail('技能目录无效');
  const ids=new Set();
  for(const skill of payload.skills){
    if(typeof skill.id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.id)||ids.has(skill.id)||
      typeof skill.dir!=='string'||!/^skills\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/.test(skill.dir)) fail('技能目录记录无效');
    ids.add(skill.id);
    const source=join(packageRoot,skill.dir),ss=st(source);
    if(!ss?.isDirectory()||ss.isSymbolicLink())fail(`技能目录缺失：${skill.dir}`);
    const visit=(base,parts=[])=>{
      for(const entry of readdirSync(base,{withFileTypes:true})){
        if(!/^[\w.-]+$/.test(entry.name)||entry.isSymbolicLink())fail(`技能源非法：${skill.id}/${entry.name}`);
        const src=join(base,entry.name);
        if(entry.isDirectory()){
          if(parts.length>=5)fail(`技能嵌套过深：${skill.id}`);
          visit(src,[...parts,entry.name]);
        }else if(entry.isFile()&&entry.name.endsWith('.md')){
          add('skills',src,join(root,'.opencode','skills',skill.id,...parts,entry.name));
        }
      }
    };
    visit(source);
  }
  counts.set('skills',ids.size);
}
if(sub==='agents'||sub==='all')flat('agents');
if(sub==='commands'||sub==='all')flat('commands');
if(sub==='skills'||sub==='all')skills();
// No changes have been made until *all* categories passed the global preflight.
if(check){console.log(`materialize --check OK: ${plan.length} source files inspected; no files written`);process.exit(0);}
const totals=new Map();
for(const record of plan){
  let entry=totals.get(record.kind);if(!entry){entry={copied:0,skipped:0};totals.set(record.kind,entry);}
  if(record.same){entry.skipped++;continue;}
  mkdirSync(dirname(record.destination),{recursive:true});ensureSafe(record.destination);
  const tmp=record.destination+`.ddd-${process.pid}-${entry.copied}.tmp`;
  try{writeFileSync(tmp,record.content,{flag:'wx',mode:0o600});renameSync(tmp,record.destination);entry.copied++;}
  finally{if(st(tmp))rmSync(tmp);}
}
for(const kind of sub==='all'?['agents','commands','skills']:[sub]){
  if(counts.get(kind)==='missing')console.log(`${kind}: 随包无此目录（跳过）`);
  else {const {copied=0,skipped=0}=totals.get(kind)??{};console.log(`${kind}: 物化 ${copied}、跳过 ${skipped} → .opencode/${kind}/`);}
}
