/**
 * scripts/scaffold.mjs —— 项目骨架生成器（F7 / R1 的机械承接）。
 *
 * 在当前项目根落项目级骨架：根文档三件 + docs/ 固定位置清单 + 空图集 + 快照；并物化随包件。
 * 幂等；默认不覆盖既有件（需 --force）。
 * 用法：node scripts/scaffold.mjs [--root <项目根>] [--force]
 * 退出码：0 过；1 失败（根文档白名单违规/写失败）；2 用法错。
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
const force = args.force === true;

const created = [], skipped = [], diffs = [];

function writeFileIdempotent(rel, content) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  if (existsSync(p)) {
    if (readFileSync(p, "utf8") === content) { skipped.push(rel); return; }
    if (!force) { diffs.push(rel); return; }
  }
  writeFileSync(p, content, "utf8");
  created.push(rel);
}
function ensureDir(rel) {
  const p = join(root, rel);
  if (existsSync(p)) { skipped.push(rel + "/"); return; }
  mkdirSync(p, { recursive: true });
  created.push(rel + "/");
}

// —— 根文档白名单（R12）：仅三件；已存在第四件文档即违规 ——
const ROOT_DOCS = ["AGENTS.md", "README.md", "CONTRIBUTING.md"];
try {
  const extra = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(md|markdown)$/i.test(e.name))
    .map((e) => e.name)
    .filter((n) => !ROOT_DOCS.includes(n));
  if (extra.length) {
    console.error(`失败：根目录出现白名单外的第 ${ROOT_DOCS.length + 1}+ 件文档（R12）：${extra.join(", ")}`);
    process.exit(1);
  }
} catch { /* 目录不可读则跳过该检查 */ }

// —— 根文档三件 ——
writeFileIdempotent("AGENTS.md", "# AGENTS.md\n\n> 本项目的代理指令入口（唯一权威）。由 ddd 方法论维护。\n");
writeFileIdempotent("README.md", "# 项目\n\n由 ddd 方法论（Hermess 2.0）初始化。文档为唯一权威，代码为其落地。\n");
writeFileIdempotent("CONTRIBUTING.md", "# 贡献指南\n\n先改文档，再落地代码；变更须落 `docs/CHANGELOG.jsonl` 三字段。\n");

// —— docs/ 固定位置清单（R11 / 概要 §4.2）——
writeFileIdempotent("docs/GLOSSARY.md", "# 术语表（唯一权威）\n\n> 新术语先在此补条再引用。\n");
writeFileIdempotent("docs/ARCHITECTURE.md", "# 架构基线\n\n## 技术栈\n\n## 核心依赖\n\n## 目录结构\n\n## 环境探查\n");
writeFileIdempotent("docs/CHANGELOG.jsonl", "");
writeFileIdempotent("docs/temp.jsonl", "");
writeFileIdempotent("docs/maps.json", JSON.stringify({ add: [], override: [], disable: [] }, null, 2) + "\n");
for (const d of ["docs/requirements", "docs/ddd", "docs/reports", "docs/audits", "docs/maps", "docs/board", "docs/memory"]) ensureDir(d);

// —— 物化随包件（外形/命令），使宿主可发现（F5）——
const mz = spawnSync(process.execPath, [join(packageRoot, "scripts", "materialize.mjs"), "all", "--root", root], { encoding: "utf8" });
const matOk = mz.status === 0;
if (mz.stdout) process.stdout.write(mz.stdout);
if (mz.stderr) process.stderr.write(mz.stderr);

// —— 机器可读快照（若可生成）——
const snap = spawnSync(process.execPath, [join(packageRoot, "scripts", "snapshot.mjs"), "--root", root], { encoding: "utf8" });
if (snap.stdout) process.stdout.write(snap.stdout);

console.log(`scaffold：新建 ${created.length}、跳过 ${skipped.length}、差异未覆盖 ${diffs.length}`);
if (diffs.length) {
  console.error(`存在差异未覆盖（加 --force）：${diffs.join(", ")}`);
}
if (!matOk) { console.error("失败：物化随包件失败。"); process.exit(1); }
process.exit(diffs.length && !force ? 1 : 0);
