/** Compare real task traces from two runs, without pretending to have invoked a model. */
import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readJsonlStrict } from '../src/lib/jsonl.mjs';
const args=process.argv.slice(2);
function option(name){const i=args.indexOf(name);return i>=0?args[i+1]:undefined;}
const baseline=option('--baseline'),candidate=option('--candidate');
if(!baseline||!candidate){console.error('用法：node scripts/eval.mjs --baseline before.jsonl --candidate after.jsonl');process.exit(2);}
function read(file){
  const rows=readJsonlStrict(resolve(file),{optional:false,maxLineBytes:8192});
  const out=new Map();
  for(const [i,row] of rows.entries()){
    const id=row.taskId,accepted=row.accepted;
    if(typeof id!=='string'||!id||typeof accepted!=='boolean'||typeof row.model!=='string'||!row.model)throw new Error(`${file}:${i+1} 缺 taskId 或人工/真实测试 accepted`);
    if(out.has(id))throw new Error(`${file}:${i+1} 重复 taskId ${id}`);
    for(const k of ['durationMs','toolCalls','failedToolCalls','manualInterventions','inputTokens','outputTokens','cacheReadTokens']){
      if(typeof row[k]!=='number'||!Number.isFinite(row[k])||row[k]<0)throw new Error(`${file}:${i+1} ${k} 需要非负数字`);
    }
    out.set(id,row);
  }
  return out;
}
function summary(rows){
  const list=[...rows.values()],n=list.length;
  const mean=(key)=>n?list.reduce((s,r)=>s+r[key],0)/n:0;
  const sum=(key)=>list.reduce((s,r)=>s+r[key],0);
  return {n,successRate:n?list.filter(r=>r.accepted).length/n:0,durationMsMean:mean('durationMs'),manualInterventionsMean:mean('manualInterventions'),tokensMean:mean('inputTokens')+mean('outputTokens'),cacheReadTokensMean:mean('cacheReadTokens'),toolFailureRate:sum('toolCalls')?sum('failedToolCalls')/sum('toolCalls'):0};
}
try{
  const before=read(baseline),after=read(candidate);
  const keys=[...before.keys()].sort();
  if(!keys.length||keys.length!==after.size||keys.some(k=>!after.has(k)))throw new Error('必须是同一批 taskId 的成对实验；不能用不同任务集比较');
  for(const id of keys){
    const a=before.get(id),b=after.get(id);
    if(a.model!==b.model)throw new Error(`${id}: 模型不同，不可归因于插件重构`);
  }
  const b=summary(before),a=summary(after);
  console.log(JSON.stringify({schema:1,pairedTasks:keys.length,baseline:b,candidate:a,delta:{successRate:a.successRate-b.successRate,durationMsMean:a.durationMsMean-b.durationMsMean,manualInterventionsMean:a.manualInterventionsMean-b.manualInterventionsMean,tokensMean:a.tokensMean-b.tokensMean,toolFailureRate:a.toolFailureRate-b.toolFailureRate},note:'accepted 必须来自真实测试或人工验收；脚本只聚合上传的观测数据，不产生模型调用'},null,2));
}catch(error){console.error(`评测拒绝比较：${error.message}`);process.exitCode=1;}
