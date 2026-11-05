/**
 * 目标：脚本共享层的结构与债务类度量，按规范「绩效度量」节的结构与债务类口径计算三项——超阈值文件数趋势、债务未清数与超期率、同一根因复发次数。
 * 范围：基于已读取的健康度量与登记簿数据计算——趋势取历史末三条的源码与文档超限之和、超期按未清项应清版本与当前版本比较、复发按根因分类汇总复发计数；
 *   数据缺失或字段不全时相应度量记空并给出说明，不改口径、不判失败。
 * 不包含：来源读取原语（见 metrics-sources.js）、交付质量类与声明面类度量（见 metrics-delivery.js）、文本报告装配与产物落盘、命令行入口。不引入第三方依赖。
 */

const { HEALTH_REL, DEBT_BOOK_REL, num, isMissingNumber, isBlank } = require("./metrics-sources.js");
const { parseVersion, compareVersion, addSpan } = require("./version.js");

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

module.exports = { computeTrend, computeDebt, computeRecurrence };
