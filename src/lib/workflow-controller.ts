/** Workflow lifecycle adapter. Host events only show execution, never verification. */
import {createHash} from 'node:crypto';
import {readCheckpoint,recordWorkflow,type WorkflowCheckpoint} from './workflow-store.mjs';
import {verifyExecutable} from './executable-verifier.mjs';
import {recordTrace} from './trace-store.mjs';
import { readParentLink, linkChildSession } from './session-links.mjs';

export function sessionOfEvent(event:any):string|undefined {
  const ids=[event?.sessionID,event?.data?.sessionID,event?.data?.session?.id,event?.data?.info?.sessionID,event?.data?.info?.id,event?.data?.session?.sessionID,event?.properties?.sessionID];
  return ids.find(id=>typeof id==='string'&&id.length>0&&id.length<=2048);
}
/** Map child sessions to the initiating DDD command, without exposing raw prompts. */
export class WorkflowController {
  private children=new Map<string,string>();
  private root:string;
  private log:(label:string,error:unknown)=>void;
  constructor(root:string,log:(label:string,error:unknown)=>void=()=>{}){this.root=root;this.log=log;}
  async trackChild(child:string,parent:string){
    // Attribute immediate host events while the durable link is being written.
    this.children.set(child,parent);
    try { await linkChildSession(this.root,child,parent); }
    catch (error) { this.children.delete(child); throw error; }
  }
  originalSession(sessionID:string){
    const known=this.children.get(sessionID);
    if(known)return known;
    const parent=readParentLink(this.root,sessionID);
    if(parent)this.children.set(sessionID,parent);
    return parent??sessionID;
  }
  async prepared(sessionID:string,phase:string,prompt:string){
    const ck=readCheckpoint(this.root,sessionID);
    if(ck)await recordTrace(this.root,sessionID,{type:'verified',accepted:false}).catch(()=>{});
    await recordTrace(this.root,sessionID,{type:'dispatch',phase,requestHash:createHash('sha256').update(prompt).digest('hex')});
  }
  async dispatched(sessionID:string,phase:string){
    const ck=readCheckpoint(this.root,sessionID);
    if(ck?.status==='prepared')await recordWorkflow(this.root,sessionID,{phase,status:'dispatched'});
    else if(!ck || ck.phase!==phase || ck.status==='failed')throw Error('派发结果和执行状态不一致；禁止自动再次派发');
  }
  async toolEvent(sessionID:string,failed:boolean,toolName?:string,toolID?:string){
    const parent=this.originalSession(sessionID),ck=readCheckpoint(this.root,parent);
    if(!ck)return;
    if(ck.status==='prepared')await recordWorkflow(this.root,parent,{phase:ck.phase,status:'dispatched'});
    if(['dispatched','running'].includes(readCheckpoint(this.root,parent)?.status??'')){
      const prior=readCheckpoint(this.root,parent);
      if(prior && prior.status!=='running')await recordWorkflow(this.root,parent,{phase:prior.phase,status:'running'});
    }
    await recordTrace(this.root,parent,{type:'tool',failed,toolName,toolID});
  }
  async onHostEvent(event:any){
    const session=sessionOfEvent(event);
    if(!session)return;
    const parent=this.originalSession(session),type=String(event.type??'');
    const ck=readCheckpoint(this.root,parent);
    if(!ck)return;
    if(type==='session.model.selected'){
      const model=event.data?.model;
      const id=typeof model==='string'?model:typeof model?.id==='string'?model.id:null;
      if(id)await recordTrace(this.root,parent,{type:'model',model:id});
      return;
    }
    if(type==='session.usage.updated'||type==='session.usage.recorded'){
      const d=event.data??{},u=d.usage??d;
      const number=(...items:any[])=>items.find(x=>Number.isSafeInteger(x)&&x>=0);
      const usage={inputTokens:number(u.inputTokens,u.input_tokens,u.input?.total,u.input?.tokens),outputTokens:number(u.outputTokens,u.output_tokens,u.output?.total,u.output?.tokens),cacheReadTokens:number(u.cacheReadTokens,u.cached_tokens,u.cache?.read,u.input?.cachedTokens)};
      await recordTrace(this.root,parent,{type:'usage',...usage});return;
    }
    if(!type.startsWith('session.execution.'))return;
    if(!['prepared','dispatched','running','awaiting_verification'].includes(ck.status))return;
    if(ck.status==='prepared')await recordWorkflow(this.root,parent,{phase:ck.phase,status:'dispatched'});
    const latest=readCheckpoint(this.root,parent);
    if(!latest)return;
    if(type==='session.execution.started'&&latest.status==='dispatched')await recordWorkflow(this.root,parent,{phase:ck.phase,status:'running'});
    else if(type==='session.execution.succeeded'&&['dispatched','running'].includes(latest.status))await recordWorkflow(this.root,parent,{phase:ck.phase,status:'awaiting_verification'});
    else if(['session.execution.failed','session.execution.interrupted'].includes(type)&&['dispatched','running','awaiting_verification'].includes(latest.status)){
      await recordWorkflow(this.root,parent,{phase:ck.phase,status:'failed',reason:type});
      await recordTrace(this.root,parent,{type:'verified',accepted:false});
    }
  }
  current(sessionID:string):WorkflowCheckpoint|null{return readCheckpoint(this.root,this.originalSession(sessionID));}
  async verify(sessionID:string){
    const parent=this.originalSession(sessionID),ck=this.current(parent);
    if(!ck)return {status:'missing',reason:'没有可验收的命令记录',checkpoint:null};
    if(ck.status!=='awaiting_verification')return {status:'not-ready',reason:`当前 ${ck.status}，需要宿主执行成功后方可验证`,checkpoint:ck};
    const result=verifyExecutable(this.root);
    if(result.status==='passed' && result.fingerprint){
      const updated=await recordWorkflow(this.root,parent,{phase:ck.phase,status:'verified',proof:{status:'passed',fingerprint:result.fingerprint,checks:result.checks}});
      await recordTrace(this.root,parent,{type:'verified',accepted:true});
      return {status:'verified',reason:'实际测试通过，源码指纹已绑定',checkpoint:updated,verification:result};
    }
    if(result.status==='failed'){
      const updated=await recordWorkflow(this.root,parent,{phase:ck.phase,status:'failed',reason:result.reason});
      await recordTrace(this.root,parent,{type:'verified',accepted:false});
      return {status:'failed',reason:result.reason,checkpoint:updated,verification:result};
    }
    return {status:'unverified',reason:result.reason,checkpoint:ck,verification:result};
  }
  async acknowledgeFailure(sessionID:string,reason:string){
    const parent=this.originalSession(sessionID),ck=this.current(parent);
    if(!ck||!['prepared','dispatched','running','awaiting_verification'].includes(ck.status))throw Error('没有需要关闭的活动任务');
    const updated=await recordWorkflow(this.root,parent,{phase:ck.phase,status:'failed',reason:reason.slice(0,300)});
    await recordTrace(this.root,parent,{type:'verified',accepted:false});return updated;
  }
}
