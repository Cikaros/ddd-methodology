#!/usr/bin/env node
/**
 * 目标：把「脚本族可用」这件事本身外化为可复现的机械证据，闭合「机械校验有盲区、工具链自身无测试」的盲区。
 * 范围：三项断言——其一，scripts/ 下全部 .js 逐个过 node --check，任一不通过即失败，直接防止整族集体静默失效；
 *   其二，对每个有命令行入口的脚本以本仓库根为参数运行并记退出码，超时记 timeout 并判失败，不得静默跳过；
 *   其三，退出码与基线文件比对，不一致即打印差异并失败。
 * 不包含：各脚本的业务语义与输出内容判定、ref-check 的跨文档校验（本脚本不并入 ref-check，
 *   因其要运行其它脚本，并入会自引用并拖慢主校验）。不引入第三方依赖。
 * 用法：node toolchain-selftest.js <仓库根> [--init]；--init 按本次实测结果重写基线。
 * 基线：scripts/lib/toolchain-baseline.json，记录每个入口脚本在本仓库的预期退出码，由首次运行生成并纳入版本管理，
 *   此后仅由人工在确有正当变化时以 --init 更新。
 * 输出形态：文本正文；末行机读结论 `RESULT: pass`（全部符合）或 `RESULT: fail`（存在不一致）。
 * 退出码：0 全部符合基线，1 存在语法失败、运行失败、超时或退出码与基线不一致。
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const TIMEOUT_MS = 120000; // 单个入口的运行上限，超时判失败，避免挂死拖垮自测
// 不入自动调用的入口：自身运行会递归；apply-models 与 migrate-to-package 写入用户作用域且依赖仓库在场，
// 二者非本仓库内可安全自动调用的入口，故连同自身一并排除
const EXCLUDED_ENTRIES = new Set(["toolchain-selftest.js", "apply-models.js", "migrate-to-package.js"]);
const BASELINE_REL = ["scripts", "lib", "toolchain-baseline.json"];

const argv = process.argv.slice(2);
const initMode = argv.includes("--init");
const root = path.resolve(argv.find((a) => !a.startsWith("--")) || process.cwd());
const SCRIPTS_DIR = path.join(root, "scripts");
const relOf = (file) => path.relative(root, file).split(path.sep).join("/");

// 递归枚举 scripts/ 下全部 .js，点开头条目跳过；语法断言的面与运行断言的面由此一次取得
function listScripts(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listScripts(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}
// 入口判定：首行 shebang 即命令行入口；库模块无可运行入口，不参与运行与退出码断言
function hasEntry(file) {
  try { return /^#!/.test(fs.readFileSync(file, "utf8")); } catch (e) { return false; }
}
// 退出码归类：超时（含被信号终止）一律记 timeout，其余取进程退出码
function outcomeOf(result) {
  if (result.error && result.error.code === "ETIMEDOUT") return "timeout";
  if (result.status === null) return "timeout";
  return result.status;
}

const scripts = listScripts(SCRIPTS_DIR);
const syntaxFailures = [];
for (const file of scripts) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status === 0) continue;
  // 取含 Error 的首行作细节，node 的在尾行版本标语不具诊断价值
  const errLines = String(result.stderr || "").split("\n").map((line) => line.trim()).filter(Boolean);
  syntaxFailures.push(`${relOf(file)}：${errLines.find((line) => /Error/.test(line)) || errLines[0] || "node --check 失败"}`);
}
const entries = scripts.filter((file) => hasEntry(file) && !EXCLUDED_ENTRIES.has(path.basename(file)));

const observed = {};
const runFailures = [];
for (const file of entries) {
  const result = spawnSync(process.execPath, [file, root], { cwd: root, encoding: "utf8", timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  const outcome = outcomeOf(result);
  observed[relOf(file)] = outcome;
  if (outcome === "timeout") runFailures.push(`${relOf(file)}：运行超时（> ${TIMEOUT_MS}ms）`);
}

const baselinePath = path.join(root, ...BASELINE_REL);
let baseline;
let baselineNote;
if (initMode || !fs.existsSync(baselinePath)) {
  baseline = { generatedAt: new Date().toISOString(), timeoutMs: TIMEOUT_MS, entries: observed };
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
  baselineNote = `${initMode ? "--init 重写" : "首次生成"}基线：${relOf(baselinePath)}（${Object.keys(observed).length} 项）`;
} else {
  try { baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")); } catch (e) { baseline = null; }
  baselineNote = baseline && baseline.entries ? `读取基线：${relOf(baselinePath)}（${Object.keys(baseline.entries).length} 项）` : `${relOf(baselinePath)} 无法解析`;
}

// 退出码比对：逐入口对照基线，缺登记与值不符均为不一致；基线中的多余项一并报出，防陈旧条目滞留
const mismatches = [];
if (!baseline || !baseline.entries || typeof baseline.entries !== "object") {
  mismatches.push(`${relOf(baselinePath)} 缺少 entries 映射`);
} else {
  for (const key of Object.keys(observed)) {
    if (!(key in baseline.entries)) mismatches.push(`${key}：基线未登记（实测 ${observed[key]}）`);
    else if (baseline.entries[key] !== observed[key]) mismatches.push(`${key}：基线 ${baseline.entries[key]}，实测 ${observed[key]}`);
  }
  for (const key of Object.keys(baseline.entries)) {
    if (!(key in observed)) mismatches.push(`${key}：基线含多余项，仓库中已无此入口`);
  }
}

const failed = syntaxFailures.length > 0 || runFailures.length > 0 || mismatches.length > 0;
const lines = [];
lines.push("=== 工具链自测 ===");
lines.push(`仓库根：${root}`);
lines.push(`语法：${scripts.length} 个 .js 过 node --check，失败 ${syntaxFailures.length}`);
for (const item of syntaxFailures) lines.push(`  ✗ ${item}`);
lines.push(`入口：${entries.length} 个（自检脚本 ${scripts.length} 个，含命令行入口且有 shebang 者；排除自身与两个写入用户作用域的脚本）`);
lines.push(`基线：${baselineNote}`);
for (const [key, value] of Object.entries(observed)) lines.push(`  · ${key} 退出码 ${value}`);
if (runFailures.length) { lines.push("[运行失败]"); for (const item of runFailures) lines.push(`  ✗ ${item}`); }
if (mismatches.length) { lines.push("[退出码不一致]"); for (const item of mismatches) lines.push(`  ✗ ${item}`); }
lines.push("");
lines.push(failed ? `结果：未通过（语法失败 ${syntaxFailures.length}，运行失败 ${runFailures.length}，不一致 ${mismatches.length}）` : `结果：通过（${entries.length} 个入口全部符合基线）`);
lines.push(failed ? "RESULT: fail" : "RESULT: pass");
console.log(lines.join("\n"));
process.exit(failed ? 1 : 0);
