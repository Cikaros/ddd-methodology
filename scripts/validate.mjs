/**
 * G1-G6 CLI reader. Same live evidence collector and same gate predicates as RPC.
 * `--check`: do not write a report; `--release`: require all six gates to pass.
 * Exit 0 = no blocks (or all pass for --release); exit 1 = blocked; exit 2 = usage.
 */
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectProjectEvidence } from '../src/lib/evidence.mjs';
import { writeReportJson } from './report-io.mjs';

const args = process.argv.slice(2);
function value(flag) { const i = args.indexOf(flag); return i >= 0 && args[i + 1] && !args[i+1].startsWith('--') ? args[i + 1] : undefined; }
if (args.includes('--root') && !value('--root')) { console.error('--root 需要目录'); process.exit(2); }
const root = resolve(value('--root') ?? args.find(a=>!a.startsWith('--')) ?? '.');
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const { gates, summarize, canAdvance } = await import('../src/lib/gates.ts');
  const { COMMANDS } = await import('../src/lib/registry.ts');
  const { state, errors, details } = collectProjectEvidence(root, { commandNames: COMMANDS.map(c=>c.name), packageRoot });
  const readings = [gates.G1(state), gates.G2(state), gates.G3(state), gates.G4(state), gates.G5(state), gates.G6(state)];
  const readyForRelease = errors.length === 0 && readings.every(r=>r.verdict === 'pass');
  const canProceed = errors.length === 0 && canAdvance(readings);
  const report = { ts: new Date().toISOString(), defectsRegister: state.wrapup?.defectsRegister === true, readings, summary: summarize(readings), canAdvance: canProceed, readyForRelease, errors, evidence: { designGaps: details.designTree?.gaps, isomorphism: details.isomorphism, commandRegistry: details.commandRegistry }, note: 'na ≠ pass；--release 要求所有门禁 pass，无损坏证据' };
  if (!args.includes('--check')) writeReportJson(join(root,'docs','reports','validate.json'), report);
  for (const r of readings) console.log(`${r.id} ${r.verdict}${r.remedy ? ' — '+r.remedy : ''}`);
  for (const error of errors) console.error(`证据错误: ${error}`);
  console.log(`summary=${JSON.stringify(report.summary)} canAdvance=${canProceed} readyForRelease=${readyForRelease}`);
  process.exit(args.includes('--release') ? (readyForRelease ? 0 : 1) : (canProceed ? 0 : 1));
} catch (error) {
  console.error(`校验失败（拒绝按成功处理）：${error?.stack ?? error}`);
  process.exit(1);
}
