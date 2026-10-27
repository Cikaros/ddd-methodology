#!/usr/bin/env node
/**
 * 目标：把代码树的结构健康外化为可复现的机械证据，作为 G5-INT 与 G6 的证据源。
 * 范围：文件规模、死代码、重复嫌疑、注释质量四类事实的输出与度量留盘。
 * 归属：文件规模与注释质量可由写入者按清理义务处理；无引用文件属仓库级属性，归审计代理。
 * 不包含：语义级判断。注释是否解释为什么、分支是否真不可达需 AST，本脚本不做，交由审计代理抽检。
 *
 * 用法：node code-health.js <项目根>
 * 退出码：始终 0。首版仅报告不阻断，待累积真实噪声水平后再决定是否引入阻断开关。
 */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
// 点开头目录已由 walk 统一跳过，此处只列非点开头的构建与依赖目录
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "out", "target", "vendor", "__pycache__", "coverage", "docs"]);
const CODE_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".java", ".kt", ".go", ".rs", ".rb", ".php", ".cs", ".swift", ".c", ".h", ".cpp", ".sh", ".bat", ".ps1"]);
const LINE_LIMIT = 500;
const BASE_LINE_LIMIT = 300;

const warnings = [];

const read = (p) => {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    return "";
  }
};

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    warnings.push(`目录不可读，已跳过：${dir}`);
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

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
for (const f of codeFiles) {
  const rel = path.relative(root, f).split(path.sep).join("/");
  const lines = read(f).split("\n").length;
  const limit = baseFiles.has(rel) || [...baseFiles].some((b) => rel.endsWith(b)) ? BASE_LINE_LIMIT : LINE_LIMIT;
  if (lines > limit) oversized.push({ file: rel, lines, limit });
  else if (lines > limit * 0.8) nearLimit.push({ file: rel, lines, limit });
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
  nearLimit: nearLimit.length,
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
    if (key === "at" || key === "files") continue;
    if (typeof last[key] === "number" && metrics[key] > last[key]) degraded.push(`${key} 由 ${last[key]} 升至 ${metrics[key]}`);
  }
}
const HISTORY_LIMIT = 50; // 保留上限，防止无界增长；趋势判断只需近期样本
history.push(metrics);
if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
fs.mkdirSync(path.dirname(healthPath), { recursive: true });
fs.writeFileSync(healthPath, JSON.stringify({ history }, null, 2) + "\n");

// ---- 输出 ----
const line = (s) => console.log(s);
line("=== 代码结构健康检查 ===");
line(`源码文件 ${metrics.files} 个；度量已写入 docs/health.json`);
line("");
line(`[文件规模] 超限 ${oversized.length}，接近上限 ${nearLimit.length}`);
for (const o of oversized) line(`  ✗ ${o.file}  ${o.lines} 行，上限 ${o.limit}`);
for (const o of nearLimit) line(`  ! ${o.file}  ${o.lines} 行，上限 ${o.limit}`);
line("");
line(`[死代码] 注释代码块 ${commentedCode.length}，兼容层标记 ${compatMarkers.length}，无引用文件 ${orphans.length}`);
for (const o of commentedCode) line(`  ✗ ${o.file}:${o.lines} ${o.note}`);
for (const o of compatMarkers) line(`  ✗ ${o.file}:${o.line} ${o.text}`);
for (const o of orphans) line(`  ✗ ${o} 未见引用`);
line("");
line(`[重复嫌疑] ${duplicates.length} 项同名声明跨文件出现，属弱信号，语义级重复需审计代理判定`);
for (const d of duplicates.slice(0, 20)) line(`  ! ${d.name} :: ${d.files.join(", ")}`);
if (duplicates.length > 20) line(`  ... 其余 ${duplicates.length - 20} 项见健康文件`);
line("");
line(`[注释质量] 违禁模式 ${bannedComments.length}，过时引用 ${staleComments.length}`);
for (const o of bannedComments) line(`  ✗ ${o.file}:${o.line} ${o.why} :: ${o.text}`);
for (const o of staleComments) line(`  ✗ ${o.file}:${o.line} 提及已不存在的 ${o.name}()`);
line("");
if (degraded.length) {
  line(`[相对上次恶化] ${degraded.length} 项`);
  for (const d of degraded) line(`  ✗ ${d}`);
} else {
  line("[相对上次恶化] 无");
}
if (warnings.length) {
  line("");
  line("[警告]");
  for (const w of warnings) line(`  ! ${w}`);
}

const total = oversized.length + commentedCode.length + compatMarkers.length + orphans.length + bannedComments.length;
line("");
line(total ? `结论：存在 ${total} 项结构健康问题，本版仅报告不阻断` : "结论：结构健康未发现超限项");
process.exit(0);
