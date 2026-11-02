#!/usr/bin/env node
/**
 * 目标：把存量债务登记簿的结构齐备、总量上限与时效判定收敛为单个可机的文本结论，作为债务清偿门禁的独立证据源。
 * 范围：下列机械可判定事项——docs/debts.json 存在且 JSON 合法；顶层含 currentVersion、maxOpen、defaultDueSpan 与 debts 数组；
 *   id 在仓库内唯一；每条含 id、desc、registeredAt、owner、status、reason、rootCause、recurrence 且 owner 具名非空；registeredAt 形如 v主.次；
 *   rootCause 取根因分类之一；recurrence 含非负整数 count 与最近一次复发的版本 lastVersion，count 为零时 lastVersion 须为 null，否则形如 v主.次；
 *   dueBy 可省，省略时按 registeredAt 加 defaultDueSpan 推导应清版本，给出时须形如 v主.次；
 *   status 仅取 open 或 closed；未清项数不超 maxOpen；每个未清项的应清版本不早于 currentVersion。
 * 不包含：债务是否真被清偿、desc 与 reason 的合理性、连续两轮超期后的用户升级裁决，交由审计代理与根会话判定。
 * 用法：node debt-check.js <项目根>
 * 输出形态：文本正文，无空行；末行为机读结论
 * 末行机读结论：`RESULT: pass` 或 `RESULT: overdue`
 * 退出码：0 通过（含未启用），1 存在缺口（超期、超上限、字段不全或 JSON 非法）
 * 输出上限：12000 字节，按 UTF-8 字节计量；超限截断明细，末行结论保留完整
 * 未启用取向：docs/debts.json 不存在时视为未启用，输出说明并判通过，不报错，兼容既有项目
 * 版本比较：按 v主.次 解析为数值后比较，不做字符串比较，避免 v2.10 与 v2.9 误判
 * 依赖：文本读取取 ./lib/text.js 的 readFileText，本脚本不再内联读取实现
 * 规范依据：规范「存量债务的登记与清偿」节的登记、超期校验与上限三节
 */

const fs = require("fs");
const path = require("path");
// 读取失败回空串而非中断：登记簿读不到时仍走无效 JSON 分支给出结构化结论，消费端不以栈信息判读
const { readFileText } = require("./lib/text.js");

const root = process.argv[2] || process.cwd();
const DEBTS_REL = "docs/debts.json";
const debtsPath = path.join(root, ...DEBTS_REL.split("/"));

const REQUIRED_TOP = ["currentVersion", "maxOpen", "defaultDueSpan"];
// dueBy 可省：省略时由校验脚本按 registeredAt 加 defaultDueSpan 推导，故不入必填清单
const REQUIRED_ENTRY = ["id", "desc", "registeredAt", "owner", "status", "reason", "rootCause", "recurrence"];
const STATUSES = ["open", "closed"];
// 根因分类：与规范「存量债务的登记与清偿」节及债务模板的字段表同源，同一分类连续两版未清即须升级用户
const ROOT_CAUSES = ["声明与事实脱节", "单一权威被违背", "机械校验有盲区", "规则演进后消费方未同步", "反复修补同一处"];

// 版本解析：仅接受 v主.次，比较主次两段数值；缺失或不合形回 null
function parseVersion(value) {
  const m = /^v(\d+)\.(\d+)$/.exec(String(value == null ? "" : value).trim());
  return m ? { major: Number(m[1]), minor: Number(m[2]) } : null;
}

// 数值比较，避免字符串比较把 v2.10 误判为小于 v2.9
function compareVersion(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  return 0;
}

// 版本推进：仅在次段加跨度，与既有两轮语义同源，不引入新的阈值体系
function addSpan(v, span) {
  return { major: v.major, minor: v.minor + span };
}

function formatVersion(v) {
  return `v${v.major}.${v.minor}`;
}

const isBlank = (v) => v === undefined || v === null || v === "";

// 校验：回传缺口明细；文件不存在即未启用，明细为空
function check() {
  if (!fs.existsSync(debtsPath)) return { enabled: false, reasons: [], openCount: 0 };
  const reasons = [];

  let data;
  try {
    data = JSON.parse(readFileText(debtsPath));
  } catch (e) {
    reasons.push(`${DEBTS_REL} 非法 JSON：${e.message}`);
    return { enabled: true, reasons, openCount: 0 };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    reasons.push(`${DEBTS_REL} 顶层须为对象`);
    return { enabled: true, reasons, openCount: 0 };
  }

  const missingTop = REQUIRED_TOP.filter((key) => isBlank(data[key]));
  if (isBlank(data.debts) || !Array.isArray(data.debts)) missingTop.push("debts");
  if (missingTop.length) reasons.push(`${DEBTS_REL} 顶层缺失或非法字段：${missingTop.join("、")}`);

  const current = parseVersion(data.currentVersion);
  if (!isBlank(data.currentVersion) && current === null) {
    reasons.push(`${DEBTS_REL} currentVersion 非法（须形如 v主.次）：${JSON.stringify(data.currentVersion)}`);
  }
  const maxOpen = typeof data.maxOpen === "number" && Number.isFinite(data.maxOpen) ? data.maxOpen : null;
  if (!isBlank(data.maxOpen) && maxOpen === null) {
    reasons.push(`${DEBTS_REL} maxOpen 非法（须为有限数值）：${JSON.stringify(data.maxOpen)}`);
  }
  const dueSpan = typeof data.defaultDueSpan === "number" && Number.isFinite(data.defaultDueSpan) ? data.defaultDueSpan : null;
  if (!isBlank(data.defaultDueSpan) && dueSpan === null) {
    reasons.push(`${DEBTS_REL} defaultDueSpan 非法（须为有限数值）：${JSON.stringify(data.defaultDueSpan)}`);
  }

  const debts = Array.isArray(data.debts) ? data.debts : [];
  // id 仓库内唯一：同名 id 出现两次及以上即报缺口
  const idCounts = new Map();
  for (const entry of debts) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || isBlank(entry.id)) continue;
    idCounts.set(entry.id, (idCounts.get(entry.id) || 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) reasons.push(`${DEBTS_REL} id 不唯一：${JSON.stringify(id)} 出现 ${count} 次，仓库内须唯一`);
  }
  let openCount = 0;
  debts.forEach((entry, index) => {
    const label = entry && typeof entry === "object" && entry.id ? entry.id : `第 ${index + 1} 条`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      reasons.push(`${DEBTS_REL} ${label} 不是对象`);
      return;
    }
    const missing = REQUIRED_ENTRY.filter((key) => isBlank(entry[key]));
    if (missing.length) reasons.push(`${DEBTS_REL} ${label} 缺失字段：${missing.join("、")}`);
    if (typeof entry.owner === "string" && entry.owner !== "" && entry.owner.trim() === "") {
      reasons.push(`${DEBTS_REL} ${label} owner 仅含空白，须具名承接`);
    }
    if (!isBlank(entry.status) && !STATUSES.includes(entry.status)) {
      reasons.push(`${DEBTS_REL} ${label} status 非法（仅取 open 或 closed）：${JSON.stringify(entry.status)}`);
    }
    if (!isBlank(entry.rootCause) && !ROOT_CAUSES.includes(entry.rootCause)) {
      reasons.push(`${DEBTS_REL} ${label} rootCause 非法（须取根因分类之一）：${JSON.stringify(entry.rootCause)}`);
    }
    // 复发记录：count 为零时无复发版本，lastVersion 须为 null；count 大于零时须给出形如 v主.次 的最近复发版本
    if (!isBlank(entry.recurrence)) {
      const rec = entry.recurrence;
      if (typeof rec !== "object" || rec === null || Array.isArray(rec)) {
        reasons.push(`${DEBTS_REL} ${label} recurrence 非法（须为含 count 与 lastVersion 的对象）：${JSON.stringify(rec)}`);
      } else {
        if (!Number.isInteger(rec.count) || rec.count < 0) {
          reasons.push(`${DEBTS_REL} ${label} recurrence.count 非法（须为非负整数）：${JSON.stringify(rec.count)}`);
        } else if (rec.count === 0) {
          if (rec.lastVersion !== null) reasons.push(`${DEBTS_REL} ${label} recurrence.lastVersion 在复发次数为零时须为 null：${JSON.stringify(rec.lastVersion)}`);
        } else if (parseVersion(rec.lastVersion) === null) {
          reasons.push(`${DEBTS_REL} ${label} recurrence.lastVersion 非法（复发次数大于零时须形如 v主.次）：${JSON.stringify(rec.lastVersion)}`);
        }
      }
    }
    const registered = parseVersion(entry.registeredAt);
    if (!isBlank(entry.registeredAt) && registered === null) {
      reasons.push(`${DEBTS_REL} ${label} registeredAt 非法（须形如 v主.次）：${JSON.stringify(entry.registeredAt)}`);
    }
    // dueBy 可省：省略时按 registeredAt 加 defaultDueSpan 推导应清版本，给出时须形如 v主.次
    let due = null;
    let derived = null;
    if (isBlank(entry.dueBy)) {
      if (registered !== null && dueSpan !== null) derived = addSpan(registered, dueSpan);
    } else {
      due = parseVersion(entry.dueBy);
      if (due === null) reasons.push(`${DEBTS_REL} ${label} dueBy 非法（须形如 v主.次）：${JSON.stringify(entry.dueBy)}`);
    }
    if (entry.status !== "open") return;
    openCount++;
    const effectiveDue = due || derived;
    if (effectiveDue && current && compareVersion(effectiveDue, current) < 0) {
      const shown = derived ? `推导 ${formatVersion(derived)}` : entry.dueBy;
      reasons.push(`${DEBTS_REL} ${label} 超期：dueBy ${shown} 早于 currentVersion ${data.currentVersion}`);
    }
  });

  if (maxOpen !== null && openCount > maxOpen) {
    reasons.push(`${DEBTS_REL} 未清项 ${openCount} 项，超过 maxOpen ${maxOpen}`);
  }
  return { enabled: true, reasons, openCount, currentVersion: data.currentVersion, maxOpen };
}

const LIMIT_BYTES = 12000;

// 输出：明细行在前、末行结论在后，整体不含空行；超限按整行截断明细并追加计数行，末行结论始终保留
function emit(detailLines, resultLine) {
  const size = (arr) => Buffer.byteLength(arr.join("\n"), "utf8");
  const pack = (kept) => {
    const out = detailLines.slice(0, kept);
    if (kept < detailLines.length) out.push(`明细超 ${LIMIT_BYTES} 字节上限，已截断（共 ${detailLines.length} 项，已列 ${kept} 项）`);
    out.push(resultLine);
    return out;
  };
  if (size(pack(detailLines.length)) <= LIMIT_BYTES) return pack(detailLines.length).join("\n");
  let lo = 0;
  let hi = detailLines.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (size(pack(mid)) <= LIMIT_BYTES) lo = mid;
    else hi = mid - 1;
  }
  return pack(lo).join("\n");
}

const { enabled, reasons, openCount, currentVersion, maxOpen } = check();
const blocked = enabled && reasons.length > 0;
let lines;
if (!enabled) lines = [`未启用债务登记簿：未找到 ${DEBTS_REL}，视为未启用该机制`];
else if (blocked) lines = reasons.map((r) => `[缺口] ${r}`);
else lines = [`债务登记簿校验通过：${DEBTS_REL}，currentVersion ${currentVersion}，未清 ${openCount} 项，上限 ${maxOpen}`];

process.stdout.write(emit(lines, blocked ? "RESULT: overdue" : "RESULT: pass") + "\n");
process.exit(blocked ? 1 : 0);
