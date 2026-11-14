#!/usr/bin/env node
/** Operator-driven recovery and verification. No automatic prompt replay. */
import {resolve} from 'node:path';
import {readCheckpoint,recordWorkflow,resumeHint} from '../src/lib/workflow-store.mjs';
import {WorkflowController} from '../src/lib/workflow-controller.ts';
import {readTrace,recordTrace,exportEval} from '../src/lib/trace-store.mjs';
const argv=process.argv.slice(2),cmd=argv[0];
function arg(key){const i=argv.indexOf(key);return i>=0?argv[i+1]:undefined;}
const root=resolve(arg('--root')??'.'),session=arg('--session');
if(!['status','verify','close','reconcile','metrics','intervention'].includes(cmd)||!session){
  console.error('用法: node --experimental-strip-types scripts/workflow.mjs <status|verify|close|reconcile|metrics|intervention> --session ID [--root PROJECT]');
  process.exit(2);
}
const ctl=new WorkflowController(root);
try {
  let result;
  if(cmd==='status'){
    const ck=readCheckpoint(root,session);result={checkpoint:ck,notice:resumeHint(ck)};
  }else if(cmd==='verify'){
    if(!argv.includes('--ack-run-tests'))throw Error('运行项目测试前必须显式提供 --ack-run-tests');
    result=await ctl.verify(session);
    if(result.status!=='verified')process.exitCode=1;
  }else if(cmd==='close'){
    if(!argv.includes('--ack-close'))throw Error('关闭未验证任务前必须显式提供 --ack-close');
    const reason=arg('--reason');if(!reason?.trim())throw Error('必须说明 --reason');
    result=await ctl.acknowledgeFailure(session,reason);
  }else if(cmd==='reconcile'){
    if(!argv.includes('--ack-execution'))throw Error('必须显式确认该会话实际执行已结束 --ack-execution');
    const ck=readCheckpoint(root,session);
    if(!ck||!['dispatched','running'].includes(ck.status))throw Error('只能恢复未完成证明的派发/运行中任务');
    result=await recordWorkflow(root,session,{phase:ck.phase,status:'awaiting_verification',reason:'用户确认宿主执行结束，尚未经测试验收'});
  }else if(cmd==='intervention')result=await recordTrace(root,session,{type:'intervention'});
  else if(cmd==='metrics')result={trace:readTrace(root,session),eval:null};
  if(cmd==='metrics' && argv.includes('--export'))result.eval=exportEval(result.trace);
  console.log(JSON.stringify(result,null,2));
} catch(error){console.error(`ddd 工作流拒绝操作：${error.message}`);process.exitCode=1;}
