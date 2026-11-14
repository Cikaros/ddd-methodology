/** Small stage-aware, read-only evidence retrieval. Never scans user secrets or source bodies.
 * Only explicit public methodology document paths are eligible.
 */
import { existsSync,readFileSync,lstatSync } from 'node:fs';
import { resolve,join,relative,isAbsolute,sep } from 'node:path';
import { createHash } from 'node:crypto';
const stageFiles={
  intent:['docs/REQUIREMENTS.md','docs/CHANGELOG.md'],
  arch:['docs/REQUIREMENTS.md','docs/OUTLINE-DESIGN.md'],
  design:['docs/OUTLINE-DESIGN.md','docs/ddd/DESIGN.md'],
  review:['docs/ddd/DESIGN.md','docs/OUTLINE-DESIGN.md'],
  'test-design':['docs/ddd/TESTS-subproject.md','docs/REQUIREMENTS.md'],
  implement:['docs/ddd/DESIGN.md','docs/ddd/TESTS-subproject.md'],
  test:['docs/ddd/TESTS-subproject.md','docs/REQUIREMENTS.md'],
  validate:['docs/REQUIREMENTS.md','docs/ddd/DESIGN.md'],
  change:['docs/CHANGELOG.md','docs/OUTLINE-DESIGN.md'],
  wrapup:['docs/CHANGELOG.md','docs/REQUIREMENTS.md'],
  consolidate:['docs/OUTLINE-DESIGN.md','docs/CHANGELOG.md'],
};
function safeFile(root, rel) {
  const base=resolve(root), target=resolve(base,rel),rp=relative(base,target);
  if(isAbsolute(rp)||rp==='..'||rp.startsWith(`..${sep}`))throw Error('证据路径越界');
  let current=base;
  for(const piece of rp.split(sep)){if(!piece)continue;current=join(current,piece);if(existsSync(current)&&lstatSync(current).isSymbolicLink())throw Error('证据路径为符号链接');}
  return target;
}
function usefulLines(source){
  return source.split(/\r?\n/).map(v=>v.trim()).filter(v=>v && !/^(---|\|[- :|]+\||```|#\s*$)/.test(v));
}
export function selectEvidence(root,{phase='intent',budgetTokens=320}={}){
  const list=stageFiles[phase]??['docs/REQUIREMENTS.md'];
  const selected=[];let remaining=Math.max(0,Math.min(1800,Math.floor(budgetTokens)));
  for(const path of list){
    if(remaining<32)break;
    const absolute=safeFile(root,path);
    if(!existsSync(absolute))continue;
    const meta=lstatSync(absolute);if(!meta.isFile()||meta.size>256*1024)continue;
    const content=readFileSync(absolute,'utf8');
    const lines=usefulLines(content).filter(line=>!/^(secret|password|token|api[_-]?key)\s*[:=]/i.test(line));
    // Keep the source header and content truncated *before* token budgeting.
    const budget=Math.min(remaining,Math.max(100,Math.floor(budgetTokens/list.length)));
    let excerpt='';
    for(const line of lines){const clean=line.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,240);const cost=Math.ceil(clean.length/2.2);if(cost+Math.ceil(excerpt.length/2.2)>budget)break;excerpt+=(excerpt?' ':'')+clean;}
    if(!excerpt)continue;
    selected.push({path,text:excerpt,sha256:createHash('sha256').update(content).digest('hex')});
    remaining-=Math.ceil(excerpt.length/2.2);
  }
  return selected;
}

/** Stable project-document revision, independent of the currently selected phase.
 * A memory bound to this revision expires when any authoritative document changes.
 * This is intentionally not a source-code fingerprint or a credential scan.
 */
export function projectEvidenceRevision(root){
  const files=['docs/REQUIREMENTS.md','docs/OUTLINE-DESIGN.md','docs/ARCHITECTURE.md',
    'docs/ddd/DESIGN.md','docs/ddd/TESTS-subproject.md','docs/CHANGELOG.md'];
  const hash=createHash('sha256');let found=0;
  for(const path of files){
    const abs=safeFile(root,path);
    if(!existsSync(abs))continue;
    const st=lstatSync(abs);
    if(!st.isFile()||st.size>256*1024)continue;
    hash.update(path).update('\0').update(readFileSync(abs)).update('\0');found++;
  }
  return found?hash.digest('hex'):undefined;
}
