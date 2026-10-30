#!/usr/bin/env node
/**
 * 目标：把代码树的结构健康外化为可复现的机械证据，作为 G5-INT 与 G6 的证据源。
 * 范围：文件规模（源码与活文档）、死代码、重复嫌疑、注释质量、结构趋势五类事实的输出与度量留盘。
 * 归属：文件规模与注释质量可由写入者按规范「结构与契约的演进治理」节的治理义务处理；无引用文件属仓库级属性，归审计代理。
 * 不包含：语义级判断。注释是否解释为什么、分支是否真不可达需 AST，本脚本不做，交由审计代理抽检。
 *
 * 用法：node code-health.js <项目根>
 * 输出形态：文本正文，末行机读结论 `RESULT: report`
 * 退出码：始终 0，仅报告，不作门禁；阻断地位由 G5-INT 的治理条件承接，消费方不得以退出码判定通过
 * 输出上限：12000 字节，按 UTF-8 计量；超限截断明细项，`[相对上次恶化]` 段与末行机读结论保留
 * 规范依据：规范「结构与注释的机械证据」节的脚本消费契约表
 */

const fs = require("fs");
const path = require("path");
const { walk } = require("./lib/walk");

const root = process.argv[2] || process.cwd();
const CODE_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".java", ".kt", ".go", ".rs", ".rb", ".php", ".cs", ".swift", ".c", ".h", ".cpp", ".sh", ".bat", ".ps1"]);
const LINE_LIMIT = 500;
const BASE_LINE_LIMIT = 300;
const DOC_LINE_LIMIT = 200;
// 活文档扫描根：规范、代理定义与全局系统提示；docs 目录与 CHANGELOG.md 不在其内，天然不入度量
const DOC_ROOTS = ["skill", "agents", "global"];

const read = (p) => {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    return "";
  }
};

// 基础能力文件取自 ARCHITECTURE 的能力清单，这些文件按更严上限评估
function readBaseCapabilityFiles() {
  const arch = read(path.join(root, "ARCHITECTURE.md"));
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

const allFiles = walk(root);
const codeFiles = allFiles.filter((f) => CODE_EXT.has(path.extname(f).toLowerCase()));
const baseFiles = readBaseCapabilityFiles();

// ---- 1. 文件规模 ----
const oversized = [];
const nearLimit = [];
let oversizedBase = 0; // 基础能力文件超 300 行的单列计数，供超阈值趋势细分
for (const f of codeFiles) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const lines = read(f).split("\n").length;
  const isBase = baseFiles.has(rel) || [...baseFiles].some((b) => rel.endsWith(b));
  const limit = isBase ? BASE_LINE_LIMIT : LINE_LIMIT;
  if (lines > limit) {
    oversized.push({ file: rel, lines, limit });
    if (isBase) oversizedBase++;
  } else if (lines > limit * 0.8) nearLimit.push({ file: rel, lines, limit });
}

// 活文档规模：规范拆分后各文件与代理定义同受 200 行阈值管辖，消除「规范不受阈值管辖」的缺口
const docCandidates = DOC_ROOTS.flatMap((dir) => walk(path.join(root, dir)));
const rootReadme = path.join(root, "README.md");
if (fs.existsSync(rootReadme)) docCandidates.push(rootReadme);
const docFiles = docCandidates.filter((f) => path.extname(f).toLowerCase() === ".md");
const docOversized = [];
const docNearLimit = [];
for (const f of docFiles) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const lines = read(f).split("\n").length;
  if (lines > DOC_LINE_LIMIT) docOversized.push({ file: rel, lines, limit: DOC_LINE_LIMIT });
  else if (lines > DOC_LINE_LIMIT * 0.8) docNearLimit.push({ file: rel, lines, limit: DOC_LINE_LIMIT });
}

// ---- 2. 死代码 ----
const commentedCode = [];
const compatMarkers = [];
const COMMENTED_CODE_RE = /^\s*(\/\/|#)\s*(const |let |var |function |class |if |for |while |return |import |def |public |private )/;
const COMPAT_RE = /@deprecated|兼容旧|临时兼容|legacy\s*[:：]|待删除|TODO\s*[:：]\s*删除/;
for (const f of codeFiles) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const lines = read(f).split("\n");
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
  .map((f) => ({ f, text: read(f) }))
  .filter(({ text }) => !/^#!/.test(text));
const REFERENCE_CORPUS = allFiles
  .filter((f) => !path.basename(f).startsWith("."))
  .map((f) => read(f))
  .join(String.fromCharCode(10));
for (const { f } of corpus) {
  const base = path.basename(f, path.extname(f));
  if (base.length < 3 || /^(index|main|app|mod|lib|cli|server|setup|conftest|__main__)$/i.test(base)) continue;
  if (/\.(test|spec)$/i.test(base) || /^test_/i.test(base)) continue;
  const self = read(f);
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
  for (const m of read(f).matchAll(declRe)) {
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
  const text = read(f);
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
  oversized: oversized.length,
  oversizedBase,
  nearLimit: nearLimit.length,
  docFiles: docFiles.length,
  docOversized: docOversized.length,
  docNearLimit: docNearLimit.length,
  commentedCode: commentedCode.length,
  compatMarkers: compatMarkers.length,
  orphans: orphans.length,
  duplicates: duplicates.length,
  bannedComments: bannedComments.length,
  staleComments: staleComments.length,
};
const healthPath = path.join(root, "docs", "health.json");
let history = [];
try {
  const prev = JSON.parse(read(healthPath));
  history = Array.isArray(prev.history) ? prev.history : [];
} catch (e) {
  history = [];
}
const degraded = [];
if (history.length) {
  const last = history[history.length - 1];
  for (const key of Object.keys(metrics)) {
    // 文件总数随增删自然波动，不构成恶化；其余计数项上升均为信号
    if (key === "at" || key === "files" || key === "docFiles") continue;
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
say(`源码文件 ${metrics.files} 个；度量已写入 docs/health.json`);
say("");
say(`[文件规模] 超限 ${oversized.length}（其中基础能力超 300 行 ${oversizedBase}），接近上限 ${nearLimit.length}`);
for (const o of oversized) say(`  ✗ ${o.file}  ${o.lines} 行，上限 ${o.limit}`, true);
for (const o of nearLimit) say(`  ! ${o.file}  ${o.lines} 行，上限 ${o.limit}`, true);
say("");
say(`[文档规模] 活文档 ${docFiles.length} 份，超限 ${docOversized.length}（上限 ${DOC_LINE_LIMIT} 行），接近上限 ${docNearLimit.length}`);
for (const o of docOversized) say(`  ✗ ${o.file}  ${o.lines} 行，上限 ${o.limit}`, true);
for (const o of docNearLimit) say(`  ! ${o.file}  ${o.lines} 行，上限 ${o.limit}`, true);
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

// 结论行只累加「问题项」：超限（源码与活文档）与违禁/死代码/无引用均属问题，故一并计入；
// 接近上限（nearLimit/docNearLimit）只是预警阈值，未构成问题，故不计入 total——与末行「未发现超限项」的语义一致，避免把预警误报成超限。
const total = oversized.length + docOversized.length + commentedCode.length + compatMarkers.length + orphans.length + bannedComments.length;
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
