/** G1–G6 evaluation. --release adds real executable tests and source fingerprint. */
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateProject } from '../src/lib/gate-evaluator.ts';
import { verifyExecutable } from '../src/lib/executable-verifier.mjs';
import { COMMANDS } from '../src/lib/registry.ts';
import { writeReportJson } from './report-io.mjs';
const args=process.argv.slice(2);
const flag=(f)=>args.includes(f);
const value=(f)=>{const i=args.indexOf(f);return i>=0&&args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:undefined;};
if(flag('--root')&&!value('--root')){console.error('--root 需要目录');process.exit(2);}
const root=resolve(value('--root')??args.find(x=>!x.startsWith('--'))??'.');
const pkg=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try{
  const outcome=evaluateProject(root,COMMANDS.map(c=>c.name),pkg);
  const executable=flag('--release')&&outcome.readyForRelease?verifyExecutable(root):null;
  const readyForRelease=outcome.readyForRelease&&(!flag('--release')||executable?.status==='passed');
  const report={ts:new Date().toISOString(),version:2,defectsRegister:outcome.state.wrapup?.defectsRegister===true,readings:outcome.readings,summary:outcome.summary,canAdvance:outcome.canAdvance,readyForRelease,errors:outcome.errors,executable,evidence:{designGaps:outcome.details.designTree?.gaps,isomorphism:outcome.details.isomorphism,commandRegistry:outcome.details.commandRegistry},note:'--release 需要 G1-G6 全 pass，且项目对应工具链的实际测试通过（未知框架返回 unverified）；--check 不写报告'};
  if(!flag('--check'))writeReportJson(join(root,'docs','reports','validate.json'),report);
  for(const r of report.readings)console.log(`${r.id} ${r.verdict}${r.remedy?' — '+r.remedy:''}`);
  for(const error of report.errors)console.error(`证据错误：${error}`);
  if(executable)for(const chk of executable.checks)console.log(`exec ${chk.name}: ${chk.passed?'pass':'fail'} (code ${chk.exitCode})`);
  if(executable?.status!=='passed'&&executable)console.error(`可执行验证失败: ${executable.reason}`);
  console.log(`summary=${JSON.stringify(report.summary)} canAdvance=${outcome.canAdvance} readyForRelease=${readyForRelease}`);
  process.exitCode=flag('--release')?(readyForRelease?0:1):(outcome.canAdvance?0:1);
}catch(error){console.error(`校验失败（拒绝按成功处理）：${error?.stack??error}`);process.exitCode=1;}
