/** Project bootstrap: preflight every template + agent + Skill before first write.
 * The project is not overwritten unless --force was explicitly requested.
 */
import { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync, lstatSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv=process.argv.slice(2);
let root=process.cwd(), force=false;
for(let i=0;i<argv.length;i++){
  if(argv[i]==='--root' && argv[i+1] && !argv[i+1].startsWith('--'))root=resolve(argv[++i]);
  else if(argv[i]==='--force')force=true;
  else {console.error(`未知或缺少参数：${argv[i]}`);process.exit(2);}
}
function fail(msg){console.error(`失败：${msg}`);process.exit(1);}
function st(path){try{return lstatSync(path);}catch(error){if(error?.code==='ENOENT')return null;throw error;}}
function local(relativeFile){
  const path=resolve(root,relativeFile),rel=relative(root,path);
  if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))fail('目标路径越界');
  let current=root;
  for(const part of rel.split(sep).filter(Boolean)){
    if(st(current)?.isSymbolicLink())fail(`目标路径含符号链接：${current}`);
    current=join(current,part);
  }
  if(st(current)?.isSymbolicLink())fail(`目标路径为符号链接：${current}`);
  return path;
}
const ROOT_DOCS=['AGENTS.md','README.md','CONTRIBUTING.md'];
let listing;
try{listing=readdirSync(root,{withFileTypes:true});}catch(error){fail(`项目根目录不可读：${error.message}`);}
const extra=listing.filter(x=>x.isFile() && /\.(md|markdown)$/i.test(x.name) && !ROOT_DOCS.includes(x.name));
if(extra.length)fail(`根目录出现白名单外的文档：${extra.map(x=>x.name).join(', ')}`);
const templates=[
  ['AGENTS.md','# AGENTS.md\n\n> 本项目的代理指令入口（唯一权威）。由 ddd 方法论维护。\n'],
  ['README.md','# 项目\n\n由 ddd 方法论（Hermess 2.0）初始化。文档为唯一权威，代码为其落地。\n'],
  ['CONTRIBUTING.md','# 贡献指南\n\n先改文档，再落地代码；变更须落 `docs/CHANGELOG.jsonl` 三字段。\n'],
  ['docs/GLOSSARY.md','# 术语表（唯一权威）\n\n> 新术语先在此补条再引用。\n'],
  ['docs/ARCHITECTURE.md','# 架构基线\n\n## 技术栈\n\n## 核心依赖\n\n## 目录结构\n\n## 环境探查\n'],
  ['docs/CHANGELOG.jsonl',''],['docs/temp.jsonl',''],
  ['docs/maps.json',JSON.stringify({add:[],override:[],disable:[]},null,2)+'\n'],
];
const dirs=['docs/requirements','docs/ddd','docs/reports','docs/audits','docs/maps','docs/board','docs/memory'];
// One first-pass check for all template files.
for(const [rel,text] of templates){
  const target=local(rel),prior=st(target);
  if(prior && !prior.isFile())fail(`目标不是普通文件：${rel}`);
  if(prior && readFileSync(target,'utf8')!==text && !force)fail(`项目已有不同内容：${rel}；需要显式 --force`);
}
for(const dir of dirs){const target=local(dir),prior=st(target);if(prior&&!prior.isDirectory())fail(`目标目录异常：${dir}`);}
const preArgs=[join(packageRoot,'scripts/materialize.mjs'),'all','--root',root,'--check',...(force?['--force']:[])];
const pre=spawnSync('node',preArgs,{encoding:'utf8'});
if(pre.error||pre.status!==0)fail(pre.stderr||pre.error?.message||'物化预检失败');
// All preflights passed. Begin actual output.
let created=0,skipped=0;
for(const dir of dirs){const target=local(dir);if(st(target))skipped++;else {mkdirSync(target,{recursive:true});created++;}}
for(const [rel,text] of templates){
  const target=local(rel);
  if(st(target)&&readFileSync(target,'utf8')===text){skipped++;continue;}
  mkdirSync(dirname(target),{recursive:true});
  const tmp=`${target}.ddd-${process.pid}.tmp`;
  try{writeFileSync(tmp,text,{flag:'wx',mode:0o600});renameSync(tmp,target);created++;}
  finally{if(st(tmp))rmSync(tmp);}
}
const execute=(name,args)=>{
  const child=spawnSync('node',[...(name==='snapshot.mjs'?['--experimental-strip-types']:[]),join(packageRoot,'scripts',name),...args],{encoding:'utf8'});
  if(child.stdout)process.stdout.write(child.stdout);
  if(child.stderr)process.stderr.write(child.stderr);
  if(child.error||child.status!==0)fail(`${name} 执行失败：${child.error?.message??child.status}`);
};
execute('materialize.mjs',['all','--root',root,...(force?['--force']:[])]);
execute('snapshot.mjs',['--root',root]);
console.log(`scaffold：新建 ${created}、跳过 ${skipped}、差异未覆盖 0`);
