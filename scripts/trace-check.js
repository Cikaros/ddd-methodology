#!/usr/bin/env node
/**
 * DDD-Methodology 追溯一致性校验脚本（只读）
 *
 * 用法：node trace-check.js <项目根>
 * 校验链：AC.md 总验收 ↔ 各 DESIGN.md 模块级验收要点 ↔ 各 TEST_PLAN.md 用例表
 * 输出：未覆盖（总 AC 无模块承接 / 模块 AC 无用例覆盖）与悬空引用（引用了不存在的 AC 编号）清单
 * 退出码：0=通过（可作为 G2/G4/G5 门禁证据）；1=存在缺口
 *
 * 约定格式（与 templates.md 模板一致）：
 *   AC.md 中条目形如 "AC-001"、"AC-002"…
 *   DESIGN.md 验收要点中引用形如 "AC-001"（模块承接）
 *   TEST_PLAN.md 用例表"覆盖的 AC/验收要点"列中引用形如 "AC-001"
 */

const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const problems = [];
const warnings = [];

// ---- 收集文件 ----
function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
const AC_RE = /\bAC-\d{3,}\b/g;

// ---- 1. 总 AC ----
const acFile = path.join(root, "AC.md");
if (!fs.existsSync(acFile)) {
  console.error("[错误] 未找到 AC.md（G2 门禁前置）");
  process.exit(1);
}
const totalACs = [...new Set(read(acFile).match(AC_RE) || [])];
if (totalACs.length === 0) problems.push("AC.md 中未发现任何 AC-xxx 编号条目");

// ---- 2. 模块级 AC（DESIGN.md） ----
const designDir = path.join(root, "docs", "design");
const designFiles = fs.existsSync(designDir) ? walk(designDir, ".md") : [];
if (designFiles.length === 0) problems.push("docs/design/ 下未发现任何 DESIGN.md（G4 门禁前置）");

const coveredByDesign = new Set(); // 被模块承接的总 AC
const moduleACs = new Map();       // 模块文件 → 其引用的 AC
for (const f of designFiles) {
  const refs = [...new Set(read(f).match(AC_RE) || [])];
  moduleACs.set(path.relative(root, f), refs);
  refs.forEach((r) => coveredByDesign.add(r));
}

// ---- 3. 测试用例覆盖（TEST_PLAN.md） ----
const testDir = path.join(root, "docs", "test");
const testFiles = fs.existsSync(testDir) ? walk(testDir, ".md") : [];
if (testFiles.length === 0) problems.push("docs/test/ 下未发现任何 TEST_PLAN.md（G5 门禁前置）");

const coveredByTests = new Set();
for (const f of testFiles) {
  const refs = [...new Set(read(f).match(AC_RE) || [])];
  refs.forEach((r) => coveredByTests.add(r));
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

// ---- 5. 输出 ----
console.log("=== DDD 追溯一致性校验 ===");
console.log(`总 AC：${totalACs.length} 条；DESIGN.md：${designFiles.length} 份；TEST_PLAN.md：${testFiles.length} 份`);
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
console.log("\n结果：通过 ✓（可作为 G2/G4/G5 门禁证据）");
