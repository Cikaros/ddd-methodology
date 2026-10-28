/**
 * 契约指纹的唯一代码实现，供 trace-check.js 与 governance-check.js 共用。
 *
 * 算法权威在 skill/ddd-methodology/references/spec.md §16，本文件只是其可执行形态；
 * 三处口径若不一致即为漂移缺陷，故禁止在调用方重复实现。
 * 不包含：契约内容的语义校验、变更类型判定与用例集合方向判定。
 */

const crypto = require("crypto");

const CONTRACT_SECTION_RE = /(##\s*(?:[一二三四五六七八九十\d]+[、.．]?\s*)?对外接口与约定[^\n]*)([\s\S]*?)(?=\n## |$)/;
const FINGERPRINT_LINE_RE = /^\s*契约指纹\s*[：:]/;

function computeFingerprint(text) {
  const m = text.match(CONTRACT_SECTION_RE);
  if (!m) return null;
  const lines = (m[1] + m[2])
    .split("\n")
    .filter((l) => !FINGERPRINT_LINE_RE.test(l))
    .map((l) => l.trim());
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return crypto.createHash("sha256").update(lines.join("\n"), "utf8").digest("hex").slice(0, 8);
}

// 记录值取自形如 `契约指纹：`xxxxxxxx`` 的行；无该行返回 null，行存在但取不到码点返回空串
function extractRecorded(text) {
  const line = text.split("\n").find((l) => FINGERPRINT_LINE_RE.test(l));
  if (line === undefined) return null;
  const m = line.match(/`([^`]*)`/);
  return m ? m[1].trim() : "";
}

function isWellFormedFingerprint(v) {
  return typeof v === "string" && /^[0-9a-fA-F]+$/.test(v) && v.length >= 8;
}

// 校验一份 DESIGN 文本的契约指纹，通过返回 null，否则返回问题描述
function checkContractFingerprint(text) {
  const recorded = extractRecorded(text);
  if (!isWellFormedFingerprint(recorded)) return "契约指纹缺失或不足 8 位十六进制";
  const actual = computeFingerprint(text);
  if (actual === null) return "契约指纹无法复算：缺少「对外接口与约定」节";
  if (actual !== recorded.toLowerCase()) return `契约指纹不符：实算 ${actual}，记录 ${recorded.toLowerCase()}`;
  return null;
}

module.exports = { checkContractFingerprint };
