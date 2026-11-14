/** Minimal privacy-preserving runtime metrics. No prompts, tool arguments or model output.
 * Unknown token usage remains null; never fabricated as zero.
 */
import {createHash,randomUUID} from 'node:crypto';
import {resolve,join,dirname,relative,sep,isAbsolute} from 'node:path';
import {existsSync,lstatSync,mkdirSync,openSync,closeSync,readFileSync,writeFileSync,fsyncSync,renameSync,unlinkSync} from 'node:fs';
import {withFileLock} from './file-lock.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
function pathFor(root,sessionID){if(typeof sessionID!=='string'||!sessionID||sessionID.length>2048)throw Error('会话 ID 无效');return join(resolve(root),'.ddd','state','traces',`${hash(sessionID)}.json`);}
function checkPath(root,path){let cur=resolve(root);const rel=relative(cur,path);if(isAbsolute(rel)||rel==='..'||rel.startsWith(`..${sep}`))throw Error('trace 路径越界');if(existsSync(cur)&&lstatSync(cur).isSymbolicLink())throw Error('trace 根路径符号链接');for(const p of rel.split(sep).filter(Boolean)){cur=join(cur,p);if(existsSync(cur)&&lstatSync(cur).isSymbolicLink())throw Error('trace 符号链接路径');}}
export function readTrace(root,sessionID){const path=pathFor(root,sessionID);checkPath(root,path);if(!existsSync(path))return null;const data=JSON.parse(readFileSync(path,'utf8'));if(data?.schema!==1||typeof data.taskId!=='string'||!Number.isSafeInteger(data.toolCalls)||data.toolCalls<0||!Number.isSafeInteger(data.failedToolCalls)||data.failedToolCalls<0||data.failedToolCalls>data.toolCalls)throw Error('运行指标损坏');return data;}
export async function recordTrace(root,sessionID,event){
  if(!['dispatch','tool','model','usage','intervention','verified'].includes(event?.type))throw Error('非法指标事件');
  const path=pathFor(root,sessionID);checkPath(root,dirname(path));mkdirSync(dirname(path),{recursive:true});checkPath(root,path);
  return withFileLock(`${path}.lock`,async()=>{
    let prev=readTrace(root,sessionID);
    if(event.type==='dispatch'){
      const taskId=hash(String(event.requestHash??sessionID)).slice(0,20);
      prev={schema:1,taskId,phase:String(event.phase??'unknown').slice(0,35),startedAt:new Date().toISOString(),endedAt:null,model:null,accepted:null,toolCalls:0,failedToolCalls:0,manualInterventions:0,inputTokens:null,outputTokens:null,cacheReadTokens:null,recentTools:[]};
    }else if(!prev)return null;
    else if(event.type==='tool') {
      prev.toolCalls++;if(event.failed===true)prev.failedToolCalls++;
      if(typeof event.toolName==='string'&&/^[a-zA-Z0-9._-]{1,60}$/.test(event.toolName)){
        prev.recentTools=[...(prev.recentTools??[]),{name:event.toolName,failed:event.failed===true,idHash:hash(String(event.toolID??'')).slice(0,12)}].slice(-12);
      }
    }
    else if(event.type==='model' && typeof event.model==='string' && event.model.length<150)prev.model=event.model;
    else if(event.type==='usage') {
      // Host may emit a cumulative snapshot. Only update available concrete counters.
      for(const key of ['inputTokens','outputTokens','cacheReadTokens'])if(Number.isSafeInteger(event[key])&&event[key]>=0)prev[key]=event[key];
    }else if(event.type==='intervention')prev.manualInterventions++;
    else if(event.type==='verified'){prev.accepted=event.accepted===true;prev.endedAt=new Date().toISOString();}
    const tmp=path+'.'+randomUUID()+'.tmp';
    try{const out=openSync(tmp,'wx',0o600);try{writeFileSync(out,JSON.stringify(prev)+'\n');fsyncSync(out);}finally{closeSync(out);}renameSync(tmp,path);}finally{if(existsSync(tmp))unlinkSync(tmp);}
    return prev;
  });
}
/** Only complete, observed fields can join A/B comparisons. */
export function exportEval(trace){
  if(!trace||trace.accepted===null||!trace.startedAt||!trace.endedAt||!trace.model||
     ![trace.inputTokens,trace.outputTokens,trace.cacheReadTokens].every(v=>Number.isSafeInteger(v)&&v>=0))throw Error('指标不完整：需要真实模型、Token、验收结果和结束时间');
  return {taskId:trace.taskId,model:trace.model,accepted:trace.accepted,durationMs:Math.max(0,Date.parse(trace.endedAt)-Date.parse(trace.startedAt)),toolCalls:trace.toolCalls,failedToolCalls:trace.failedToolCalls,manualInterventions:trace.manualInterventions,inputTokens:trace.inputTokens,outputTokens:trace.outputTokens,cacheReadTokens:trace.cacheReadTokens};
}
