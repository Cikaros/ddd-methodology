/**
 * 目标：把 DESIGN 契约表与代码侧的签名比对收敛为三态判定——一致、不一致、无法判定——并把语言的推导方式定为唯一实现。
 * 范围：契约表读取、由「消费方模块」列扩展名推导语言、逐行三态比对。
 * 不包含：解析器供给（见 span-parser.js）、提取（见 span-extract.js）、命令行装配与输出（见 scripts/span-check.js）。
 * 排除列：「错误语义」与「时序依赖与副作用」两列必须排除。语法层只能部分推断 `throws`、`Result<T,E>`、`(T, error)`，不等价，
 *   强行核对会使判据本身不可满足，故这两列不进入比对。
 */

const fs = require("fs");
const path = require("path");
const { extractFile, extractSignature } = require("./span-extract.js");

// 语言推导的单一实现：扩展名到语言标识；本表也是规范「对外接口的语言约定」节语言推导方式的实现
const EXT_LANGUAGE = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  java: "java",
  go: "go",
  rs: "rust",
};

// 二级标题锚定：标题允许序号前缀，与 trace-check 的口径一致
function sectionBody(text, title) {
  const match = String(text).match(new RegExp(`##\\s*(?:[一二三四五六七八九十\\d]+[、.．]?\\s*)?${title}[^\\n]*([\\s\\S]*?)(?=\\n## |$)`));
  return match && match[1] ? match[1] : null;
}

// 表格解析：取首个表头命中 headerRe 的表格，跳过分隔行，遇非表行即止
function readTable(text, headerRe) {
  const lines = String(text).split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    const headers = lines[i].split("|").slice(1, -1).map((cell) => cell.trim());
    if (!headers.some((header) => headerRe.test(header))) continue;
    const rows = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim().startsWith("|")) break;
      const row = lines[j].split("|").slice(1, -1).map((cell) => cell.trim());
      if (row.every((cell) => /^[-:\s]*$/.test(cell))) continue;
      rows.push(row);
    }
    return { headers, rows };
  }
  return null;
}

// 契约表读取：锚定「对外接口与约定」节，取其中表头含「接口」的表格，回传逐行的接口名、签名与消费方三列
function readContractTable(designText) {
  const section = sectionBody(designText, "对外接口与约定");
  const table = readTable(section || designText, /接口/);
  if (!table) return null;
  const col = (re) => table.headers.findIndex((header) => re.test(header));
  const nameIdx = col(/接口名|接口/);
  const sigIdx = col(/签名/);
  const consumerIdx = col(/消费方/);
  if (sigIdx < 0) return null;
  return table.rows.map((row, index) => ({
    line: index + 1,
    interfaceName: nameIdx >= 0 ? (row[nameIdx] || "").replace(/`/g, "").trim() : "",
    signature: sigIdx >= 0 ? (row[sigIdx] || "").replace(/`/g, "").trim() : "",
    consumer: consumerIdx >= 0 ? row[consumerIdx] || "" : "",
  }));
}

// 语言推导：由「消费方模块」列所指文件的扩展名推导；列空、取值非唯一、为逻辑模块名或指向非文件者均报无法判定
function deriveLanguage(root, consumerCell) {
  const raw = String(consumerCell || "").replace(/`/g, "").trim();
  if (!raw) return { ok: false, reason: "该行无「消费方模块」列或该列为空，语言无法推导" };
  const tokens = raw.split(/[、,，;；\s]+/).filter(Boolean);
  if (tokens.length !== 1) return { ok: false, reason: `「消费方模块」列为多个取值（${raw}），语言无法唯一推导` };
  const value = tokens[0];
  if (!/[\\/.]/.test(value)) return { ok: false, reason: `「消费方模块」列「${value}」为逻辑模块名而非文件路径，语言无法推导` };
  const abs = path.isAbsolute(value) ? value : path.join(root, value);
  let stat = null;
  try { stat = fs.statSync(abs); } catch (e) { stat = null; }
  if (!stat || !stat.isFile()) return { ok: false, reason: `「消费方模块」列指向的不是项目根下的文件：${value}` };
  const ext = path.extname(value).replace(/^\./, "").toLowerCase();
  const language = EXT_LANGUAGE[ext];
  if (!language) return { ok: false, reason: `由扩展名 .${ext} 推导不出首期支持的语言` };
  return { ok: true, language, file: value, abs };
}

const canon = (value) => String(value || "").replace(/\s+/g, "");

// 逐行三态：语言或提取无法判定即判无法判定；比对形参与返回标注的规范化文本，相符判一致，不符判不一致
async function compareRow(root, row) {
  const language = deriveLanguage(root, row.consumer);
  if (!language.ok) return { state: "无法判定", reason: language.reason };
  const code = await extractFile(language.abs, language.language);
  if (!code.ok) return { state: "无法判定", reason: code.reason };
  const design = await extractSignature(row.signature, language.language);
  if (!design.ok) return { state: "无法判定", reason: design.reason };
  const target = row.interfaceName || design.symbol.name;
  const candidates = code.symbols.filter((symbol) => symbol.name === target || symbol.name === design.symbol.name);
  if (!candidates.length) return { state: "不一致", reason: `代码侧 ${language.file} 未导出接口「${target}」` };
  const want = `${canon(design.symbol.params)}|${canon(design.symbol.returns)}`;
  const matched = candidates.find((symbol) => `${canon(symbol.params)}|${canon(symbol.returns)}` === want);
  if (matched) return { state: "一致", detail: `${target}${design.symbol.params}${design.symbol.returns ? ` -> ${design.symbol.returns}` : ""}` };
  const got = candidates[0];
  return { state: "不一致", reason: `「${target}」签名不符：设计 ${design.symbol.params}${design.symbol.returns ? ` -> ${design.symbol.returns}` : ""}；代码 ${got.params}${got.returns ? ` -> ${got.returns}` : ""}` };
}

module.exports = { readContractTable, deriveLanguage, compareRow, EXT_LANGUAGE };
