/**
 * 目标：脚本共享层的交付质量类与声明面类度量，按规范「绩效度量」节 18.1 与 18.3 口径计算六项——八道门一次通过率与过门轮次、返工轮次分布、
 *   缺陷四级分布、缺陷密度、无消费方声明占比、机械证据覆盖率，作为绩效度量的交付与声明二面实现。
 * 范围：读 docs/gates/ 与 docs/reports/ 的门禁记录、缺陷路由单与测试报告，读 docs/audits/ 最新审计报告的逐项审计表，
 *   读规范「质量门禁」节门禁表的证据源列；来源目录缺失或字段不全时相应度量记空并说明，不改口径、不判失败。
 * 不包含：结构与债务类度量（见 metrics-structure.js）、来源读取原语（见 metrics-sources.js）、文本报告装配与产物落盘、命令行入口。不引入第三方依赖。
 */

const fs = require("fs");
const path = require("path");
const { readFileText } = require("./text.js");
const { HEALTH_REL, num, isMissingNumber, readDirFiles, readJsonLine, isTableSeparator, firstTableAfter } = require("./metrics-sources.js");

// 交付质量类来源目录：门禁记录与测试报告归档；门的总数固定为八，即 G1、G2、G3、G4、G4.5、G5、G5-INT、G6
const GATES_DIR_REL = "docs/gates";
const REPORTS_DIR_REL = "docs/reports";
const AUDITS_DIR_REL = "docs/audits";
const GATE_TOTAL = 8;
// 规范门禁表的两种解析布局：仓库内布局与安装后布局，相对调用脚本自身定位
const SPEC_GATE_REL = ["skill", "ddd-methodology", "references", "spec-gate.md"];
const SPEC_GATE_ABS = path.resolve(__dirname, "..", "..", "references", "spec-gate.md");
// 无消费方声明占比的分子：逐项审计表结论中的三类问题取值，其余取值视为有效不计入分子
const PROBLEMATIC_CONCLUSIONS = ["无消费方", "纸面消费方", "消费不正确"];

// 度量四：八道门一次通过率与过门轮次。读 docs/gates/ 各记录的 GATE 机读行；首轮即通过的门数除以八
function computeGates(root) {
  const files = readDirFiles(root, GATES_DIR_REL, /\.md$/);
  if (files === null) return { status: "unavailable", total: GATE_TOTAL, firstPass: null, firstPassRate: null, rounds: {}, notes: [`${GATES_DIR_REL}/ 缺失，门禁记录未落盘，一次通过率与过门轮次不可采集`] };
  const notes = [];
  const rounds = {};
  const verdicts = {};
  for (const file of files) {
    const rec = readJsonLine(file.text, "GATE");
    if (!rec || typeof rec.id !== "string" || rec.id === "") { notes.push(`${GATES_DIR_REL}/${file.name} 缺 GATE 机读行，跳过`); continue; }
    const round = Number(rec.round);
    rounds[rec.id] = Number.isFinite(round) ? round : null;
    verdicts[rec.id] = rec.verdict === "pass" || rec.verdict === "fail" ? rec.verdict : null;
  }
  const ids = Object.keys(rounds);
  if (!ids.length) return { status: "unavailable", total: GATE_TOTAL, firstPass: null, firstPassRate: null, rounds, notes: notes.concat([`${GATES_DIR_REL}/ 下无有效 GATE 机读行，一次通过率与过门轮次不可采集`]) };
  const firstPass = ids.filter((id) => rounds[id] === 1 && verdicts[id] === "pass").length;
  return { status: "ok", total: GATE_TOTAL, firstPass, firstPassRate: Number((firstPass / GATE_TOTAL).toFixed(4)), rounds, verdicts, notes };
}

// 度量五：返工轮次分布。逐条取 docs/reports/ 下缺陷路由单的轮回计数，按计数分档
function computeReworkRounds(reportFiles) {
  if (reportFiles === null) return { status: "unavailable", distribution: {}, notes: [`${REPORTS_DIR_REL}/ 缺失，返工轮次分布不可采集`] };
  const distribution = {};
  const notes = [];
  let counted = 0;
  for (const file of reportFiles) {
    if (!/^defect-/.test(file.name)) continue;
    const m = file.text.match(/^\s*[-*]?\s*轮回计数\s*[:：]\s*(\d+)/m);
    if (!m) { notes.push(`${REPORTS_DIR_REL}/${file.name} 无轮回计数字段，跳过`); continue; }
    const key = String(Number(m[1]));
    distribution[key] = (distribution[key] || 0) + 1;
    counted++;
  }
  if (!counted) return { status: "unavailable", distribution: {}, notes: notes.concat([`${REPORTS_DIR_REL}/ 下无带轮回计数的缺陷路由单，返工轮次分布不可采集`]) };
  return { status: "ok", distribution, notes };
}

// 度量六：缺陷四级分布。优先取缺陷路由单的判定级别；无带级别的路由单时回退取测试报告 DEFECTS 机读行，按版本取轮次最大的一份
function computeDefectLevels(reportFiles) {
  const empty = { A: 0, B: 0, C: 0, D: 0 };
  if (reportFiles === null) return { status: "unavailable", distribution: empty, notes: [`${REPORTS_DIR_REL}/ 缺失，缺陷四级分布不可采集`] };
  const distribution = { A: 0, B: 0, C: 0, D: 0 };
  const notes = [];
  let counted = 0;
  for (const file of reportFiles) {
    if (!/^defect-/.test(file.name)) continue;
    const m = file.text.match(/^\s*[-*]?\s*判定级别[^\n:：]*[:：]\s*([ABCD])\b/m);
    if (!m) { notes.push(`${REPORTS_DIR_REL}/${file.name} 无判定级别字段，跳过`); continue; }
    distribution[m[1]]++;
    counted++;
  }
  if (counted) return { status: "ok", source: "缺陷路由单", distribution, notes };
  const byVersion = new Map();
  for (const file of reportFiles) {
    const rm = file.name.match(/^test-(.+)-r(\d+)\.md$/);
    if (!rm) continue;
    const rec = readJsonLine(file.text, "DEFECTS");
    if (!rec) continue;
    const round = Number(rm[2]);
    const prev = byVersion.get(rm[1]);
    if (!prev || round > prev.round) byVersion.set(rm[1], { round, rec });
  }
  if (!byVersion.size) return { status: "unavailable", distribution: empty, notes: notes.concat([`${REPORTS_DIR_REL}/ 下无判定级别字段与 DEFECTS 机读行，缺陷四级分布不可采集`]) };
  for (const { rec } of byVersion.values()) for (const k of ["A", "B", "C", "D"]) distribution[k] += num(rec[k]);
  return { status: "ok", source: "测试报告 DEFECTS 机读行", distribution, notes };
}

// 度量七：缺陷密度。缺陷四级分布之和除以项目源码千行数，单位为每千行缺陷数；
// 分母取健康度量最新条的源码总行数 sourceLines，触碰行数无机械来源故不作分母
function computeDefectDensity(health, defectLevels) {
  const unit = "每千行缺陷数";
  const empty = { status: "unavailable", total: null, sourceKloc: null, density: null, unit, notes: [] };
  if (!health.available) return { ...empty, notes: [`${HEALTH_REL} 缺失，缺陷密度不可采集`] };
  if (health.parseError) return { ...empty, notes: [health.parseError] };
  if (!health.history.length) return { ...empty, notes: [`${HEALTH_REL} 无历史条目，缺陷密度不可采集`] };
  const latest = health.history[health.history.length - 1];
  if (!latest || typeof latest !== "object" || isMissingNumber(latest.sourceLines) || latest.sourceLines <= 0) return { ...empty, notes: [`${HEALTH_REL} 最新条目缺源码总行数 sourceLines，缺陷密度不可采集`] };
  const sourceKloc = Number((latest.sourceLines / 1000).toFixed(4));
  if (defectLevels.status !== "ok") {
    return { status: "unavailable", total: null, sourceKloc, density: null, unit, notes: [`${REPORTS_DIR_REL}/ 缺陷四级分布不可采集，缺陷密度不可采集`] };
  }
  const total = ["A", "B", "C", "D"].reduce((sum, k) => sum + num(defectLevels.distribution[k]), 0);
  const density = Number((total / (latest.sourceLines / 1000)).toFixed(4));
  return { status: "ok", total, sourceKloc, density, unit, notes: [] };
}

// 逐项审计表解析：结论列按表头名称定位，表头未命名结论列时回退末列，列数变化时越界再回退末格，避免因列位移而误算
function parseAuditTable(text) {
  const rows = firstTableAfter(String(text || "").split("\n"), /逐项审计表/);
  if (!rows) return null;
  const header = rows[0];
  let col = header.indexOf("结论");
  if (col < 0) col = header.length - 1;
  let total = 0, problematic = 0;
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (isTableSeparator(cells)) continue;
    const conclusion = cells[col] !== undefined ? cells[col] : cells[cells.length - 1];
    total++;
    if (PROBLEMATIC_CONCLUSIONS.some((value) => String(conclusion || "").includes(value))) problematic++;
  }
  return { total, problematic };
}

// 度量八：无消费方声明占比。取 docs/audits/ 下最新一份审计报告，归档名形如 G6-序号-版本，序号最大者为最新；
// 统计无消费方、纸面消费方与消费不正确三类之和除以声明总数，报告目录或表格缺失时记空并说明，不判失败
function computeUnconsumedDeclarations(root) {
  const empty = { status: "unavailable", total: null, problematic: null, ratio: null, source: null, notes: [] };
  const dir = path.join(root, ...AUDITS_DIR_REL.split("/"));
  let names;
  try { names = fs.readdirSync(dir); } catch (e) { return { ...empty, notes: [`${AUDITS_DIR_REL}/ 缺失，无消费方声明占比不可采集`] }; }
  const reports = names.filter((name) => /\.md$/i.test(name));
  if (!reports.length) return { ...empty, notes: [`${AUDITS_DIR_REL}/ 下无审计报告，无消费方声明占比不可采集`] };
  const seqOf = (name) => { const m = name.match(/G6-(\d+)-/); return m ? Number(m[1]) : null; };
  // 序号最大者为最新；序号不可解析时按文件名字典序末位
  const latest = reports.slice().sort((a, b) => ((seqOf(a) ?? Infinity) - (seqOf(b) ?? Infinity)) || (a < b ? -1 : a > b ? 1 : 0)).pop();
  const source = `${AUDITS_DIR_REL}/${latest}`;
  const parsed = parseAuditTable(readFileText(path.join(dir, latest)));
  if (!parsed) return { ...empty, source, notes: [`${source} 未找到逐项审计表，无消费方声明占比不可采集`] };
  if (!parsed.total) return { ...empty, source, notes: [`${source} 逐项审计表无数据行，无消费方声明占比不可采集`] };
  return { status: "ok", source, total: parsed.total, problematic: parsed.problematic, ratio: Number((parsed.problematic / parsed.total).toFixed(4)), notes: [] };
}

// 门禁表解析：定位规范「质量门禁」节首张表，证据源列按表头名称定位，越界回退末列；缺证据源列或门列即判不可解析
function parseGateTable(text) {
  const rows = firstTableAfter(String(text || "").split("\n"), /^##\s+.*质量门禁/);
  if (!rows) return null;
  const header = rows[0];
  if (!header.includes("证据源") || !header.includes("门")) return null;
  const col = header.indexOf("证据源");
  const gates = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (isTableSeparator(cells)) continue;
    const evidence = cells[col] !== undefined ? cells[col] : cells[cells.length - 1];
    gates.push(String(evidence || ""));
  }
  return gates;
}

// 机械型证据判定：脚本命令与运行时守卫为机械型，指名代理为判断型；含任一机械型来源即计该门
function isMechanicalEvidence(evidence) {
  return /\bnode\b/.test(evidence) || /运行时守卫/.test(evidence);
}

// 度量九：机械证据覆盖率。从规范「质量门禁」节门禁表的证据源列判各门，含机械型证据源的门数除以门的总数，计门不计项；
// 规范文件按仓库内布局与安装后布局两处解析，两处均找不到时记空并说明
function computeMechanicalEvidenceCoverage(root) {
  const empty = { status: "unavailable", total: null, mechanical: null, ratio: null, source: null, notes: [] };
  const candidates = [path.join(root, ...SPEC_GATE_REL), SPEC_GATE_ABS];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) return { ...empty, source: SPEC_GATE_REL.join("/"), notes: [`规范门禁表未找到，已查仓库内布局 ${SPEC_GATE_REL.join("/")} 与安装后布局 references/spec-gate.md，机械证据覆盖率不可采集`] };
  const shown = file.split(path.sep).join("/");
  const gates = parseGateTable(readFileText(file));
  if (!gates) return { ...empty, source: shown, notes: [`${shown} 未解析到门禁表，机械证据覆盖率不可采集`] };
  const mechanical = gates.filter(isMechanicalEvidence).length;
  return { status: "ok", source: shown, total: gates.length, mechanical, ratio: Number((mechanical / gates.length).toFixed(4)), notes: [] };
}

module.exports = { REPORTS_DIR_REL, computeGates, computeReworkRounds, computeDefectLevels, computeDefectDensity, computeUnconsumedDeclarations, computeMechanicalEvidenceCoverage };
