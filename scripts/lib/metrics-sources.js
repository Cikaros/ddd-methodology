/**
 * 目标：脚本共享层的度量来源读取面，把 metrics-report 对产物的读取与取值收敛为唯一实现，供结构与债务类、交付质量与声明面类两域度量共用。
 * 范围：健康度量与登记簿两份 JSON 来源的读取、目录内按后缀取文件、机读 JSON 行解析、标记表收表与行拆分的四项表格原语，
 *   以及缺省取向的数值归一三项纯函数；来源缺失或不可解析时回传可判别的状态标记，由各域度量按自身口径记空，本模块不判失败。
 * 不包含：各度量的口径与计算（见 metrics-structure.js 与 metrics-delivery.js）、文本报告装配与产物落盘、命令行入口。不引入第三方依赖。
 */

const fs = require("fs");
const path = require("path");
const { readFileText } = require("./text.js");
// 产物路径取共享层单一常量，本模块只转发入参，不再复写路径字面量
const { HEALTH_REL, DEBT_BOOK_REL, artifactReadPath } = require("./paths.js");

// 缺省取向：非有限数值一律视为零，使早期条目缺字段时不判失败；num 与 isBlank 的唯一实现在 lib/text.js
const isMissingNumber = (v) => !(typeof v === "number" && Number.isFinite(v));

// 读健康度量历史：文件缺失即未启用，解析失败记原因后同样按不可采集处理
function readHealth(root) {
  const file = artifactReadPath(root, HEALTH_REL);
  if (!file) return { available: false, history: [] };
  try {
    const parsed = JSON.parse(readFileText(file));
    return { available: true, history: Array.isArray(parsed && parsed.history) ? parsed.history : [] };
  } catch (e) {
    return { available: true, history: [], parseError: `${HEALTH_REL} 无法解析：${e.message}` };
  }
}

// 读登记簿：文件缺失即未启用，解析失败或顶层形态非法记 invalid
function readDebts(root) {
  const file = artifactReadPath(root, DEBT_BOOK_REL);
  if (!file) return { available: false };
  try {
    const data = JSON.parse(readFileText(file));
    if (data === null || typeof data !== "object" || Array.isArray(data)) return { available: true, invalid: true };
    return { available: true, data };
  } catch (e) {
    return { available: true, invalid: true };
  }
}

// 目录读取：回传目录下匹配后缀的文件名与文本；目录缺失回 null，视为未启用，供交付质量类各度量共享
function readDirFiles(root, relDir, suffixRe) {
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

module.exports = { isMissingNumber, readHealth, readDebts, readDirFiles, readJsonLine, isTableSeparator, firstTableAfter };
