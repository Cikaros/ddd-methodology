#!/usr/bin/env node
/**
 * 目标：把结构趋势、债务时效与根因复发三类度量从既有产物机械聚合为文本报告与结构化产物，作为绩效度量中结构与债务类的采集入口。
 * 范围：读 docs/health.json 与 docs/debts.json，按规范「绩效度量」节 18.2 口径计算三项——超阈值文件数趋势、债务未清数与超期率、
 *   同一根因复发次数；文本报告末行为机读结论，结构化产物写入 docs/metrics.json，根会话据其输出写入 CHANGELOG。
 * 不包含：门禁判定（本脚本恒退出 0，仅报告）、源产物本身的生成、语义级判断。
 * 用法：node metrics-report.js <项目根>
 * 输出形态：文本正文，末行机读结论
 * 末行机读结论：`RESULT: report`
 * 退出码：恒 0，仅报告，不作门禁
 * 输出上限：12000 字节，按 UTF-8 字节计量；超限截断明细，末行结论保留完整
 * 未启用取向：docs/health.json 或 docs/debts.json 缺失时相应度量记空并输出说明，判通过，兼容未启用项目
 * 缺省取向：health.json 早期条目缺字段时按缺省值零处理，并在产物中标注，不判失败
 * 依赖：文本读取取 ./lib/text.js 的 readFileText，版本比较取 ./lib/version.js，本脚本不再内联这两处实现
 * 规范依据：规范「绩效度量」节的 18.2 结构与债务类度量
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

const health = readHealth();
const debts = readDebts();
const trend = computeTrend(health);
const debt = computeDebt(debts);
const recurrence = computeRecurrence(debts);
const currentVersion = debts.available && !debts.invalid && !isBlank(debts.data.currentVersion) ? debts.data.currentVersion : null;
const notes = [...trend.notes, ...debt.notes, ...recurrence.notes];

const payload = {
  at: new Date().toISOString(),
  currentVersion,
  thresholdFilesTrend: trend,
  debt,
  recurrence,
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
