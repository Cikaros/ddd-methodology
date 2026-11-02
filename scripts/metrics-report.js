#!/usr/bin/env node
/**
 * 目标：把结构趋势、债务时效、根因复发、交付质量与声明面五类度量从既有产物机械聚合为文本报告与结构化产物，作为绩效度量的机械采集入口。
 * 范围：读 docs/health.json 与 docs/debts.json，按规范「绩效度量」节 18.2 口径计算三项——超阈值文件数趋势、债务未清数与超期率、
 *   同一根因复发次数；读 docs/gates/ 与 docs/reports/，按 18.1 口径计算四项——八道门一次通过率与过门轮次、返工轮次分布、缺陷四级分布与缺陷密度；
 *   读 docs/audits/ 与规范「质量门禁」节门禁表，按 18.3 口径计算两项——无消费方声明占比与机械证据覆盖率；
 *   文本报告末行为机读结论，结构化产物写入 docs/metrics.json，根会话据其输出写入 CHANGELOG。
 * 交付质量来源：门禁记录取各记录内的 GATE 机读行，缺陷路由单取轮回计数与判定级别字段，测试报告取末行 DEFECTS 机读行；来源目录缺失或字段不全时相应度量记空并说明。
 * 声明面来源：无消费方声明占比取 docs/audits/ 下最新一份审计报告的逐项审计表，机械证据覆盖率取规范「质量门禁」节门禁表的证据源列；两者来源缺失或不可解析时记空并说明。
 * 不包含：门禁判定（本脚本恒退出 0，仅报告）、源产物本身的生成、语义级判断。
 * 用法：node metrics-report.js <项目根>
 * 输出形态：文本正文，末行机读结论
 * 末行机读结论：`RESULT: report`
 * 退出码：恒 0，仅报告，不作门禁
 * 输出上限：12000 字节，按 UTF-8 字节计量；超限截断明细，末行结论保留完整
 * 未启用取向：docs/health.json 或 docs/debts.json 缺失时相应度量记空并输出说明，判通过，兼容未启用项目
 * 缺省取向：health.json 早期条目缺字段时按缺省值零处理，并在产物中标注，不判失败
 * 依赖：文本读取取 ./lib/text.js 的 readFileText，版本比较取 ./lib/version.js，本脚本不再内联这两处实现
 * 规范依据：规范「绩效度量」节的 18.1 交付质量类、18.2 结构与债务类与 18.3 声明面类度量
 */

const fs = require("fs");
const path = require("path");
const { readFileText } = require("./lib/text.js");
const { parseVersion, compareVersion, addSpan } = require("./lib/version.js");

const root = process.argv[2] || process.cwd();
const HEALTH_REL = "docs/health.json";
const DEBT_BOOK_REL = "docs/debts.json";
const METRICS_REL = "docs/metrics.json";
const METRICS_LIMIT_BYTES = 12000;
// 交付质量类来源目录：门禁记录与测试报告归档；门的总数固定为八，即 G1、G2、G3、G4、G4.5、G5、G5-INT、G6
const GATES_DIR_REL = "docs/gates";
const REPORTS_DIR_REL = "docs/reports";
const AUDITS_DIR_REL = "docs/audits";
const GATE_TOTAL = 8;
// 规范门禁表的两种解析布局：仓库内布局与安装后布局，相对调用脚本自身定位
const SPEC_GATE_REL = ["skill", "ddd-methodology", "references", "spec-gate.md"];
const SPEC_GATE_ABS = path.resolve(__dirname, "..", "references", "spec-gate.md");
// 无消费方声明占比的分子：逐项审计表结论中的三类问题取值，其余取值视为有效不计入分子
const PROBLEMATIC_CONCLUSIONS = ["无消费方", "纸面消费方", "消费不正确"];

// 缺省取向：非有限数值一律视为零，使早期条目缺字段时不判失败
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const isMissingNumber = (v) => !(typeof v === "number" && Number.isFinite(v));
const isBlank = (v) => v === undefined || v === null || v === "";

// 读健康度量历史：文件缺失即未启用，解析失败记原因后同样按不可采集处理
function readHealth() {
  const file = path.join(root, ...HEALTH_REL.split("/"));
  if (!fs.existsSync(file)) return { available: false, history: [] };
  try {
    const parsed = JSON.parse(readFileText(file));
    return { available: true, history: Array.isArray(parsed && parsed.history) ? parsed.history : [] };
  } catch (e) {
    return { available: true, history: [], parseError: `${HEALTH_REL} 无法解析：${e.message}` };
  }
}

// 读登记簿：文件缺失即未启用，解析失败或顶层形态非法记 invalid
function readDebts() {
  const file = path.join(root, ...DEBT_BOOK_REL.split("/"));
  if (!fs.existsSync(file)) return { available: false };
  try {
    const data = JSON.parse(readFileText(file));
    if (data === null || typeof data !== "object" || Array.isArray(data)) return { available: true, invalid: true };
    return { available: true, data };
  } catch (e) {
    return { available: true, invalid: true };
  }
}

// 度量一：超阈值文件数趋势。取历史末三条，超阈值文件数按源码超限与文档超限之和计；缺字段条目按缺省零处理并标注
function computeTrend(health) {
  if (!health.available) {
    return { status: "unavailable", samples: 0, window: [], latest: null, previous: null, delta: null, notes: [`${HEALTH_REL} 缺失，超阈值文件数趋势不可采集`] };
  }
  if (health.parseError) {
    return { status: "unavailable", samples: 0, window: [], latest: null, previous: null, delta: null, notes: [health.parseError] };
  }
  const history = health.history;
  if (!history.length) {
    return { status: "unavailable", samples: 0, window: [], latest: null, previous: null, delta: null, notes: [`${HEALTH_REL} 无历史条目，超阈值文件数趋势不可采集`] };
  }
  const notes = [];
  const start = Math.max(0, history.length - 3);
  const window = history.slice(start).map((entry, i) => {
    const index = start + i;
    const missing = [];
    if (!entry || typeof entry !== "object") {
      missing.push("oversized", "docOversized");
    } else {
      if (isMissingNumber(entry.oversized)) missing.push("oversized");
      if (isMissingNumber(entry.docOversized)) missing.push("docOversized");
    }
    if (missing.length) notes.push(`${HEALTH_REL} 第 ${index + 1} 条缺字段 ${missing.join("、")}，按缺省零处理`);
    const srcOversized = entry && typeof entry === "object" ? num(entry.oversized) : 0;
    const docOversizedCount = entry && typeof entry === "object" ? num(entry.docOversized) : 0;
    return { index, oversized: srcOversized, docOversized: docOversizedCount, thresholdFiles: srcOversized + docOversizedCount };
  });
  const latest = window[window.length - 1].thresholdFiles;
  if (window.length < 2) {
    return { status: "insufficient", samples: window.length, window, latest, previous: null, delta: null, notes };
  }
  const previous = window[window.length - 2].thresholdFiles;
  return { status: "ok", samples: window.length, window, latest, previous, delta: latest - previous, notes };
}

// 度量二：债务未清数与超期率。未清数按 status 计；超期率按未清项中应清版本早于当前版本的占比计
function computeDebt(debts) {
  if (!debts.available) {
    return { status: "unavailable", openCount: null, overdueCount: null, overdueRate: null, notes: [`${DEBT_BOOK_REL} 缺失，债务未清数与超期率不可采集`] };
  }
  if (debts.invalid) {
    return { status: "invalid", openCount: null, overdueCount: null, overdueRate: null, notes: [`${DEBT_BOOK_REL} 非法 JSON，债务未清数与超期率不可采集`] };
  }
  const data = debts.data;
  const list = Array.isArray(data.debts) ? data.debts : [];
  const current = parseVersion(data.currentVersion);
  const span = typeof data.defaultDueSpan === "number" && Number.isFinite(data.defaultDueSpan) ? data.defaultDueSpan : null;
  let openTotal = 0;
  let overdueCount = 0;
  const notes = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    if (entry.status !== "open") continue;
    openTotal++;
    // dueBy 可省：省略时按 registeredAt 加 defaultDueSpan 推导应清版本；推导不出应清版本时不判超期
    let due = null;
    if (isBlank(entry.dueBy)) {
      const registeredVersion = parseVersion(entry.registeredAt);
      if (registeredVersion !== null && span !== null) due = addSpan(registeredVersion, span);
    } else {
      due = parseVersion(entry.dueBy);
    }
    if (due && current && compareVersion(due, current) < 0) overdueCount++;
  }
  if (current === null) notes.push(`${DEBT_BOOK_REL} 的 currentVersion 非法或缺失，超期率按无当前版本处理`);
  const overdueRate = openTotal ? Number((overdueCount / openTotal).toFixed(4)) : 0;
  return { status: "ok", openCount: openTotal, overdueCount, overdueRate, notes };
}

// 度量三：同一根因复发次数。按 rootCause 分类汇总 recurrence.count，取合计与最大值
function computeRecurrence(debts) {
  if (!debts.available || debts.invalid) {
    const reason = debts.available ? `${DEBT_BOOK_REL} 非法 JSON，根因复发次数不可采集` : `${DEBT_BOOK_REL} 缺失，根因复发次数不可采集`;
    return { status: "unavailable", total: null, max: null, maxRootCause: null, byRootCause: {}, notes: [reason] };
  }
  const list = Array.isArray(debts.data.debts) ? debts.data.debts : [];
  const byRootCause = {};
  let total = 0;
  for (const entry of list) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const key = typeof entry.rootCause === "string" && entry.rootCause ? entry.rootCause : "未标注根因";
    const rec = entry.recurrence;
    const count = rec && Number.isInteger(rec.count) && rec.count >= 0 ? rec.count : 0;
    byRootCause[key] = (byRootCause[key] || 0) + count;
    total += count;
  }
  let max = 0;
  let maxRootCause = null;
  for (const [key, value] of Object.entries(byRootCause)) {
    if (value > max) { max = value; maxRootCause = key; }
  }
  return { status: "ok", total, max, maxRootCause, byRootCause, notes: [] };
}

// 目录读取：回传目录下匹配后缀的文件名与文本；目录缺失回 null，视为未启用，供交付质量类各度量共享
function readDirFiles(relDir, suffixRe) {
  const dir = path.join(root, ...relDir.split("/"));
  let names; try { names = fs.readdirSync(dir); } catch (e) { return null; }
  return names.filter((name) => suffixRe.test(name)).map((name) => ({ name, text: readFileText(path.join(dir, name)) }));
}

// 机读 JSON 行：形如 NAME: {...}，解析失败回 null；门禁记录取 GATE，缺陷四级分布回退取 DEFECTS
function readJsonLine(text, name) {
  const m = String(text || "").match(new RegExp(`${name}:\\s*\\{([\\s\\S]*?)\\}`));
  if (!m) return null;
  try { return JSON.parse(`{${m[1]}}`); } catch (e) { return null; }
}

// 度量四：八道门一次通过率与过门轮次。读 docs/gates/ 各记录的 GATE 机读行；首轮即通过的门数除以八
function computeGates() {
  const files = readDirFiles(GATES_DIR_REL, /\.md$/);
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

// 表格行拆分：去首尾竖线后按竖线切分并逐格去空白，供审计表与门禁表共用
function splitTableRow(line) {
  return String(line).trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

// 表分隔行：各格为若干短横可与冒号组成的对齐标记
function isTableSeparator(cells) {
  return cells.length > 0 && cells.every((cell) => cell === "" || /^:?-{2,}:?$/.test(cell));
}

// 定位首个满足条件的节标题后首张表，回传其全部行（首行为表头）；审计表与门禁表共用同一收表口径
function firstTableAfter(lines, headingRe) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) if (headingRe.test(lines[i])) { start = i; break; }
  if (start < 0) return null;
  let tableStart = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    if (/^\s*\|/.test(lines[i])) { tableStart = i; break; }
  }
  if (tableStart < 0) return null;
  const rows = [];
  for (let i = tableStart; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i])) break;
    rows.push(splitTableRow(lines[i]));
  }
  return rows.length >= 2 ? rows : null;
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
function computeUnconsumedDeclarations() {
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
function computeMechanicalEvidenceCoverage() {
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

const health = readHealth();
const debts = readDebts();
const trend = computeTrend(health);
const debt = computeDebt(debts);
const recurrence = computeRecurrence(debts);
const reportFiles = readDirFiles(REPORTS_DIR_REL, /\.md$/);
const gates = computeGates();
const reworkRounds = computeReworkRounds(reportFiles);
const defectLevels = computeDefectLevels(reportFiles);
const defectDensity = computeDefectDensity(health, defectLevels);
const unconsumedDeclarations = computeUnconsumedDeclarations();
const mechanicalEvidenceCoverage = computeMechanicalEvidenceCoverage();
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
