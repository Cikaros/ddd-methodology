/**
 * scripts/drift-check.mjs —— 反漂移复写扫描（M10）。
 *
 * 检「同一事实在权威件之外再写具体值」；核「权威件取值 = 实物」（R13）。
 * 用法：node scripts/drift-check.mjs [--root <项目根>] [--check]
 * 退出码：0 零复写；1 检出复写/不一致；2 用法错。
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const k = a.slice(2); const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) out[k] = true; else { out[k] = n; i++; } }
    else out._.push(a);
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const root = args.root && args.root !== true ? resolve(String(args.root)) : process.cwd();

const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return undefined; } };
const checks = [];
function addCheck(id, authority, mirrors, ok, findings) { checks.push({ id, authority, mirrors, ok, findings }); }

// 1) commands.json（权威） = registry.COMMANDS（运行期投影）
try {
  const auth = readJson(join(packageRoot, "assets", "commands.json"));
  const reg = await import(new URL("../src/lib/registry.ts", import.meta.url).href);
  const names = (auth?.commands ?? []).map((c) => c.name);
  const proj = (reg.COMMANDS ?? []).map((c) => c.name);
  const ok = names.length === proj.length && names.every((n, i) => n === proj[i]);
  addCheck("drift.commands", "assets/commands.json", "src/lib/registry.ts#COMMANDS", ok, ok ? [] : [`长度 ${names.length} vs ${proj.length}`]);
} catch (e) { addCheck("drift.commands", "assets/commands.json", "src/lib/registry.ts", false, [String(e?.message ?? e)]); }

// 2) gates.json 门禁条数 = 6
{
  const auth = readJson(join(packageRoot, "assets", "gates.json"));
  const n = (auth?.gates ?? []).length;
  addCheck("drift.gates-count", "assets/gates.json", "（条数=6）", n === 6, n === 6 ? [] : [`实为 ${n}`]);
}

// 3) languages.json ↔ skills/lang/<id> 目录齐备
{
  const auth = readJson(join(packageRoot, "assets", "languages.json"));
  const ids = (auth?.languages ?? []).map((l) => l.id);
  const missing = ids.filter((id) => !existsSync(join(packageRoot, "skills", "lang", id, "SKILL.md")));
  const extra = existsSync(join(packageRoot, "skills", "lang"))
    ? readdirSync(join(packageRoot, "skills", "lang"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).filter((n) => !ids.includes(n))
    : [];
  addCheck("drift.languages", "assets/languages.json", "skills/lang/*", missing.length === 0 && extra.length === 0, [...missing.map((m) => `缺目录 ${m}`), ...extra.map((x) => `多目录 ${x}`)]);
}

// 4) 阈值不内置：代码不得硬编码 board/memory 阈值
{
  const code = [];
  for (const dir of ["src", "scripts"]) {
    if (!existsSync(join(packageRoot, dir))) continue;
    (function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|mjs)$/.test(e.name)) code.push(readFileSync(p, "utf8")); } })(join(packageRoot, dir));
  }
  const blob = code.join("\n");
  const hits = [];
  if (/starvationWindow\s*[:=]\s*\d+/.test(blob) && !/assets\/board\.json/.test(blob)) hits.push("board 阈值疑似内置");
  if (/remindAt\s*[:=]\s*\d+/.test(blob) && !/assets\/memory\.json/.test(blob)) hits.push("memory 阈值疑似内置");
  addCheck("drift.no-inline-thresholds", "assets/board.json + assets/memory.json", "src/** + scripts/**", hits.length === 0, hits);
}

const ok = checks.every((c) => c.ok);
const report = { ts: new Date().toISOString(), checks, ok };
const outPath = join(root, "docs", "reports", "drift-check.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

if (!ok) {
  console.error("失败：反漂移扫描检出复写/不一致。");
  for (const c of checks.filter((x) => !x.ok)) console.error(`  - ${c.id}: ${c.findings.join("; ")}`);
  console.error("remedy：把具体值只留在权威件，其余引用不复写。");
  process.exit(1);
}
console.log(`drift-check OK：${checks.length} 项零复写。`);
process.exit(0);
