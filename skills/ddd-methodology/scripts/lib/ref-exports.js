/**
 * 目标：把「公开面大于消费面」这一根因外化为可机检的零引用值导出判据，作为 ref-check 的契约项，使只有定义、没有消费方的值导出在提交前被检出。
 * 范围：C38 零引用值导出——扫描面两处，即 skills/ddd-methodology/scripts/lib/ 下的 .js（排除 .test.js）与 extensions/lib/ 下的 .ts（排除 .test.ts）；
 *   取导出符号：JS 取 module.exports 对象字面量的顶层键，TS 取 export const、export function 与 export let；
 *   判据：值导出视为被消费，当且仅当存在另一代码文件导入其定义模块，且该文件内出现该符号的词边界引用；零消费即报漂移，逐项给出模块相对路径与符号名；
 *   导入关系两路取并集：相对说明符经解析命中的文件，以及以字符串字面量点名该模块文件名的文件（后者供扩展侧经 createRequire 按绝对路径装载的消费方入判）；
 *   导出形态无法识别时报「导出形态未识别」，不静默回空数组，免得日后改写写法时判据静默失效。
 * 不包含：类型导出不入判据，即 TS 的 export type 与 export interface；无导出语句的模块不报；引用形态与脚本名（见 ref-refs.js）、目录遍历实现（见 walk.js）、命令行入口。不引入第三方依赖。
 * 豁免：唯一豁免面为注册表动态装载的 contracts 符号，即 ref-*.js 模块由 ref-registry.js 遍历目录后按绝对路径装载，无文件点名其文件名，故其 contracts 不以导入面判消费；其余零消费导出一律报漂移，不开第二处口子。
 * 依据：governance-declaration 技能的声明面铁律与修剪条，及其存量债务登记与清偿条对「反复修补同一处」根因的机械承接要求。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./text.js");
const { walk, SOURCE_TREE_SKIP_DIR_NAMES } = require("./walk.js");

// 定义扫描面：两处共享层的模块目录与扩展名，测试文件按后缀排除；读取函数按语言形态分派
const DEFINITION_SETS = [
  { dirRel: "skills/ddd-methodology/scripts/lib", ext: ".js", testSuffix: ".test.js", read: jsExportNames },
  { dirRel: "extensions/lib", ext: ".ts", testSuffix: ".test.ts", read: tsExportNames },
];
// 引用检索面的文件形态：值导出在 .js 与 .ts 两种代码文件中任一被消费即算有消费方
const CODE_SUFFIXES = [".js", ".ts"];
// 相对说明符的补全候选：本仓库的导入带扩展名，补全仅为兜底，顺序即优先级
const RESOLVE_CANDIDATES = [".js", ".ts", "/index.js", "/index.ts"];
// 注册表动态装载的模块名形态与其豁免符号：唯一豁免面，另开一处即为违背本判据
const REGISTRY_MODULE_RE = /^ref-.+\.js$/;
const REGISTRY_LOADED_SYMBOL = "contracts";
// 正则字面量的起始上下文：这些字符之后出现的斜杠按正则处理，否则按除号处理
const REGEX_PRECEDERS = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "\n"]);

// 注释、字符串与正则字面量剔除：逐字符等长改写为空白，保留下标与原结构，使花括号配平只见结构括号
function blankNonCode(source) {
  const chars = [...source];
  const blank = (from, to) => { for (let k = from; k < to && k < chars.length; k++) if (chars[k] !== "\n") chars[k] = " "; };
  let i = 0;
  let prevSignificant = "";
  while (i < source.length) {
    const ch = source[i];
    if (ch === "/" && source[i + 1] === "/") {
      const start = i;
      while (i < source.length && source[i] !== "\n") i++;
      blank(start, i);
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i = Math.min(i + 2, source.length);
      blank(start, i);
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const start = i;
      const quote = ch;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === quote) { i++; break; }
        if (quote === "`" && source[i] === "\n") break;
        i++;
      }
      blank(start, i);
      prevSignificant = "''";
      continue;
    }
    if (ch === "/" && (prevSignificant === "" || REGEX_PRECEDERS.has(prevSignificant))) {
      const start = i;
      let inClass = false;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === "[") inClass = true;
        else if (source[i] === "]") inClass = false;
        else if (source[i] === "/" && !inClass) { i++; break; }
        else if (source[i] === "\n") break;
        i++;
      }
      while (i < source.length && /[a-z]/.test(source[i])) i++;
      blank(start, i);
      continue;
    }
    if (!/\s/.test(ch)) prevSignificant = ch;
    i++;
  }
  return chars.join("");
}

// 对象字面量正文：自左花括号起按花括号配平取内文，未配平回 null；入参须为剔除注释字符串与正则后的文本
function objectBody(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") { depth--; if (depth === 0) return source.slice(open + 1, i); }
  }
  return null;
}

// 顶层键：按零深度的逗号切分，逐段取键名，兼容简写与 键: 值 两种形态；键名须为合法标识符，其余段忽略
function topLevelKeys(body) {
  const keys = [];
  let depth = 0;
  let segment = "";
  const flush = () => {
    const text = segment.trim();
    segment = "";
    const match = /^([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(text);
    if (match) keys.push(match[1]);
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { flush(); continue; }
    segment += ch;
  }
  flush();
  return keys;
}

// JS 导出符号：取最后一处 module.exports 赋值的对象字面量顶层键；
// 无该赋值而出现 exports. 形态即回形态未识别；两者皆无视为无导出语句的模块，回空且不报
function jsExportNames(source) {
  const clean = blankNonCode(source);
  const matches = [...clean.matchAll(/module\.exports\s*=/g)];
  if (!matches.length) return { names: [], unrecognized: /(^|[^\w$.])exports\s*\./.test(clean) };
  const last = matches[matches.length - 1];
  const open = clean.indexOf("{", last.index + last[0].length);
  if (open < 0) return { names: [], unrecognized: true };
  const body = objectBody(clean, open);
  if (body === null) return { names: [], unrecognized: true };
  return { names: topLevelKeys(body), unrecognized: false };
}

// TS 值导出符号：取 export const、export function 与 export let 的声明名；export type 与 export interface 属类型面，不入判据；
// 出现 export class、export enum、export default 或 export { 命名导出列表时不作解析，回形态未识别，免得静默失效
function tsExportNames(source) {
  const clean = blankNonCode(source);
  const names = [];
  const unsupported = /^export\s+(?:class|enum|default)\b|^export\s*\{/m.test(clean);
  for (const m of clean.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) names.push(m[1]);
  for (const m of clean.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)/gm)) names.push(m[1]);
  for (const m of clean.matchAll(/^export\s+let\s+([A-Za-z_$][\w$]*)/gm)) names.push(m[1]);
  return { names, unrecognized: unsupported };
}

// 符号检索式：转义正则元字符使符号名按字面参与词边界检索，避免前缀相似名互相命中
function symbolPattern(name) {
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
}

// 相对说明符解析：自导入方所在目录解析，按补全候选逐项试探，命中回文件绝对路径，其余回 null
function resolveSpecifier(fromFile, spec) {
  if (typeof spec !== "string" || !spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [base, ...RESOLVE_CANDIDATES.map((suffix) => base + suffix)]) {
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch (e) { /* 该候选不存在，试下一个 */ }
  }
  return null;
}

// 导入关系：逐文件收两路——相对说明符解析命中的定义模块，以及字符串字面量点名其文件名的定义模块；
// 回 定义模块绝对路径 -> 消费方文件集合，后者供扩展侧按绝对路径装载脚本模块时入判
function importerIndex(files, texts, definitionPaths) {
  const byBasename = new Map();
  for (const abs of definitionPaths) {
    const base = path.basename(abs);
    if (!byBasename.has(base)) byBasename.set(base, abs);
  }
  const index = new Map();
  const add = (target, file) => {
    if (!target || !definitionPaths.has(target)) return;
    if (!index.has(target)) index.set(target, new Set());
    index.get(target).add(file);
  };
  for (const file of files) {
    const raw = readFileText(file) || "";
    for (const pattern of [/require\(\s*["']([^"']+)["']\s*\)/g, /from\s*["']([^"']+)["']/g, /import\(\s*["']([^"']+)["']\s*\)/g]) {
      for (const m of raw.matchAll(pattern)) add(resolveSpecifier(file, m[1]), file);
    }
    for (const m of raw.matchAll(/["']([^"']*[\\/])?([A-Za-z0-9_.-]+\.(?:js|ts))["']/g)) {
      const named = byBasename.get(m[2]);
      if (named) add(named, file);
    }
  }
  return index;
}

function createExportChecks(env) {
  const { root, relPath } = env;

  // 引用检索面：源码树遍历结果中的 .js 与 .ts，定义文件亦在其内，逐符号检索时按导入关系收窄
  function codeFiles() {
    return walk(root, SOURCE_TREE_SKIP_DIR_NAMES).filter((file) => CODE_SUFFIXES.some((suffix) => file.endsWith(suffix)));
  }

  // 定义模块清单：两层扫描面内非测试文件，作为导入关系的可比对面
  function definitionFiles() {
    const out = new Set();
    for (const set of DEFINITION_SETS) {
      const dir = path.join(root, ...set.dirRel.split("/"));
      let names; try { names = fs.readdirSync(dir); } catch (e) { names = []; }
      for (const name of names) {
        if (!name.endsWith(set.ext) || name.endsWith(set.testSuffix)) continue;
        out.add(path.join(dir, name));
      }
    }
    return out;
  }

  // 外部引用：仅在导入该定义模块的文件内按词边界命中该符号，方算有消费方；未导入者内的同名文本不计
  function referencedOutside(name, definitionFile, importers, texts) {
    const pattern = symbolPattern(name);
    for (const file of importers.get(definitionFile) || []) {
      if (file === definitionFile) continue;
      if (pattern.test(blankNonCode(texts.get(file) || ""))) return true;
    }
    return false;
  }

  function checkZeroReferenceExports() {
    const found = [];
    const files = codeFiles();
    const texts = new Map(files.map((file) => [file, readFileText(file)]));
    const definitions = definitionFiles();
    const importers = importerIndex(files, texts, definitions);
    for (const set of DEFINITION_SETS) {
      const dir = path.join(root, ...set.dirRel.split("/"));
      let names; try { names = fs.readdirSync(dir); } catch (e) { names = []; }
      for (const name of names.slice().sort()) {
        if (!name.endsWith(set.ext) || name.endsWith(set.testSuffix)) continue;
        const full = path.join(dir, name);
        const rel = relPath(full);
        const parsed = set.read(texts.get(full) || "");
        if (parsed.unrecognized) {
          found.push(drift("C38", rel, 0, "值导出的形态须可识别，不可静默跳过", "module.exports 对象字面量或受支持的 TS 导出形态", "导出形态未识别"));
          continue;
        }
        for (const symbol of parsed.names) {
          if (REGISTRY_MODULE_RE.test(name) && symbol === REGISTRY_LOADED_SYMBOL) continue;
          if (referencedOutside(symbol, full, importers, texts)) continue;
          found.push(drift("C38", rel, 0, "值导出须被导入其定义模块的文件按名引用", "定义文件之外至少一处导入面引用", symbol));
        }
      }
    }
    return found;
  }

  return { checkZeroExportReferences: checkZeroReferenceExports };
}

// 注册表契约：id、简名与所属域随本模块声明；run 只转接本模块工厂的对应判据，装配处不掌握判据内容
module.exports = {
  contracts: [{ id: "C38", name: "零引用值导出", domain: "exports", run: (ctx) => createExportChecks(ctx).checkZeroExportReferences() }],
};
