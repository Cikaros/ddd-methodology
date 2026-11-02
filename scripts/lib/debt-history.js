/**
 * 目标：把存量债务的版本快照与根因复发检测外置为共享层模块，供 debt-check 维护 docs/debt-history.json 并输出复发段落。
 * 范围：快照的读取、按版本新增或就地更新、历史上限截断与落盘，以及「上一版本已有未清项且当前版本新增登记同根因条目」的机械复发检测。
 * 不包含：登记簿结构校验（见顶层 debt-check.js）、recurrence 字段的语义判定、复发后的用户升级裁决（由根会话与审计代理承接）、命令行入口。不引入第三方依赖。
 * 版本比较取 ./version.js，与 debt-check、metrics-report 共用同一实现。
 */

const fs = require("fs");
const path = require("path");
const { readFileText } = require("./text.js");
const { parseVersion, compareVersion } = require("./version.js");
// 产物路径取共享层单一常量，本模块不再复写路径字面量
const { DEBT_HISTORY_REL, resolveRel } = require("./paths.js");

const SNAPSHOT_LIMIT = 50; // 与健康度量产物同口径：历史上限五十条，超出截断

// 读取历史：文件缺失或非法一律回空数组，读失败不得中断债务校验
function readHistory(root) {
  const file = resolveRel(root, DEBT_HISTORY_REL);
  try {
    const parsed = JSON.parse(readFileText(file));
    return parsed && Array.isArray(parsed.history) ? parsed.history : [];
  } catch (e) {
    return [];
  }
}

// 条目摘要：只留编号、根因分类、状态、登记版本与应清版本五字段，快照不承载描述与理由
function summarize(entry, dueBy) {
  return {
    id: entry.id,
    rootCause: entry.rootCause,
    status: entry.status,
    registeredAt: entry.registeredAt,
    dueBy: dueBy || null,
  };
}

// 按版本新增或就地更新：同版本已存在则原地替换，同一版本重复运行不产生重复条目
function upsertSnapshot(history, version, entries, at) {
  const snapshot = { at, version, entries };
  const index = history.findIndex((item) => item && item.version === version);
  if (index >= 0) {
    const next = history.slice();
    next[index] = snapshot;
    return next;
  }
  return history.concat(snapshot);
}

// 历史上限：超出取末尾若干条，与健康度量产物口径一致
function capHistory(history, limit = SNAPSHOT_LIMIT) {
  return history.length > limit ? history.slice(-limit) : history;
}

// 落盘：目录不存在时建出，产物形态固定为含 history 数组的对象
function saveHistory(root, history) {
  const file = resolveRel(root, DEBT_HISTORY_REL);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ history }, null, 2) + "\n");
}

// 上一版本快照：取版本严格早于当前版本中最新的一条；无可比快照时回 null
function previousSnapshot(history, currentVersion) {
  const current = parseVersion(currentVersion);
  if (current === null) return null;
  let best = null;
  for (const item of history) {
    const version = item && parseVersion(item.version);
    if (version === null || compareVersion(version, current) >= 0) continue;
    if (best === null || compareVersion(version, parseVersion(best.version)) > 0) best = item;
  }
  return best;
}

// 复发检测：上一版本快照中已有未清项的根因分类，若当前版本新增登记的债务含同根因条目，即判该根因复发
function detectRecurrence(history, currentVersion, summaries) {
  const prev = previousSnapshot(history, currentVersion);
  if (!prev) return [];
  const openRoots = new Set((prev.entries || []).filter((item) => item && item.status === "open").map((item) => item.rootCause));
  if (!openRoots.size) return [];
  const newByRoot = new Map();
  for (const item of summaries) {
    if (item.registeredAt !== currentVersion || !openRoots.has(item.rootCause)) continue;
    if (!newByRoot.has(item.rootCause)) newByRoot.set(item.rootCause, []);
    newByRoot.get(item.rootCause).push(item.id);
  }
  const found = [];
  for (const [rootCause, ids] of newByRoot) {
    found.push({ rootCause, entries: ids, fromVersion: prev.version, toVersion: currentVersion });
  }
  return found;
}

module.exports = { readHistory, summarize, upsertSnapshot, capHistory, saveHistory, detectRecurrence };
