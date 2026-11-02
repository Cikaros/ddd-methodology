#!/usr/bin/env node
/**
 * 目标：把结构趋势、债务时效、根因复发、交付质量与声明面五类度量的结果装配为文本报告与结构化产物，作为绩效度量的机械采集入口。
 * 范围：调用共享层的来源读取与各域度量，装配 payload 写入 docs/metrics.json，渲染固定分段文本，末行为机读结论；本脚本只留装配与输出。
 * 实现外置：来源读取与共享原语见 ./lib/metrics-sources.js，结构与债务类度量见 ./lib/metrics-structure.js，交付质量与声明面类度量见 ./lib/metrics-delivery.js。
 * 不包含：各度量的口径与计算（见上述共享层模块）、门禁判定（本脚本恒退出 0，仅报告）、源产物本身的生成、语义级判断。
 * 用法：node metrics-report.js <项目根>
 * 输出形态：文本正文，末行机读结论
 * 末行机读结论：`RESULT: report`
 * 退出码：恒 0，仅报告，不作门禁
 * 输出上限：12000 字节，按 UTF-8 字节计量；超限截断明细，末行结论保留完整
 * 未启用取向：docs/health.json 或 docs/debts.json 缺失时相应度量记空并输出说明，判通过，兼容未启用项目
 * 缺省取向：health.json 早期条目缺字段时按缺省值零处理，并在产物中标注，不判失败
 * 规范依据：规范「绩效度量」节的 18.1 交付质量类、18.2 结构与债务类与 18.3 声明面类度量
 */

const fs = require("fs");
const path = require("path");
const { HEALTH_REL, DEBT_BOOK_REL, readHealth, readDebts, readDirFiles, isBlank } = require("./lib/metrics-sources.js");
const { computeTrend, computeDebt, computeRecurrence } = require("./lib/metrics-structure.js");
const { REPORTS_DIR_REL, computeGates, computeReworkRounds, computeDefectLevels, computeDefectDensity, computeUnconsumedDeclarations, computeMechanicalEvidenceCoverage } = require("./lib/metrics-delivery.js");

const root = process.argv[2] || process.cwd();
const METRICS_REL = "docs/metrics.json";
const METRICS_LIMIT_BYTES = 12000;

const health = readHealth(root);
const debts = readDebts(root);
const trend = computeTrend(health);
const debt = computeDebt(debts);
const recurrence = computeRecurrence(debts);
const reportFiles = readDirFiles(root, REPORTS_DIR_REL, /\.md$/);
const gates = computeGates(root);
const reworkRounds = computeReworkRounds(reportFiles);
const defectLevels = computeDefectLevels(reportFiles);
const defectDensity = computeDefectDensity(health, defectLevels);
const unconsumedDeclarations = computeUnconsumedDeclarations(root);
const mechanicalEvidenceCoverage = computeMechanicalEvidenceCoverage(root);
const deliveryQuality = {
  status: gates.status === "ok" || reworkRounds.status === "ok" || defectLevels.status === "ok" ? "ok" : "unavailable",
  gates,
  reworkRounds,
  defectLevels,
  defectDensity,
  notes: [...gates.notes, ...reworkRounds.notes, ...defectLevels.notes, ...defectDensity.notes],
};
const declarationAudit = {
  status: unconsumedDeclarations.status === "ok" || mechanicalEvidenceCoverage.status === "ok" ? "ok" : "unavailable",
  unconsumedDeclarations,
  mechanicalEvidenceCoverage,
  notes: [...unconsumedDeclarations.notes, ...mechanicalEvidenceCoverage.notes],
};
const currentVersion = debts.available && !debts.invalid && !isBlank(debts.data.currentVersion) ? debts.data.currentVersion : null;
const notes = [...trend.notes, ...debt.notes, ...recurrence.notes, ...deliveryQuality.notes, ...declarationAudit.notes];

const payload = {
  at: new Date().toISOString(),
  currentVersion,
  thresholdFilesTrend: trend,
  debt,
  recurrence,
  deliveryQuality,
  declarationAudit,
  notes,
};

const metricsPath = path.join(root, ...METRICS_REL.split("/"));
fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
fs.writeFileSync(metricsPath, JSON.stringify(payload, null, 2) + "\n");

// 文本正文：三类度量各一行，缺失或不可采集时按口径给出说明；末行为机读结论
const rateText = (d) => (d.openCount === null ? "不可采集" : `${(d.overdueRate * 100).toFixed(2)}%（${d.overdueCount} / ${d.openCount}）`);
const trendText = (t) => {
  if (t.status === "unavailable") return "不可采集";
  if (t.status === "insufficient") return `样本不足（仅 ${t.samples} 条），最新 ${t.latest}`;
  return `最新 ${t.latest}，上一 ${t.previous}，差值 ${t.delta >= 0 ? "+" : ""}${t.delta}`;
};
const recurrenceText = (r) => {
  if (r.total === null) return "不可采集";
  return `合计 ${r.total}，最大 ${r.max}${r.maxRootCause ? `（${r.maxRootCause}）` : ""}`;
};
const gateRateText = (g) => (g.status === "unavailable" ? "不可采集" : `${(g.firstPassRate * 100).toFixed(2)}%（首轮通过 ${g.firstPass} / ${g.total}）`);
const gateRoundsText = (g) => (g.status === "unavailable" ? "不可采集" : Object.keys(g.rounds).sort().map((id) => `${id} 第 ${g.rounds[id] === null ? "?" : g.rounds[id]} 轮`).join("，"));
const roundsText = (r) => (r.status === "unavailable" ? "不可采集" : Object.keys(r.distribution).sort((a, b) => Number(a) - Number(b)).map((k) => `${k} 轮 ${r.distribution[k]} 项`).join("，"));
const defectLevelsText = (d) => (d.status === "unavailable" ? "不可采集" : `A ${d.distribution.A}，B ${d.distribution.B}，C ${d.distribution.C}，D ${d.distribution.D}`);
const defectDensityText = (d) => (d.status === "ok" ? `${d.density} ${d.unit}（${d.total} / 源码 ${d.sourceKloc} 千行）` : "不可采集");
const unconsumedText = (d) => (d.status === "ok" ? `${(d.ratio * 100).toFixed(2)}%（${d.problematic} / ${d.total}）` : "不可采集");
const mechCoverageText = (d) => (d.status === "ok" ? `${(d.ratio * 100).toFixed(2)}%（含机械型证据源 ${d.mechanical} / 门 ${d.total}）` : "不可采集");

const entries = [];
const say = (text, droppable) => entries.push({ text, droppable: Boolean(droppable) });
say("=== 绩效度量聚合 ===");
say(`项目根：${root}`);
say(`来源产物：${HEALTH_REL}（${health.available ? "可用" : "缺失"}）、${DEBT_BOOK_REL}（${debts.available ? (debts.invalid ? "非法" : "可用") : "缺失"}）`);
say("");
say("[结构与债务类 18.2]");
say(`  超阈值文件数趋势：${trendText(trend)}`);
say(`  债务未清数：${debt.openCount === null ? "不可采集" : debt.openCount}；超期率：${rateText(debt)}`);
say(`  同一根因复发次数：${recurrenceText(recurrence)}`);
if (recurrence.total !== null && Object.keys(recurrence.byRootCause).length) {
  for (const [key, value] of Object.entries(recurrence.byRootCause)) say(`    · ${key}：${value}`, true);
}
say("");
say("[交付质量类 18.1]");
say(`  八道门一次通过率：${gateRateText(gates)}`);
say(`  过门轮次：${gateRoundsText(gates)}`);
say(`  返工轮次分布：${roundsText(reworkRounds)}`);
say(`  缺陷四级分布：${defectLevelsText(defectLevels)}`);
say(`  缺陷密度：${defectDensityText(defectDensity)}`);
say("");
say("[声明面类 18.3]");
say(`  无消费方声明占比：${unconsumedText(unconsumedDeclarations)}`);
say(`  机械证据覆盖率：${mechCoverageText(mechanicalEvidenceCoverage)}`);
if (notes.length) {
  say("");
  say("[标注]");
  for (const note of notes) say(`  · ${note}`, true);
}
say("");
say(`结构化产物：${METRICS_REL}`);
say("本脚本恒退出 0，仅报告，不作门禁");
say("RESULT: report");

// 超限时自尾部回撤可弃明细，末行结论与固定行保留；正文规模小，仍按同一上限口径收敛
function capReport(all) {
  const droppable = all.map((entry, index) => (entry.droppable ? index : -1)).filter((index) => index >= 0);
  const build = (keep) => {
    const dropped = new Set(droppable.slice(keep));
    const out = [];
    let noted = false;
    for (const [index, entry] of all.entries()) {
      if (!dropped.has(index)) { out.push(entry.text); continue; }
      if (!noted) { out.push(`明细已截断：共 ${droppable.length} 项，已列 ${keep} 项`); noted = true; }
    }
    return out;
  };
  for (let keep = droppable.length; keep >= 0; keep--) {
    const out = build(keep);
    if (Buffer.byteLength(out.join("\n"), "utf8") <= METRICS_LIMIT_BYTES) return out;
  }
  return build(0);
}

process.stdout.write(capReport(entries).join("\n") + "\n");
process.exit(0);
