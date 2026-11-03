#!/usr/bin/env node
/**
 * 目标：把代码树的结构健康外化为可复现的机械证据，作为 G5-INT 与 G6 的证据源。
 * 范围：文件规模（源码与文档）、死代码、重复嫌疑、注释质量、结构趋势五类事实的输出与度量留盘；
 *   其中文档规模与设计文档契约数共用同一度量面，即活文档加经 design-root.js 解析出的设计树内设计文档。
 * 归属：文件规模与注释质量可由写入者按规范「结构与契约的演进治理」节的治理义务处理；无引用文件属仓库级属性，归审计代理。
 * 不包含：语义级判断。注释是否解释为什么、分支是否真不可达需 AST，本脚本不做，交由审计代理抽检。
 * 依赖：文本读取取 ./lib/text.js 的 readFileText，目录遍历与不可读收集取 ./lib/walk.js 的 walk，设计树根解析取 ./design-root.js，
 *   「对外接口与约定」节的定位取 ./fingerprint.js 导出的 CONTRACT_SECTION_RE，与该节定位保持单一权威。
 *
 * 用法：node code-health.js <项目根>
 * 输出形态：文本正文，末行机读结论 `RESULT: report`
 * 退出码：始终 0，仅报告，不作门禁；阻断地位由 G5-INT 的治理条件承接，消费方不得以退出码判定通过
 * 输出上限：12000 字节，按 UTF-8 计量；超限截断明细项，`[告警]` 段、`[相对上次恶化]` 段与末行机读结论保留
 * 规范依据：规范「结构与注释的机械证据」节的脚本消费契约表
 */

const fs = require("fs");
const path = require("path");
const { readFileText } = require("./lib/text.js");
const { HEALTH_REL, artifactWritePath, artifactWriteRel, CHANGELOG_NAME } = require("./lib/paths.js");
const { walk, SOURCE_TREE_SKIP_DIR_NAMES, DOC_TREE_SKIP_DIR_NAMES } = require("./lib/walk");
const { absoluteDesignDir } = require("./design-root.js");
const { CONTRACT_SECTION_RE } = require("./fingerprint.js");

const root = process.argv[2] || process.cwd();
const CODE_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".java", ".kt", ".go", ".rs", ".rb", ".php", ".cs", ".swift", ".c", ".h", ".cpp", ".sh", ".bat", ".ps1"]);
const LINE_LIMIT = 500;
const BASE_LINE_LIMIT = 300;
const DOC_LINE_LIMIT = 200;
const CONTRACT_LIMIT = 10;
// 活文档扫描根：规范、代理定义与全局系统提示；docs 目录为项目侧证据与归档，不入活文档度量
const DOC_ROOTS = ["skill", "agents", "global"];
// 根目录 Markdown 活文档：除变更记录外全部纳入；变更记录按当时版本的章节编号记述，其规模不作活文档度量
const ROOT_DOC_SKIP_NAMES = new Set([CHANGELOG_NAME]);

// 根目录 Markdown 枚举：只取本层，跳过点开头条目与变更记录，供活文档度量纳入
function readRootMarkdown(root) {
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return []; }
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && path.extname(entry.name).toLowerCase() === ".md" && !ROOT_DOC_SKIP_NAMES.has(entry.name))
    .map((entry) => entry.name);
}

// 文档契约数：设计文档「对外接口与约定」节自标题后至下一个二级标题前，以表格数据行数为准，表头与分隔行不计；该节无表格时取列表项数
function countContracts(text) {
  const m = text.match(CONTRACT_SECTION_RE);
  if (!m) return 0;
  const lines = m[2].split("\n");
  const tableRows = lines.filter((l) => /^\s*\|/.test(l));
  if (tableRows.length) {
    const dataRows = tableRows.filter((l) => !/^\s*\|[\s:|-]+\|?\s*$/.test(l)); // 去分隔行
    return Math.max(0, dataRows.length - 1); // 再去表头
  }
  return lines.filter((l) => /^\s*(?:[-*+]|\d+[.)、])\s+\S/.test(l)).length;
}

// 扫描面告警收集器：遍历时记入不可读目录与文件，供输出末段的 [告警] 段列出
const unreadableEntries = [];

// 基础能力文件取自 ARCHITECTURE 的能力清单，这些文件按更严上限评估
function readBaseCapabilityFiles() {
  const arch = readFileText(path.join(root, "ARCHITECTURE.md"));
  const files = new Set();
  const section = arch.match(/##\s*基础能力清单[^\n]*([\s\S]*?)(?=\n## |$)/);
  if (!section) return files;
  for (const line of section[1].split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const v = m[1].trim();
      if (CODE_EXT.has(path.extname(v).toLowerCase())) files.add(v);
    }
  }
  return files;
}

const allFiles = walk(root, SOURCE_TREE_SKIP_DIR_NAMES, [], unreadableEntries);
const codeFiles = allFiles.filter((f) => CODE_EXT.has(path.extname(f).toLowerCase()));
const baseFiles = readBaseCapabilityFiles();

// ---- 1. 文件规模 ----
const oversized = [];
const nearLimit = [];
let oversizedBase = 0; // 基础能力文件超 300 行的单列计数，供超阈值趋势细分
let sourceLines = 0; // 源码总行数，缺陷密度的分母来源；触碰行数无机械来源，故按全量源码计
for (const f of codeFiles) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const lines = readFileText(f).split("\n").length;
  sourceLines += lines;
  const isBase = baseFiles.has(rel) || [...baseFiles].some((b) => rel.endsWith(b));
  const limit = isBase ? BASE_LINE_LIMIT : LINE_LIMIT;
  if (lines > limit) {
    oversized.push({ file: rel, lines, limit });
    if (isBase) oversizedBase++;
  } else if (lines > limit * 0.8) nearLimit.push({ file: rel, lines, limit });
}

// 文档规模：规范拆分后各文件、代理定义与被开发项目的设计文档同受 200 行阈值管辖，消除「规范不受阈值管辖」与「设计面不入度量」两处缺口
const liveDocCandidates = DOC_ROOTS.flatMap((dir) => walk(path.join(root, dir), SOURCE_TREE_SKIP_DIR_NAMES, [], unreadableEntries));
for (const name of readRootMarkdown(root)) liveDocCandidates.push(path.join(root, name));
const liveDocFiles = liveDocCandidates.filter((f) => path.extname(f).toLowerCase() === ".md");
// 设计文档取自 design-root.js 解析的设计树：存在设计树时纳入同一度量面，无设计树的项目零变更
const designRoot = absoluteDesignDir(root);
const designDocCandidates = fs.existsSync(designRoot.dir) ? walk(designRoot.dir, DOC_TREE_SKIP_DIR_NAMES, [], unreadableEntries) : [];
const designDocs = designDocCandidates.filter((f) => path.extname(f).toLowerCase() === ".md");
const docFiles = [...new Set([...liveDocFiles, ...designDocs])];
const docOversized = [];
const docNearLimit = [];
for (const f of docFiles) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const lines = readFileText(f).split("\n").length;
  if (lines > DOC_LINE_LIMIT) docOversized.push({ file: rel, lines, limit: DOC_LINE_LIMIT });
  else if (lines > DOC_LINE_LIMIT * 0.8) docNearLimit.push({ file: rel, lines, limit: DOC_LINE_LIMIT });
}

// 设计文档契约数：上限十项，接近上限按上限的零点八倍判定，与代码文件的接近上限口径一致
const contractOversized = [];
const contractNearLimit = [];
for (const f of designDocs) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const contracts = countContracts(readFileText(f));
  if (contracts > CONTRACT_LIMIT) contractOversized.push({ file: rel, contracts, limit: CONTRACT_LIMIT });
  else if (contracts > CONTRACT_LIMIT * 0.8) contractNearLimit.push({ file: rel, contracts, limit: CONTRACT_LIMIT });
}

// ---- 2. 死代码 ----
const commentedCode = [];
const compatMarkers = [];
const COMMENTED_CODE_RE = /^\s*(\/\/|#)\s*(const |let |var |function |class |if |for |while |return |import |def |public |private )/;
const COMPAT_RE = /@deprecated|兼容旧|临时兼容|legacy\s*[:：]|待删除|TODO\s*[:：]\s*删除/;
for (const f of codeFiles) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const lines = readFileText(f).split("\n");
  let run = 0;
  for (let i = 0; i < lines.length; i++) {
    if (COMMENTED_CODE_RE.test(lines[i])) {
      run++;
      if (run === 2) commentedCode.push({ file: rel, lines: `${i}-` , note: "连续注释代码" });
    } else {
      run = 0;
    }
    if (/^\s*(\/\/|#|\*)/.test(lines[i]) && COMPAT_RE.test(lines[i])) {
      compatMarkers.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 60) });
    }
  }
}

// 无引用文件：文件名在仓库其余源码中未被提及
const orphans = [];
// 引用检索范围为全仓文本，含文档；带 shebang 的文件视为命令行入口，不算孤儿
const corpus = codeFiles
  .map((f) => ({ f, text: readFileText(f) }))
  .filter(({ text }) => !/^#!/.test(text));
const REFERENCE_CORPUS = allFiles
  .filter((f) => !path.basename(f).startsWith("."))
  .map((f) => readFileText(f))
  .join(String.fromCharCode(10));
for (const { f } of corpus) {
  const base = path.basename(f, path.extname(f));
  if (base.length < 3 || /^(index|main|app|mod|lib|cli|server|setup|conftest|__main__)$/i.test(base)) continue;
  if (/\.(test|spec)$/i.test(base) || /^test_/i.test(base)) continue;
  const self = readFileText(f);
  const referenced = REFERENCE_CORPUS.split(self).join("").includes(base);
  if (!referenced) orphans.push(path.relative(root, f).split(path.sep).join("/"));
}

// ---- 3. 重复嫌疑 ----
// 判据为同名顶层声明出现在多个文件，属粗略信号，供人判断是否应合并
const declRe = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class|def|public|private)\s+([A-Za-z_$][\w$]*)/g;
// 通用辅助名跳文件出现属正常，排除后只留可疑的同名族
const GENERIC = new Set(["read", "walk", "write", "parse", "format", "exists", "root", "path", "text", "lines", "entries", "problems", "warnings", "config", "options", "result", "error", "value", "items", "list", "main", "check", "update", "load", "save"]);
const declMap = new Map();
for (const f of codeFiles) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  for (const m of readFileText(f).matchAll(declRe)) {
    const name = m[1];
    if (name.length < 8 || GENERIC.has(name)) continue;
    if (!declMap.has(name)) declMap.set(name, new Set());
    declMap.get(name).add(rel);
  }
}
const duplicates = [...declMap.entries()]
  .filter(([, files]) => files.size > 1)
  .map(([name, files]) => ({ name, files: [...files] }));

// ---- 4. 注释质量 ----
const bannedComments = [];
const staleComments = [];
const BANNED = [
  { re: /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/, why: "含日期" },
  { re: /第\s*\d+\s*轮|轮次\s*\d+/, why: "含轮次" },
  { re: /改为|此前|曾经|旧实现|已移除|原先是/, why: "含修复史" },
  { re: /\bBUG-|\bT-\d{3}|#\d{3,}/, why: "含外部编号" },
];
for (const f of codeFiles) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const text = readFileText(f);
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isComment = /^\s*(\/\/|#|\*|--)/.test(line);
    if (!isComment) continue;
    for (const { re, why } of BANNED) {
      if (re.test(line)) bannedComments.push({ file: rel, line: i + 1, why, text: line.trim().slice(0, 60) });
    }
    // 注释提到 foo() 形式，但该标识符在本文件未出现，判为过时
    for (const m of line.matchAll(/([A-Za-z_$][\w$]{3,})\(\)/g)) {
      const name = m[1];
      if (!new RegExp(`\\b${name}\\b`).test(text.replace(line, ""))) {
        staleComments.push({ file: rel, line: i + 1, name });
      }
    }
  }
}

// ---- 度量留盘 ----
const metrics = {
  at: new Date().toISOString(),
  files: codeFiles.length,
  sourceLines,
  oversized: oversized.length,
  oversizedBase,
  nearLimit: nearLimit.length,
  docFiles: docFiles.length,
  designFiles: designDocs.length,
  docOversized: docOversized.length,
  docNearLimit: docNearLimit.length,
  contractOversized: contractOversized.length,
  contractNearLimit: contractNearLimit.length,
  commentedCode: commentedCode.length,
  compatMarkers: compatMarkers.length,
  orphans: orphans.length,
  duplicates: duplicates.length,
  bannedComments: bannedComments.length,
  staleComments: staleComments.length,
};
// 落点取共享层写入解析：内部区目录存在则写其中，否则写公开区
const healthPath = artifactWritePath(root, HEALTH_REL);
let history = [];
try {
  const prev = JSON.parse(readFileText(healthPath));
  history = Array.isArray(prev.history) ? prev.history : [];
} catch (e) {
  history = [];
}
const degraded = [];
if (history.length) {
  const last = history[history.length - 1];
  for (const key of Object.keys(metrics)) {
    // 文件总数与源码总行数随项目增删自然波动，不构成恶化；其余计数项上升均为信号
    if (key === "at" || key === "files" || key === "sourceLines" || key === "docFiles" || key === "designFiles") continue;
    if (typeof last[key] === "number" && metrics[key] > last[key]) degraded.push(`${key} 由 ${last[key]} 升至 ${metrics[key]}`);
  }
}
const HISTORY_LIMIT = 50; // 保留上限，防止无界增长；趋势判断只需近期样本
history.push(metrics);
if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
fs.mkdirSync(path.dirname(healthPath), { recursive: true });
fs.writeFileSync(healthPath, JSON.stringify({ history }, null, 2) + "\n");

// ---- 输出 ----
// 明细项与固定行分离：超限时自尾部回撤明细项，小节标题、各项小结、[相对上次恶化] 段与末行结论保留
const HEALTH_LIMIT_BYTES = 12000;
const entries = [];
const say = (text, droppable) => entries.push({ text, droppable: Boolean(droppable) });

say("=== 代码结构健康检查 ===");
say(`源码文件 ${metrics.files} 个，共 ${metrics.sourceLines} 行；度量已写入 ${artifactWriteRel(root, HEALTH_REL)}`);
say("");
say(`[文件规模] 超限 ${oversized.length}（其中基础能力超 300 行 ${oversizedBase}），接近上限 ${nearLimit.length}`);
for (const o of oversized) say(`  ✗ ${o.file}  ${o.lines} 行，上限 ${o.limit}`, true);
for (const o of nearLimit) say(`  ! ${o.file}  ${o.lines} 行，上限 ${o.limit}`, true);
say("");
const designClause = designDocs.length ? `，设计文档 ${designDocs.length} 份` : "";
say(`[文档规模] 活文档 ${liveDocFiles.length} 份${designClause}，超限 ${docOversized.length}（上限 ${DOC_LINE_LIMIT} 行），接近上限 ${docNearLimit.length}`);
for (const o of docOversized) say(`  ✗ ${o.file}  ${o.lines} 行，上限 ${o.limit}`, true);
for (const o of docNearLimit) say(`  ! ${o.file}  ${o.lines} 行，上限 ${o.limit}`, true);
say("");
say(`[文档契约数] 超限 ${contractOversized.length}（上限 ${CONTRACT_LIMIT} 项），接近上限 ${contractNearLimit.length}`);
for (const o of contractOversized) say(`  ✗ ${o.file}  ${o.contracts} 项，上限 ${o.limit}`, true);
for (const o of contractNearLimit) say(`  ! ${o.file}  ${o.contracts} 项，上限 ${o.limit}`, true);
say("");
say(`[死代码] 注释代码块 ${commentedCode.length}，兼容层标记 ${compatMarkers.length}，无引用文件 ${orphans.length}`);
for (const o of commentedCode) say(`  ✗ ${o.file}:${o.lines} ${o.note}`, true);
for (const o of compatMarkers) say(`  ✗ ${o.file}:${o.line} ${o.text}`, true);
for (const o of orphans) say(`  ✗ ${o} 未见引用`, true);
say("");
say(`[重复嫌疑] ${duplicates.length} 项同名声明跨文件出现，属弱信号，语义级重复需审计代理判定`);
for (const d of duplicates.slice(0, 20)) say(`  ! ${d.name} :: ${d.files.join(", ")}`, true);
if (duplicates.length > 20) say(`  ... 其余 ${duplicates.length - 20} 项见健康文件`, true);
say("");
say(`[注释质量] 违禁模式 ${bannedComments.length}，过时引用 ${staleComments.length}`);
for (const o of bannedComments) say(`  ✗ ${o.file}:${o.line} ${o.why} :: ${o.text}`, true);
for (const o of staleComments) say(`  ✗ ${o.file}:${o.line} 提及已不存在的 ${o.name}()`, true);
say("");
say(degraded.length ? `[相对上次恶化] ${degraded.length} 项` : "[相对上次恶化] 无");
for (const d of degraded) say(`  ✗ ${d}`);
say("");
// 告警段：列出扫描面内不可读的目录与文件，无条目时输出无；属固定行，输出超限时保留
const unreadableList = [...new Set(unreadableEntries)];
say(`[告警] ${unreadableList.length ? `${unreadableList.length} 处不可读` : "无"}`);
for (const u of unreadableList) say(`  ✗ ${path.relative(root, u).split(path.sep).join("/")} 不可读`, true);

// 结论行只累加「问题项」：超限（源码、文档与设计文档契约数）与违禁/死代码/无引用均属问题，故一并计入；
// 接近上限（nearLimit/docNearLimit/contractNearLimit）只是预警阈值，未构成问题，故不计入 total——与末行「未发现超限项」的语义一致，避免把预警误报成超限。
const total = oversized.length + docOversized.length + contractOversized.length + commentedCode.length + compatMarkers.length + orphans.length + bannedComments.length;
say("");
say("本脚本恒退出 0，仅报告，不作门禁");
say(total ? `结论：存在 ${total} 项结构健康问题，本版仅报告不阻断` : "结论：结构健康未发现超限项");
say("RESULT: report");

// 超限时保持终止性：截断计数行占位后重算字节数，最坏情形下仅剩固定行
function capHealthReport(all) {
  const droppableSlots = all.map((entry, index) => (entry.droppable ? index : -1)).filter((index) => index >= 0);
  const build = (keep) => {
    const dropped = new Set(droppableSlots.slice(keep));
    const out = [];
    let noteWritten = false;
    all.forEach((entry, index) => {
      if (dropped.has(index)) {
        if (!noteWritten) {
          out.push(`明细已截断：共 ${droppableSlots.length} 项，已列 ${keep} 项`);
          noteWritten = true;
        }
        return;
      }
      out.push(entry.text);
    });
    return out;
  };
  for (let keep = droppableSlots.length; keep >= 0; keep--) {
    const out = build(keep);
    if (Buffer.byteLength(out.join("\n"), "utf8") <= HEALTH_LIMIT_BYTES) return out;
  }
  return build(0);
}

console.log(capHealthReport(entries).join("\n"));
process.exit(0);
