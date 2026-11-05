#!/usr/bin/env node
/**
 * DDD-Methodology 追溯一致性校验脚本（只读）
 *
 * 用法：node trace-check.js <项目根>
 * 校验链：REQUIREMENTS.md 需求编号 ↔ AC.md 总验收 ↔ 各 DESIGN.md 模块级验收要点 ↔ 各 TEST_PLAN.md 用例表
 * 输出形态：文本正文，含未覆盖（R 无 AC 承接 / 总 AC 无模块承接 / 模块 AC 无用例覆盖）、悬空引用（AC 引用了不存在的 R、模块引用了不存在的 AC、DESIGN 消费方引用了不存在的目录）、孤儿 AC、无设计来源的接口（接口在代码侧无对应导出）与模块名拼写不一致，以及义务核销缺口（设计侧义务条目在任务树模块节点文件中无对应节点，或节点状态与确定度取值不合法）
 * 新增判据的说明只在规范「结构与注释的机械证据」节的脚本消费契约表处展开，本脚本只落机械实现；判据无可机械判定形态时按「无法判定」告警并显式说明，不静默判过
 * 无设计来源的接口复用签名级提取能力，表格与章节解析原语（readTable、sectionBody）亦复用同一实现（均见 lib/span-compare.js），语言推导不出、消费方列非文件路径或解析器未安装时报「无法判定」并说明，不把比对逻辑复制进本脚本
 * 末行机读结论：通过输出 `RESULT: pass`，存在缺口输出 `RESULT: gap`，方法论仓库自身输出 `RESULT: pass`（不适用）
 * 退出码：0 通过（含不适用与仅告警的无法判定），1 存在缺口。门禁地位：G2、G4 与 G5 门禁的脚本证据源
 * 输出上限：12000 字节，按 UTF-8 计量；超限截断明细，末行机读结论与截断计数行保留
 * 依赖：文本读取取 ./lib/text.js 的 readFileText，本脚本不再内联读取实现。
 * 规范依据：规范「结构与注释的机械证据」节的脚本消费契约表，与「质量门禁」节的证据源行
 *
 * 约定格式（与 templates.md 模板一致）：
 *   REQUIREMENTS.md 需求清单首列即需求编号，编号形态由实得编号归纳，不预设前缀恒常与编号连续
 *   AC.md 中条目形如 "AC-001"、"AC-002"…，「对应需求」列引用需求编号
 *   DESIGN.md 验收要点中引用形如 "AC-001"（模块承接）；契约表「消费方模块」列填模块名或路径
 *   TEST_PLAN.md 用例表"覆盖的 AC/验收要点"列中引用形如 "AC-001"
 */

const fs = require("fs");
const path = require("path");
// 读取失败回空串而非中断：AC.md 与追溯文档读不到时仍给出结构化缺口结论，消费端不以栈信息判读
const { readFileText } = require("./lib/text.js");
const { capLines } = require("./lib/truncate.js");
const { checkContractFingerprint } = require("./fingerprint");
const { absoluteDesignDir } = require("./design-root");
const { walk, DOC_TREE_SKIP_DIR_NAMES } = require("./lib/walk");
const { isMethodologyRepo, methodologyReason, NOT_APPLICABLE_TAIL } = require("./lib/repo-scope.js");
const { readTable, sectionBody, readContractTable, interfaceExported } = require("./lib/span-compare.js");
const { checkObligations } = require("./lib/obligations.js");

const root = process.argv[2] || process.cwd();
const problems = [];
const warnings = [];

// ---- 收集文件 ----
// 遍历与排除集复用 scripts/lib/walk.js；设计树与测试树是待校验对象，须用不排除 docs/build 等命名的口径，
// 否则 docs/design 下名为 build/dist 的子目录会被漏检；不存在的目录由 walk 回传空清单，扩展名筛选由本脚本自理
const collectFiles = (dir, ext) => walk(dir, DOC_TREE_SKIP_DIR_NAMES).filter((f) => f.endsWith(ext));

const AC_RE = /\bAC-\d{3,}\b/g;      // 标准格式：三位及以上数字
const AC_LOOSE_RE = /\bAC-\d{1,}\b/g; // 宽松格式：检测变体（AC-1、ac-001 等）

// ---- 输出组装 ----
// 明细与固定行分离：超限时自尾部回撤明细，末行机读结论与截断计数行不受影响
function capTraceReport(head, details, tail) {
  const build = (keep) => {
    const out = head.concat(details.slice(0, keep));
    if (keep < details.length) out.push(`明细已截断：共 ${details.length} 项，已列 ${keep} 项`);
    return out.concat(tail);
  };
  return capLines({ total: details.length, build });
}

// ---- 0. 方法论仓库自身：报不适用而非缺口 ----
// 判据取文件存在性而非根路径字面量，与 span-check 共用 lib/repo-scope.js 的同一实现：
// 根含 skill/ddd-methodology/SKILL.md 且无 REQUIREMENTS.md 者即方法论仓库自身，此类仓库无 AC.md 等应用侧产物，
// G2/G4/G5 门禁无判定对象，按规范「本仓库适用边界」节报不适用并退出 0
if (isMethodologyRepo(root)) {
  const message = capTraceReport(
    ["=== DDD 追溯一致性校验 ==="],
    [methodologyReason("G2/G4/G5 门禁无判定对象")],
    NOT_APPLICABLE_TAIL,
  );
  console.log(message.join("\n"));
  process.exit(0);
}

// ---- 1. 总 AC ----
const acFile = path.join(root, "AC.md");
if (!fs.existsSync(acFile)) {
  // 无 G2 前置时无判定对象，仍给出机读结论，供消费方按末行统一解析
  const message = capTraceReport(
    ["=== DDD 追溯一致性校验 ==="],
    ["[错误] 未找到 AC.md（G2 门禁前置），追溯链无判定对象"],
    ["结果：不通过", "RESULT: gap"],
  );
  console.log(message.join("\n"));
  process.exit(1);
}
const totalACs = [...new Set(readFileText(acFile).match(AC_RE) || [])];
if (totalACs.length === 0) problems.push("AC.md 中未发现任何 AC-xxx 编号条目");

// ---- 2. 模块级 AC（DESIGN.md）——锚定章节提取，避免变更记录等散文提及导致假通过 ----
// 设计树根路径解析见 scripts/design-root.js，与 governance-check 同源，避免两处口径漂移
const designRoot = absoluteDesignDir(root);
if (!designRoot.declared) warnings.push("ARCHITECTURE.md 未找到设计文档树根路径声明，已回退 docs/design；建议补声明以消除歧义");
const designDir = designRoot.dir;
const designFiles = collectFiles(designDir, ".md").filter((f) => /DESIGN.*\.md$/i.test(path.basename(f)));
if (designFiles.length === 0) problems.push(`设计树 ${designRoot.dir} 下未发现任何 DESIGN 文档（G4 门禁前置）`);

// 从 DESIGN.md 中仅提取"## 模块级验收要点"章节内的 AC 引用；若无该章节则告警并全文提取（降级）
function extractSectionRefs(text, sectionRe) {
  const m = text.match(sectionRe);
  if (m && m[1]) return [...new Set(m[1].match(AC_RE) || [])];
  return null; // 未找到章节
}
// 锚定正则：章节标题允许带序号前缀（如"## 五、"）与括号后缀，避免措辞微变即降级
const SECTION_RE = /##\s*(?:[一二三四五六七八九十\d]+[、.．]?\s*)?模块级验收要点[^\n]*([\s\S]*?)(?=\n## |$)/;

const coveredByDesign = new Set(); // 被模块承接的总 AC
const moduleACs = new Map();       // 模块文件 → 其引用的 AC
for (const f of designFiles) {
  const text = readFileText(f);
  let refs = extractSectionRefs(text, SECTION_RE);
  if (refs === null) {
    warnings.push(`${path.relative(root, f)} 未找到"## 模块级验收要点"章节，已降级为全文提取（请补齐章节以保证准确性）`);
    refs = [...new Set(text.match(AC_RE) || [])];
  }
  moduleACs.set(path.relative(root, f), refs);
  refs.forEach((r) => coveredByDesign.add(r));
}

// ---- 3. 测试用例覆盖（TEST_PLAN.md）——锚定用例表 ----
const testDir = path.join(root, "docs", "test");
const testFiles = collectFiles(testDir, ".md").filter((f) => /TEST_PLAN.*\.md$/i.test(path.basename(f)));
if (testFiles.length === 0) problems.push(`测试树 ${path.relative(root, testDir) || "docs/test"} 下未发现任何 TEST_PLAN 文档（G5 门禁前置）`);

const coveredByTests = new Set();
for (const f of testFiles) {
  const text = readFileText(f);
  let refs = extractSectionRefs(text, /##\s*(?:[一二三四五六七八九十\d]+[、.．]?\s*)?用例清单[^\n]*([\s\S]*?)(?=\n## |$)/);
  if (refs === null) {
    warnings.push(`${path.relative(root, f)} 未找到"## 用例清单"章节，已降级为全文提取（请补齐章节以保证准确性）`);
    refs = [...new Set(text.match(AC_RE) || [])];
  }
  refs.forEach((r) => coveredByTests.add(r));
}

// 格式变体检查：宽松正则计数 > 标准正则计数 → 存在 AC-1/ac-001 类变体
function variantCheck(text, label) {
  const loose = (text.match(AC_LOOSE_RE) || []).length;
  const std = (text.match(AC_RE) || []).length;
  if (loose > std) warnings.push(`${label} 检测到非标准 AC 编号格式变体（如 AC-1/小写），请统一为 AC-XXX（三位数字），否则可能被静默漏计`);
}

// ---- 3.5 契约指纹一致性（规范「结构与契约的演进治理」节的契约指纹条）——无 docs/design 时 designFiles 为空，自然跳过 ----
let fingerprintsChecked = 0;
for (const f of designFiles) {
  const rel = path.relative(root, f);
  const text = readFileText(f);
  const issue = checkContractFingerprint(text);
  if (issue) problems.push(`${rel} ${issue}`);
  else fingerprintsChecked++;
}

// ---- 4. 校验 ----
// G4：总 AC 被模块承接
for (const ac of totalACs) {
  if (!coveredByDesign.has(ac)) problems.push(`G4 缺口：总 ${ac} 未被任何 DESIGN.md 模块级验收要点承接`);
}
// 悬空：模块引用了不存在的总 AC
for (const [f, refs] of moduleACs) {
  for (const r of refs) if (!totalACs.includes(r)) problems.push(`悬空引用：${f} 引用了不存在的 ${r}`);
}
// G5：模块 AC 被用例覆盖
for (const ac of coveredByDesign) {
  if (!coveredByTests.has(ac)) problems.push(`G5 缺口：${ac}（模块级验收要点）未被任何 TEST_PLAN.md 用例覆盖`);
}
// G4 与 G5：义务核销差集与节点状态合法性，判据见规范「接口先行与冻结」节的义务核销条；任务树未启用时整体报不适用
const obligationFindings = checkObligations({ root, designDir, designFiles, relPath: (f) => path.relative(root, f) });
problems.push(...obligationFindings.problems);
warnings.push(...obligationFindings.warnings);
// 提示
if (designFiles.length > 0 && totalACs.length > 0 && coveredByDesign.size === 0) {
  warnings.push("DESIGN.md 存在但未引用任何 AC 编号，请检查验收要点章节格式");
}

// 格式变体扫描
variantCheck(readFileText(acFile), "AC.md");
for (const f of [...designFiles, ...testFiles]) variantCheck(readFileText(f), path.relative(root, f));

// ---- 4.5 R 编号机械追溯、孤儿与悬空、术语拼写一致性（N-8 / N-9 / N-11）----
// 判据说明的单一权威在规范「结构与注释的机械证据」节的脚本消费契约表处，本处只落机械实现。
// 表格与章节解析原语（readTable、sectionBody）取自签名级模块的同一实现，见 lib/span-compare.js，本脚本不再各写一份
// 需求编号集合：优先锚定「需求清单」节，未命中则退回首个含「编号」表头的表格；编号去标记后取原样，不预设前缀
function readRequirementIds(text) {
  const table = readTable(sectionBody(text, "需求清单") || text, /编号/);
  if (!table) return null;
  const idx = table.headers.findIndex((h) => /编号/.test(h));
  if (idx < 0) return null;
  const ids = table.rows.map((row) => (row[idx] || "").replace(/[`*\s]/g, "")).filter(Boolean);
  return ids.length ? [...new Set(ids)] : null;
}
// 编号形态由实得编号归纳：非数字前缀加数字后缀；前缀不必恒常，取实得前缀集合；无数字后缀或空前缀即不可识别，回 null
function deriveIdPattern(ids) {
  const prefixes = new Set();
  for (const id of ids) {
    const m = id.match(/^(.*?)(\d+)$/);
    if (!m || !m[1]) return null;
    prefixes.add(m[1]);
  }
  const alts = [...prefixes].map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  return new RegExp(`(?:${alts.join("|")})\\d+`, "g");
}
// AC.md 需求列：表头含「AC 编号」的表格取「对应需求」列；回传逐行的 AC 编号与需求列原值
function readAcRequirements(text) {
  const table = readTable(text, /AC\s*编号|AC编号/);
  if (!table) return null;
  const acIdx = table.headers.findIndex((h) => /AC\s*编号|AC编号/.test(h));
  const reqIdx = table.headers.findIndex((h) => /需求/.test(h));
  if (acIdx < 0 || reqIdx < 0) return null;
  return table.rows.map((row) => ({
    ac: ((row[acIdx] || "").match(AC_RE) || [])[0] || (row[acIdx] || "").trim(),
    reqCell: (row[reqIdx] || "").trim(),
  }));
}
// 消费方列取值拆分：去标记后按顿号、逗号、分号与空白切分，回传非空 token
function splitConsumers(cell) {
  return String(cell).replace(/[`*]/g, "").split(/[、,，;；\s]+/).map((s) => s.trim()).filter(Boolean);
}
// 目录基名枚举：递归取目录基名，跳过点开头条目与 node_modules
function dirBaseNames(dir) {
  const out = [];
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    out.push(entry.name);
    out.push(...dirBaseNames(path.join(dir, entry.name)));
  }
  return out;
}

const acRequirements = readAcRequirements(readFileText(acFile));

// N-9 断言一（孤儿 AC）：无需求承接的 AC，即未声明需求编号或编号列为空；只读 AC.md，与 REQUIREMENTS.md 是否存在无关
if (!acRequirements) {
  warnings.push("无法判定：AC.md 未含可解析的「AC 编号」与「对应需求」列，无需求承接的 AC（N-9 断言一）未执行");
} else {
  for (const row of acRequirements) if (!row.reqCell) problems.push(`N-9 孤儿 AC：${row.ac || "（未编号）"} 未声明需求编号`);
}

// N-8：三项断言各自判定前提，缺则逐项报无法判定，不静默判过
const reqFile = path.join(root, "REQUIREMENTS.md");
const requirementsText = fs.existsSync(reqFile) ? readFileText(reqFile) : "";
const requirementIds = requirementsText ? readRequirementIds(requirementsText) : null;
const requirementPattern = requirementIds ? deriveIdPattern(requirementIds) : null;
const requirementKnown = requirementIds ? new Set(requirementIds) : null;
const reqReason = !requirementsText ? "缺 REQUIREMENTS.md"
  : !requirementIds ? "REQUIREMENTS.md 未含可解析的需求编号表（需求清单）"
  : !requirementPattern ? "REQUIREMENTS.md 的编号体系不可识别（无数字后缀或前缀不成立）"
  : null;
const acReason = !acRequirements ? "AC.md 未含可解析的「AC 编号」与「对应需求」列" : null;

if (reqReason) {
  warnings.push(`无法判定：${reqReason} —— N-8 断言一（每条 R 至少被一条 AC 承接）未执行，不静默判过`);
  warnings.push(`无法判定：${reqReason} —— N-8 断言二（每条 AC 引用的 R 真实存在）未执行，不静默判过`);
  warnings.push(`无法判定：${reqReason} —— N-8 断言三（编号体系识别，不预设编号连续性）未执行，不静默判过`);
} else if (acReason) {
  warnings.push(`无法判定：${acReason} —— N-8 断言一（每条 R 至少被一条 AC 承接）未执行，不静默判过`);
  warnings.push(`无法判定：${acReason} —— N-8 断言二（每条 AC 引用的 R 真实存在）未执行，不静默判过`);
} else {
  const coveredR = new Set();
  for (const row of acRequirements) {
    for (const ref of row.reqCell.match(requirementPattern) || []) {
      if (requirementKnown.has(ref)) coveredR.add(ref);
      else problems.push(`N-8 悬空引用：${row.ac || "（未编号）"} 引用了 REQUIREMENTS.md 中不存在的 ${ref}`);
    }
  }
  for (const id of requirementIds) if (!coveredR.has(id)) problems.push(`N-8 覆盖缺口：需求 ${id} 未被任何 AC 承接`);
}

// N-9 断言二、断言三与 N-11 的 DESIGN 侧输入：逐份 DESIGN 取「对外接口与约定」契约表
const designConsumers = [];
const logicalConsumers = [];
const designContractRows = []; // 断言二输入：契约表接口名与消费方列，供签名级提取能力判定代码侧是否有对应导出
for (const f of designFiles) {
  const rel = path.relative(root, f);
  const designText = readFileText(f);
  // 契约表读取与接口存在性判定复用签名级模块的同一实现，不把比对逻辑复制到本脚本
  for (const row of readContractTable(designText) || []) designContractRows.push({ rel, ...row });
  const table = readTable(sectionBody(designText, "对外接口与约定") || designText, /消费方/);
  if (!table) continue;
  const idx = table.headers.findIndex((h) => /消费方/.test(h));
  if (idx < 0) continue;
  for (const row of table.rows) {
    for (const value of splitConsumers(row[idx] || "")) {
      designConsumers.push(value);
      if (fs.existsSync(path.join(root, value))) continue; // 能对应项目根下的目录或文件即通过
      if (/[\\/]/.test(value)) problems.push(`N-9 悬空接口引用：${rel} 的消费方模块「${value}」不对应项目根下的目录或文件`);
      else logicalConsumers.push(`${value}（${rel}）`);
    }
  }
}
if (logicalConsumers.length) {
  warnings.push(`无法判定：消费方模块 ${logicalConsumers.join("、")} 为逻辑模块名而非路径，未做模糊匹配，N-9 断言三对这几项未执行`);
}

// N-11 术语拼写一致性：三面模块名的精确比较——按去分隔符、转小写归一为同一键，键内原始拼写须逐字唯一。
// 仅当同一键跨两个以上面且出现两种以上拼写时才报，全程为等值比较，不使用任何相似度阈值。界：只做拼写，不判语义漂移
if (designConsumers.length) {
  const SPELLING_SURFACE = { design: "DESIGN 消费方列", code: "代码目录树", test: "TEST_PLAN 路径" };
  const spellingGroups = new Map();
  const addSpelling = (surface, raw) => {
    const token = String(raw).trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(token)) return;
    const key = token.replace(/[-_]/g, "").toLowerCase();
    const byRaw = spellingGroups.get(key) || new Map();
    byRaw.set(token, (byRaw.get(token) || new Set()).add(surface));
    spellingGroups.set(key, byRaw);
  };
  for (const value of designConsumers) for (const seg of value.split(/[\\/]+/)) addSpelling("design", seg);
  for (const name of dirBaseNames(root)) addSpelling("code", name);
  for (const f of testFiles) for (const seg of path.relative(root, f).split(path.sep).slice(0, -1)) addSpelling("test", seg);
  for (const [key, byRaw] of spellingGroups) {
    if (byRaw.size < 2) continue;
    const surfaces = new Set();
    for (const set of byRaw.values()) for (const s of set) surfaces.add(s);
    if (surfaces.size < 2) continue;
    const variants = [...byRaw.entries()].map(([raw, set]) => `${raw}（${[...set].map((s) => SPELLING_SURFACE[s]).join("、")}）`);
    problems.push(`N-11 拼写不一致：模块名键 ${key} 在不同面拼写不一：${variants.join(" vs ")}`);
  }
}

// ---- 4.6 N-9 断言二：无设计来源的接口（复用签名级提取能力）----
// 契约表接口在消费方模块所指代码文件中无对应导出者报缺口；语言推导不出、消费方列非文件路径或解析器未安装时报「无法判定」并说明，不静默判过
async function checkInterfaceSources() {
  for (const row of designContractRows) {
    const result = await interfaceExported(root, row);
    const label = `${row.rel} 的接口「${row.interfaceName || "（无接口名）"}」`;
    if (result.ok && !result.found) problems.push(`N-9 无设计来源的接口：${label} 在代码侧 ${result.file} 无对应导出`);
    else if (!result.ok) warnings.push(`无法判定：${result.reason} —— N-9 断言二（无设计来源的接口）对 ${label} 未执行，不静默判过`);
  }
}

// ---- 5. 输出 ----
async function main() {
  await checkInterfaceSources();
  const head = [
  "=== DDD 追溯一致性校验 ===",
  `总 AC：${totalACs.length} 条；需求编号：${requirementIds ? `${requirementIds.length} 条` : "未判定"}；DESIGN.md：${designFiles.length} 份；TEST_PLAN.md：${testFiles.length} 份；契约指纹已校验 ${fingerprintsChecked} 份`,
];
  const details = [];
  if (warnings.length) {
    details.push("", "[警告]");
    warnings.forEach((w) => details.push(`  ⚠ ${w}`));
  }
  if (problems.length) {
    details.push("", "[缺口]（退出码 1）");
    problems.forEach((p) => details.push(`  ✗ ${p}`));
  }
  const tail = problems.length
    ? ["", `结果：未通过（${problems.length} 项缺口，${warnings.length} 项警告）`, "RESULT: gap"]
    : ["", "结果：通过 ✓（可作为 G2 追溯性、G4 与 G5 门禁的机械证据）", "RESULT: pass"];

  console.log(capTraceReport(head, details, tail).join("\n"));
  process.exit(problems.length ? 1 : 0);
}

main();
