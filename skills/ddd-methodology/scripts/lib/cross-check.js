/**
 * 目标：把五个交叉检查脚本的公共装配收敛为单一模块——检查项清单读取、节点检查集取用、缺口项构造与报告装配，
 *   使五个脚本各自只承载检查逻辑，不重复清单解析与输出格式。
 * 范围：清单读取（skills/ddd-methodology/assets/check-items.json）、按节点键取检查项、缺口项构造、
 *   报告装配（末行机读结论 pass 或 gap，问题清单含定位与期望值）、不适用出口、输出字节上限回撤；
 *   另含目标项目产物定位与状态文件、阶段键的读取原语，供五个交叉检查脚本共用。
 * 不包含：具体检查语义（各脚本）、命令行入口。不引入第三方依赖。
 * 机读结论：无缺口输出 `RESULT: pass`，存在缺口输出 `RESULT: gap`；对象不存在时报不适用，退出码零。
 * 依据：DESIGN-crosscheck.md 第三、四节与 DESIGN-governance.md 第七节（不适用出口）。
 */

const fs = require("fs");
const path = require("path");
const { readFileText } = require("./text.js");
const { capLines } = require("./truncate.js");
const { isMethodologyRepo, methodologyReason, NOT_APPLICABLE_TAIL } = require("./repo-scope.js");
const { absoluteDesignDir } = require("../design-root.js");
const { STATE_FILE_REL } = require("./paths.js");

// 包根：本模块位于 skills/ddd-methodology/scripts/lib/，上溯两级即技能目录，清单落在其 assets/ 下
const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
const CHECK_ITEMS_REL = ["assets", "check-items.json"];

// 检查项清单读取：清单缺失或不可解析即抛错，由脚本以退出码 2 报装配失败，不静默当零检查项
function loadCheckItems() {
  const file = path.join(PACKAGE_ROOT, ...CHECK_ITEMS_REL);
  const text = readFileText(file);
  if (!text) throw new Error(`检查项清单缺失：${file}`);
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.classes) || !data.nodes || typeof data.nodes !== "object") {
    throw new Error("检查项清单结构非法：须含 classes 数组与 nodes 映射");
  }
  return data;
}

// 按节点键取检查项，类名由 classes 映射补齐，供报告逐项标注所属类
function nodeItems(nodeKey) {
  const data = loadCheckItems();
  const className = new Map(data.classes.map((c) => [c.id, c.name]));
  return (data.nodes[nodeKey] || []).map((item) => ({ ...item, klassName: className.get(item.class) || item.class }));
}

// 缺口项：定位（文件或对象）、期望值、实际值，字段名与各脚本回传形态一致
function finding(itemId, klassName, where, expect, found) {
  return { item: itemId, klass: klassName, where: String(where || ""), expect: String(expect || ""), found: String(found === undefined ? "" : found) };
}

// 输出字节上限回撤：固定行保留，缺口明细自尾部回撤并留计数行
const OUTPUT_LIMIT_BYTES = 12000;

// 报告装配与打印：head 为固定行，details 为可回撤明细，tail 为固定结论行；回传退出码
function emit({ head, details, tail, gaps }) {
  const build = (keep) => {
    const out = head.concat(details.slice(0, keep));
    if (keep < details.length) out.push(`明细已截断：共 ${details.length} 项，已列 ${keep} 项`);
    return out.concat(tail);
  };
  const lines = capLines({ total: details.length, limit: OUTPUT_LIMIT_BYTES, build });
  process.stdout.write(lines.join("\n") + "\n");
  return gaps ? 1 : 0;
}

// 不适用出口：无判定对象时报不适用而非缺口，退出码零，不零对象报通过
function emitNotApplicable(nodeKey, title, reason) {
  return emit({
    head: [`=== 交叉检查 ${nodeKey} ===`, title],
    details: [reason],
    tail: NOT_APPLICABLE_TAIL,
    gaps: false,
  });
}

// 目标项目定位：状态文件、设计树根、阶段键全序（权威源为方法论主技能第一节的通道表，由 inject 矩阵键序给出顺）
function statusFile(root) {
  return path.join(root, ...STATE_FILE_REL.split("/"));
}
function readStatus(root) {
  const file = statusFile(root);
  const text = readFileText(file);
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return { __invalid: String(e.message) }; }
}
// 设计树根：与 trace-check、governance-check 共用 design-root.js 的唯一实现
function designDir(root) {
  return absoluteDesignDir(root);
}
// 方法论自身阶段键全序：注入矩阵的键序即节点全集的设计序，作 check-scope 的顺序比对基准
function nodeUniverse() {
  const file = path.join(PACKAGE_ROOT, "assets", "injection-matrix.json");
  const text = readFileText(file);
  if (!text) return [];
  try { return Object.keys(JSON.parse(text)); } catch (e) { return []; }
}

// 代码扩展名白名单：与 code-health 同口径，用于枚举源码文件
const CODE_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".java", ".kt", ".go", ".rs", ".rb", ".vue", ".cs", ".swift", ".c", ".h", ".cpp", ".sh", ".ps1"]);

// 设计文档枚举：设计树内 DESIGN*.md，回传绝对路径、仓库相对路径与基名（去 .md）
function designDocs(root) {
  const info = designDir(root);
  const out = [];
  const scan = (dir) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(full); continue; }
      if (/^DESIGN.*\.md$/i.test(entry.name)) out.push({ abs: full, rel: path.relative(root, full).split(path.sep).join("/"), base: entry.name.replace(/\.md$/i, ""), dirRel: path.relative(info.dir, dir).split(path.sep).join("/") });
    }
  };
  scan(info.dir);
  return out;
}

// 源码文件枚举：自仓库根起深度优先，跳过点开头与依赖目录，按扩展名白名单筛选
function sourceFiles(root) {
  const skip = new Set(["node_modules", ".git", "dist", "build", "out", "target", "vendor", "__pycache__", "coverage", "docs", ".pi"]);
  const out = [];
  const scan = (dir) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (CODE_EXT.has(path.extname(entry.name).toLowerCase())) out.push(full);
    }
  };
  scan(root);
  return out;
}

// 验收标准编号集合：自 AC.md 取 AC-<数字> 形态的编号
function acIds(root) {
  const text = readFileText(path.join(root, "AC.md"));
  return new Set([...text.matchAll(/\bAC-\d+\b/g)].map((m) => m[0]));
}

// 运行入口：逐个检查项执行，逐项判通过或缺口，装配报告并回传退出码
function runCrossCheck({ nodeKey, title, root, checks }) {
  // 不适用：本仓库为方法论自身时无应用侧设计产物，五个交叉检查节点无判定对象
  if (isMethodologyRepo(root)) {
    return emitNotApplicable(nodeKey, title, methodologyReason(`交叉检查 ${nodeKey} 无判定对象`));
  }
  let items;
  try {
    items = nodeItems(nodeKey);
  } catch (error) {
    process.stdout.write(`=== 交叉检查 ${nodeKey} ===\n[错误] 检查项清单不可用：${error.message}\nRESULT: gap\n`);
    return 1;
  }

  const results = [];
  const details = [];
  for (const item of items) {
    let findings = [];
    const runner = checks[item.id];
    if (typeof runner !== "function") {
      findings = [finding(item.id, item.klassName, nodeKey, "检查项须有实现", "未实现")];
    } else {
      try {
        findings = runner() || [];
      } catch (error) {
        findings = [finding(item.id, item.klassName, nodeKey, "检查项正常完成", String((error && error.message) || error))];
      }
    }
    results.push({ item, findings });
    for (const f of findings) details.push(`  ✗ [${f.item}] ${f.where} :: 期望 ${f.expect}${f.found ? `；实际 ${f.found}` : ""}`);
  }

  const totalGaps = results.reduce((sum, r) => sum + r.findings.length, 0);
  const head = [`=== 交叉检查 ${nodeKey} ===`, title, `检查项 ${items.length} 项`];
  for (const r of results) head.push(r.findings.length ? `[${r.item.id} ${r.item.klassName}] 缺口 ${r.findings.length} 项` : `[${r.item.id} ${r.item.klassName}] 通过`);

  const tail = totalGaps
    ? ["", `结果：存在 ${totalGaps} 项缺口`, "RESULT: gap"]
    : ["", `结果：通过，${items.length} 项检查无缺口`, "RESULT: pass"];

  return emit({ head, details, tail, gaps: totalGaps > 0 });
}

module.exports = {
  finding,
  emitNotApplicable,
  runCrossCheck,
  // 目标项目原语
  readStatus,
  designDir,
  nodeUniverse,
  designDocs,
  sourceFiles,
  acIds,
};
