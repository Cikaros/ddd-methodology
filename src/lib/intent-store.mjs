/** Intent capture is an untrusted draft, not a frozen requirement or gate approval. */
import { existsSync, mkdirSync, openSync,closeSync,writeFileSync,renameSync,unlinkSync,fsyncSync } from 'node:fs';
import { resolve,join,dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertLocalPath } from './board-store.mjs';
const scenarios=new Set(['greenfield','incremental','migration']);
export function saveIntentDraft(root, input){
  if(!input||!scenarios.has(input.scenario))throw new Error('场景越域');
  const fields=['who','result','accept','notdoing'];
  const draft={schema:1,scenario:input.scenario,at:new Date().toISOString()};
  for(const name of fields){
    if(typeof input[name]!=='string'||input[name].length>4000)throw new Error(`四问字段无效：${name}`);
    draft[name]=input[name].trim();
  }
  const missing=fields.filter(k=>!draft[k]).length;
  const file=join(resolve(root),'.ddd','state','intent-draft.json');
  assertLocalPath(root,file);
  mkdirSync(dirname(file),{recursive:true});
  const temp=file+'.'+randomUUID()+'.tmp';const fd=openSync(temp,'wx',0o600);
  try{writeFileSync(fd,JSON.stringify(draft,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  try{renameSync(temp,file);}catch(e){try{unlinkSync(temp);}catch{}throw e;}
  return {saved:true,missing};
}
