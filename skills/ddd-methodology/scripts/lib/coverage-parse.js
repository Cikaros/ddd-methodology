/**
 * 目标：为统一覆盖率解析提供无副作用核心——把 Cobertura 兼容 XML 归一为行覆盖率判定，并让报告缺失、报告不可解析、覆盖率未达阈三态各有明确结论，不得静默通过。
 * 范围：DEFAULT_THRESHOLD 常量，parseCobertura 与 evaluateCoverage 两个纯函数。
 * 不包含：文件读取、命令行入口与文本输出（见同目录 ../coverage-check.js）；不依赖任何具体语言工具，只认 Cobertura 兼容 XML 一种入参形态。
 * 依据：DESIGN-test-baseline.md 第三、五、六节；阈值默认 80%，可由参数覆盖。
 */

// 默认阈值：与 DESIGN-test-baseline.md 第六节一致，取 80%，可被参数覆盖；spec-test-case 的覆盖判据须与此同值
const DEFAULT_THRESHOLD = 80;

// 属性抽取：标签文本内取指定属性值，无则回 null；行元素与根元素共用，不两处各写一套
function attr(tag, name) {
  const m = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? m[1] : null;
}

// 数值属性：属性缺失或非有限数回 null，区别于 0，免得把「无此属性」当成「值为零」
function numericAttr(tag, name) {
  const value = attr(tag, name);
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Cobertura 解析（纯函数）：命中根元素后按两级取数——行元素逐条计 hits 为多包聚合的唯一口径；
// 行元素缺席时退回根元素的 lines-valid / lines-covered，再退回 line-rate 分率；三者皆无即回 null，交调用方判为不可解析。
// \b 使 <line> 不误取 <lines> 容器；根元素未自闭合时须见闭合标签，否则视为结构不完整
function parseCobertura(text) {
  const source = String(text == null ? "" : text);
  const root = source.match(/<coverage\b([^>]*?)(\/?)>/i);
  if (!root) return null;
  if (root[2] !== "/" && !/<\/coverage>/i.test(source)) return null;
  const lines = [...source.matchAll(/<line\b[^>]*?(\/?)>/gi)];
  if (lines.length) {
    let covered = 0;
    for (const line of lines) if (numericAttr(line[0], "hits") > 0) covered++;
    return { covered, valid: lines.length, rate: (covered / lines.length) * 100 };
  }
  const valid = numericAttr(root[1], "lines-valid");
  const covered = numericAttr(root[1], "lines-covered");
  if (valid !== null && valid > 0 && covered !== null) return { covered, valid, rate: (covered / valid) * 100 };
  const rate = numericAttr(root[1], "line-rate");
  if (rate !== null) return { covered: null, valid: null, rate: rate * 100 };
  return null;
}

// 覆盖率判定（纯函数，对外接口）：入参为报告是否存在、报告文本与阈值，出四态之一及其明细。
// 存在性与空内容并为「报告缺失」，非空内容的不可解析判「报告不可解析」，可解析者按行覆盖率与阈值比大小判「达标」或「未达阈」；
// 三态与达标四者互不重合，缺失、不可解析与未达阈三种非达标态均给结论，不静默通过
function evaluateCoverage({ exists, text, threshold } = {}) {
  const limit = Number.isFinite(threshold) ? threshold : DEFAULT_THRESHOLD;
  const empty = String(text == null ? "" : text).trim() === "";
  if (!exists || empty) return { state: "missing", threshold: limit, reason: exists ? "报告为空或无可判内容" : "报告文件不存在" };
  const parsed = parseCobertura(text);
  if (!parsed) return { state: "unparsable", threshold: limit, reason: "未解析到 Cobertura 兼容的行覆盖率数据" };
  const pass = parsed.rate >= limit - 1e-9;
  return { state: pass ? "ok" : "below", threshold: limit, covered: parsed.covered, valid: parsed.valid, rate: parsed.rate };
}

module.exports = { DEFAULT_THRESHOLD, parseCobertura, evaluateCoverage };
