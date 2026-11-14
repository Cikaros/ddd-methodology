/** Durable workflow journal. A dispatch receipt is never mistaken for successful work.
 * No raw prompts, arguments or tool output are persisted. All writes are atomic and locked.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, lstatSync, openSync, writeFileSync, closeSync, fsyncSync, renameSync, unlinkSync, statSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute, sep } from 'node:path';
import {withFileLock} from './file-lock.mjs';

const statuses = new Set(['prepared','dispatched','running','awaiting_verification','verified','failed','superseded']);
const phases = new Set(['init','intent','arch','design','review','test-design','implement','test','validate','change','map','wrapup','consolidate','board','memo']);
const active = new Set(['prepared','dispatched','running','awaiting_verification']);
const transitions = {
  prepared: new Set(['dispatched','failed','superseded']),
  dispatched: new Set(['running','awaiting_verification','failed','superseded']),
  running: new Set(['running','awaiting_verification','failed','superseded']),
  awaiting_verification: new Set(['running','verified','failed','superseded']),
  failed: new Set(['prepared']), verified: new Set(['prepared']), superseded: new Set(['prepared']),
};
function hash(value) {return createHash('sha256').update(value).digest('hex');}
export function checkpointPath(root, sessionID) {
  if (typeof sessionID !== 'string' || !sessionID.trim() || sessionID.length > 2048) throw new Error('sessionID 无效');
  return join(resolve(root), '.ddd', 'state', 'workflows', `${hash(sessionID)}.json`);
}
function assertNoSymlinks(path, root) {
  let current = resolve(root); const rel = relative(current, resolve(path));
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('工作流路径越界');
  if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('项目根目录为符号链接');
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`工作流路径包含符号链接: ${part}`);
  }
}
function validate(value) {
  if (![1,2].includes(value?.schema) || !Number.isSafeInteger(value?.seq) || value.seq<1 ||
      !statuses.has(value?.status) || !phases.has(value?.phase) || !Array.isArray(value?.history) ||
      value.history.length<1 || value.history.length>64 || value.history.at(-1)?.status!==value.status ||
      value.history.at(-1)?.seq!==value.seq || !/^[0-9a-f]{64}$/.test(value.requestHash??''))
    throw new Error('工作流检查点损坏');
  let last = -1;
  for (const item of value.history) {
    if (!Number.isSafeInteger(item.seq) || item.seq<=last || !statuses.has(item.status) ||
        !phases.has(item.phase) || !/^[0-9a-f]{64}$/.test(item.requestHash??'') ||
        typeof item.at!=='string' || !Number.isFinite(Date.parse(item.at))) throw new Error('工作流事件损坏');
    last=item.seq;
  }
  if (value.schema===2 && (!Number.isSafeInteger(value.taskSeq) || value.taskSeq<1)) throw new Error('工作流任务序号损坏');
  return value;
}
export function readCheckpoint(root, sessionID) {
  const file = checkpointPath(root, sessionID); assertNoSymlinks(file,root);
  if (!existsSync(file)) return null;
  try{return validate(JSON.parse(readFileSync(file,'utf8')));}
  catch(error){throw new Error(`工作流状态不可使用：${error.message}`);}
}
/** Single state transition; all evidence is local verified metadata, never model assertions. */
export async function recordWorkflow(root,sessionID,{phase,status,requestText='',targetSessionID,proof,reason}={}) {
  if (!phases.has(phase)||!statuses.has(status))throw new Error('非法工作流阶段/状态');
  if(typeof requestText!=='string'||requestText.length>1_000_000)throw new Error('请求长度无效');
  if(reason!==undefined&&(typeof reason!=='string'||reason.length>300))throw new Error('状态原因无效');
  if(targetSessionID!==undefined&&(typeof targetSessionID!=='string'||targetSessionID.length>2048))throw new Error('目标会话 ID 无效');
  if(status==='verified' && !(proof?.status==='passed' && /^[0-9a-f]{64}$/.test(proof.fingerprint?.sha256??'') && Array.isArray(proof.checks) && proof.checks.length>0 && proof.checks.every(c=>c.passed===true)))
    throw new Error('必须提供真实执行器通过的测试证据，不能仅凭模型声明完成');
  const file=checkpointPath(root,sessionID), parent=dirname(file);
  assertNoSymlinks(parent,root);mkdirSync(parent,{recursive:true});assertNoSymlinks(file,root);
  return withFileLock(`${file}.lock`,async()=>{
    const previous=readCheckpoint(root,sessionID), priorStatus=previous?.status;
    if(status!=='prepared' && !previous)throw new Error('工作流尚未准备，不可更新状态');
    if(status==='prepared' && previous && active.has(priorStatus) && phase===previous.phase && hash(requestText)===previous.requestHash)
      throw new Error('相同任务已在处理中；请先恢复/验收，不可重复派发');
    if(status!=='prepared' && (phase!==previous.phase || !transitions[priorStatus]?.has(status)))
      throw new Error(`未准备或阶段不匹配：非法工作流状态转换 ${priorStatus??'none'} → ${status}`);
    if(status==='verified' && priorStatus!=='awaiting_verification')throw new Error('仅待验证任务可验收完成');
    const at=new Date().toISOString(), taskSeq=(previous?.taskSeq??1)+(status==='prepared' && previous ? 1 : 0);
    const additions=[];
    if(status==='prepared' && previous && active.has(priorStatus))additions.push({seq:previous.seq+1,phase:previous.phase,status:'superseded',at,requestHash:previous.requestHash,reason:'新任务替代，原任务尚未通过验收'});
    const seq=(previous?.seq??0)+additions.length+1;
    const requestHash=status==='prepared'?hash(requestText):previous.requestHash;
    const event={seq,phase,status,at,requestHash, ...(targetSessionID?{targetSessionHash:hash(targetSessionID)}:{}), ...(reason?{reason}:{}),
      ...(proof?{proof:{status:'passed',fingerprint:proof.fingerprint.sha256,checks:proof.checks.map(c=>({name:String(c.name).slice(0,60),passed:c.passed===true,exitCode:c.exitCode??null})).slice(0,12)}}:{})};
    const value={schema:2,taskSeq, ...event,history:[...(previous?.history??[]),...additions,event].slice(-64)};
    validate(value);
    const tmp=`${file}.${randomUUID()}.tmp`;
    try{const out=openSync(tmp,'wx',0o600);try{writeFileSync(out,JSON.stringify(value)+'\n');fsyncSync(out);}finally{closeSync(out);}renameSync(tmp,file);}
    finally{if(existsSync(tmp))unlinkSync(tmp);}
    return value;
  });
}
/** Backwards compatible receipt API for 2.0 callers. */
export function recordDispatch(root,sessionID,phase,status,requestText=''){
  if(!new Set(['prepared','dispatched','failed']).has(status))throw new Error('非法派发状态');
  return recordWorkflow(root,sessionID,{phase,status,requestText});
}
export function resumeHint(value){
  if(!value)return '';
  const descriptions={prepared:'已准备但未派发',dispatched:'已派发，尚无完成证明',running:'工具执行中，可能存在已修改的文件',awaiting_verification:'执行结束，尚未通过真实测试验收',verified:'已通过测试验收',failed:'失败，需检查失败原因',superseded:'上次任务被替代，未获得验收'};
  return `上次 /ddd-${value.phase} ${descriptions[value.status]}；检查工作区、设计件与测试证据，绝不可自动重复派发。`;
}
