/** Single transactional writer/projector for memory.jsonl.
 * No new knowledge is invented: only existing human-reviewed records may recur.
 * Session deletion decays records idempotently; it never removes history.
 */
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,appendFileSync} from 'node:fs';
import {resolve,join,dirname,relative,sep,isAbsolute} from 'node:path';
import {readJsonlStrict} from './jsonl.mjs';
import {assertLocalPath} from './board-store.mjs';
import {withFileLock} from './file-lock.mjs';
import {computeConfidence,decay} from './memory.ts';
const hash=value=>createHash('sha256').update(value).digest('hex');
function fileFor(root){const base=resolve(root),path=join(base,'docs','memory','memory.jsonl');assertLocalPath(base,path);return path;}
export function foldMemoryRows(rows){
 const latest=new Map();
 for(const r of rows){
   if(!r||typeof r!=='object')throw Error('记忆行不是对象');
   if(!r.id){if(r.kind==='session')continue;throw Error('记忆事件缺少 id');}
   if(typeof r.id!=='string'||r.id.length>128)throw Error('非法记忆 id');
   const prev=latest.get(r.id)??{};
   const next={...prev,...r};
   if(typeof next.key!=='string'||typeof next.scope!=='string'||!Number.isFinite(Number(next.confidence)))throw Error('记忆事件缺少必要字段');
   latest.set(r.id,next);
 }
 return [...latest.values()];
}
export function readMemoryRows(root){return readJsonlStrict(fileFor(root),{maxLineBytes:8192});}
async function mutate(root,makeEvents){
 const file=fileFor(root);assertLocalPath(root,dirname(file));mkdirSync(dirname(file),{recursive:true});
 return withFileLock(file+'.lock',async()=>{
   const rows=readMemoryRows(root),events=makeEvents(rows);
   if(!Array.isArray(events)||!events.length)return {written:0,records:foldMemoryRows(rows)};
   const lines=events.map(event=>JSON.stringify(event)+'\n');
   if(lines.some(line=>Buffer.byteLength(line,'utf8')>8192))throw Error('记忆事件超过 maxLineBytes');
   appendFileSync(file,lines.join(''),'utf8');
   return {written:events.length,records:foldMemoryRows([...rows,...events])};
 });
}
export function recordMemoryHit(root,entry,sessionID,cfg){
 if(typeof sessionID!=='string'||!sessionID)throw Error('会话 ID 无效');
 const sessionHash=hash(sessionID);
 return mutate(root,rows=>{
   const last=foldMemoryRows(rows).find(e=>e.id===entry.id);
   if(!last||last.archived||last.scope!==entry.scope||last.key!==entry.key)return [];
   if(rows.some(r=>r.kind==='occur'&&r.id===entry.id&&r.sessionHash===sessionHash))return [];
   const occurrences=Math.max(1,Number(last.occurrences??1))+1;
   return [{...last,kind:'occur',ts:new Date().toISOString(),occurrences,confidence:computeConfidence(occurrences,last.consistency??1),sessionHash}];
 });
}
export function recordSessionDecay(root,sessionID,cfg){
 if(typeof sessionID!=='string'||!sessionID)throw Error('会话 ID 无效');
 const sessionHash=hash(sessionID);
 return mutate(root,rows=>{
   if(rows.some(r=>r.kind==='session'&&r.sessionHash===sessionHash))return [];
   const entries=foldMemoryRows(rows),updates=[];
   for(const entry of entries){
     if(entry.archived||rows.some(r=>r.kind==='occur'&&r.id===entry.id&&r.sessionHash===sessionHash))continue;
     const next=decay(entry,cfg);
     updates.push({...entry,...next,kind:next.archived?'archive':'decay',ts:new Date().toISOString(),sessionHash});
   }
   if(!entries.length)return [];
   updates.push({kind:'session',sessionHash,ts:new Date().toISOString()});
   return updates;
 });
}
