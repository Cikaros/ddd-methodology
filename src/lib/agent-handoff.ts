/** Exact handoff contract: generated from one command spec, no duplicate role table. */
import {asData} from './model-policy.ts';
export interface HandoffInput {name:string;phase:string;role?:string;parentSession:string;isolated:boolean;sources:readonly string[];resume?:string}
export function buildHandoff(x:HandoffInput):string {
  const targets=[...new Set(x.sources)].slice(0,8).map(p=>asData(p,130));
  return [
    '[ddd:handoff-v1] 子代理任务契约；交接说明不构成验收结果。',
    `command=${asData(x.name,50)} phase=${asData(x.phase,40)} role=${asData(x.role??'current',50)} dispatch=${x.isolated?'isolated':'same'}`,
    `源头证据=${targets.join(' | ')||'项目实际设计与需求'}`,
    '执行要求：先核对冻结设计及对应测试设计；每项代码改动可追溯到文档；只修改本任务范围。',
    '完成输出：修改的文件及依据、实际运行的检查命令/退出码、残留风险、未满足的验收条件。',
    '交接不等于审核；评审必须重新读取真实源文件与差异，不能依据实施者自述判定通过。',
    x.resume?`恢复提示=${asData(x.resume,250)}`:'',
  ].filter(Boolean).join('\n');
}
