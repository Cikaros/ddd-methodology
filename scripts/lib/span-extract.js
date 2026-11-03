/**
 * 目标：签名级符合性校验的提取驱动——把「文件」与「DESIGN 签名片段」两类输入交给同一解析器与同一套语言判据，
 *   产出规范化后的符号清单，使代码侧与 DESIGN 侧的比较建立在同一提取结果上。
 * 范围：语言白名单分派、文件提取、签名片段合成与提取、形参与返回标注的规范化、按语言的可判定信号。
 * 不包含：解析器供给（见 span-parser.js）、各语言 AST 规则（见 span-langs.js）、契约表读取与比对（见 span-compare.js）。
 * 信号：解析失败、语法错误、语言不支持一律回传 { ok: false, reason }，不得以空清单冒充「无对外接口」。
 */

const fs = require("fs");
const path = require("path");
const { createParserProvider } = require("./span-parser.js");
const { collectSymbols } = require("./span-langs.js");

const SUPPORTED_LANGUAGES = ["typescript", "javascript", "python", "java", "go", "rust"];

// 规范化：形参与返回标注统一折叠空白，使两侧的排版差异不产生假不一致；比较另用去空白形态
const norm = (node) => String(node || "").replace(/\s+/g, " ").trim();

let provider = null;
const getProvider = () => provider || (provider = createParserProvider());

// 签名片段的合成方式：DESIGN 的签名列为人写文本，须包进最小可解析片段后才能交给同一解析器
const SYNTH = {
  typescript: (sig) => [`export function ${sig} {}`, `export ${sig}`, sig],
  javascript: (sig) => [`export function ${sig} {}`, `export ${sig}`, sig],
  python: (sig) => [`def ${sig}:\n    pass`, sig],
  java: (sig) => [`class __SigProbe { ${sig} {} }`, sig],
  go: (sig) => [`package p\nfunc ${sig} {}`, sig],
  rust: (sig) => [`pub fn ${sig} {}`, `fn ${sig} {}`, sig],
};

const normalizeSymbol = (symbol) => ({ name: symbol.name, params: norm(symbol.params), returns: norm(symbol.returns) });

// 提取器对外的解析结果：语言不在白名单、文件不可读、解析器缺失、语法错误分别给出可读原因
async function parseSource(source, language) {
  try {
    return { ok: true, root: (await getProvider().parse(source, language)).rootNode };
  } catch (error) {
    if (error && error.code === "PARSER_UNAVAILABLE") return { ok: false, reason: `无法判定：解析器未安装（${error.message}）` };
    if (error && error.code === "LANGUAGE_UNSUPPORTED") return { ok: false, reason: `语言不在首期白名单：${language}` };
    return { ok: false, reason: `解析异常：${(error && error.message) || error}` };
  }
}

// 代码侧提取：输入文件绝对路径与语言标识
async function extractFile(absPath, language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) return { ok: false, reason: `语言不在首期白名单：${language}` };
  let source;
  try {
    source = fs.readFileSync(absPath, "utf8");
  } catch (error) {
    return { ok: false, reason: `文件不可读：${absPath}` };
  }
  const parsed = await parseSource(source, language);
  if (!parsed.ok) return parsed;
  if (parsed.root.hasError) return { ok: false, reason: `存在语法错误，无法判定：${path.basename(absPath)}` };
  return { ok: true, language, symbols: collectSymbols(language, parsed.root).map(normalizeSymbol) };
}

// DESIGN 侧提取：把签名列文本包进合成片段，取规范化后的首个符号；合成不可解析则判无法判定
async function extractSignature(signatureText, language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) return { ok: false, reason: `语言不在首期白名单：${language}` };
  const sig = String(signatureText || "").replace(/`/g, "").trim().replace(/[;；]+$/, "").trim();
  if (!sig) return { ok: false, reason: "签名为空" };
  const synth = SYNTH[language];
  for (const candidate of synth(sig)) {
    const parsed = await parseSource(candidate, language);
    if (!parsed.ok) return parsed;
    if (parsed.root.hasError) continue;
    const symbols = collectSymbols(language, parsed.root).map(normalizeSymbol);
    if (symbols.length) return { ok: true, language, symbol: symbols[0] };
  }
  return { ok: false, reason: `签名文本在合成片段中无法解析：${sig}` };
}

module.exports = { extractFile, extractSignature };
