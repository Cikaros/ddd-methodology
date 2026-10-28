#!/usr/bin/env node
/**
 * DDD-Methodology 追溯一致性校验脚本（只读）
 *
 * 用法：node trace-check.js <项目根>
 * 校验链：AC.md 总验收 ↔ 各 DESIGN.md 模块级验收要点 ↔ 各 TEST_PLAN.md 用例表；作为 G4 与 G5 门禁证据
 * 输出：未覆盖（总 AC 无模块承接 / 模块 AC 无用例覆盖）与悬空引用（引用了不存在的 AC 编号）清单
 * 退出码：0=通过，可作为 G4/G5 门禁证据；1=存在缺口
 *
 * 约定格式（与 templates.md 模板一致）：
 *   AC.md 中条目形如 "AC-001"、"AC-002"…
 *   DESIGN.md 验收要点中引用形如 "AC-001"（模块承接）
 *   TEST_PLAN.md 用例表"覆盖的 AC/验收要点"列中引用形如 "AC-001"
 */

const fs = require("fs");
const path = require("path");
const { checkContractFingerprint } = require("./fingerprint");
const { absoluteDesignDir } = require("./design-root");

const root = process.argv[2] || process.cwd();
const problems = [];
const warnings = [];

// ---- 收集文件 ----
function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    warnings.push(`目录不可读，已跳过：${dir}（${e.code || e.message}）`);
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
const AC_RE = /\bAC-\d{3,}\b/g;      // 标准格式：三位及以上数字
const AC_LOOSE_RE = /\bAC-\d{1,}\b/g; // 宽松格式：检测变体（AC-1、ac-001 等）

// ---- 1. 总 AC ----
const acFile = path.join(root, "AC.md");
if (!fs.existsSync(acFile)) {
  console.error("[错误] 未找到 AC.md（G2 门禁前置）");
  process.exit(1);
}
const totalACs = [...new Set(read(acFile).match(AC_RE) || [])];
if (totalACs.length === 0) problems.push("AC.md 中未发现任何 AC-xxx 编号条目");

// ---- 2. 模块级 AC（DESIGN.md）——锚定章节提取，避免变更记录等散文提及导致假通过 ----
// 设计树根路径解析见 scripts/design-root.js，与 governance-check 同源，避免两处口径漂移
const designRoot = absoluteDesignDir(root);
if (!designRoot.declared) warnings.push("ARCHITECTURE.md 未找到设计文档树根路径声明，已回退 docs/design；建议补声明以消除歧义");
const designDir = designRoot.dir;
const designFiles = (fs.existsSync(designDir) ? walk(designDir, ".md") : []).filter((f) => /DESIGN.*\.md$/i.test(path.basename(f)));
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
  const text = read(f);
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
const testFiles = (fs.existsSync(testDir) ? walk(testDir, ".md") : []).filter((f) => /TEST_PLAN.*\.md$/i.test(path.basename(f)));
if (testFiles.length === 0) problems.push(`测试树 ${path.relative(root, testDir) || "docs/test"} 下未发现任何 TEST_PLAN 文档（G5 门禁前置）`);

const coveredByTests = new Set();
for (const f of testFiles) {
  const text = read(f);
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

// ---- 3.5 契约指纹一致性（spec §16）——无 docs/design 时 designFiles 为空，自然跳过 ----
let fingerprintsChecked = 0;
for (const f of designFiles) {
  const rel = path.relative(root, f);
  const text = read(f);
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
// G2：AC.md 双向可追溯的基本检查（需求编号列存在性）
if (!/\|?\s*需求编号|需求ID|对应需求/.test(read(acFile))) {
  warnings.push("AC.md 未检测到需求编号追溯列（G2 双向追溯依据），建议模板补充");
}
// 提示
if (designFiles.length > 0 && totalACs.length > 0 && coveredByDesign.size === 0) {
  warnings.push("DESIGN.md 存在但未引用任何 AC 编号，请检查验收要点章节格式");
}

// 格式变体扫描
variantCheck(read(acFile), "AC.md");
for (const f of [...designFiles, ...testFiles]) variantCheck(read(f), path.relative(root, f));

// ---- 5. 输出 ----
console.log("=== DDD 追溯一致性校验 ===");
console.log(`总 AC：${totalACs.length} 条；DESIGN.md：${designFiles.length} 份；TEST_PLAN.md：${testFiles.length} 份；契约指纹已校验 ${fingerprintsChecked} 份`);
if (warnings.length) {
  console.log("\n[警告]");
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}
if (problems.length) {
  console.log("\n[缺口]（退出码 1）");
  problems.forEach((p) => console.log(`  ✗ ${p}`));
  console.log(`\n结果：未通过（${problems.length} 项缺口，${warnings.length} 项警告）`);
  process.exit(1);
}
console.log("\n结果：通过 ✓（可作为 G4/G5 门禁证据）");
