/**
 * scripts/map.mjs —— 图集重放与巡检（M9）。
 *
 * 由 docs/maps.json（项目图集 delta）与设计树快照重放产出 docs/maps/MAPS.md。
 * 产图者不宣判（审计独立）。
 * 用法：node scripts/map.mjs <replay|check> [--root <项目根>]
 * 退出码：0 过；1 失败（派生不一致/引用面不可解析）；2 用法错。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const k = a.slice(2); const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) out[k] = true; else { out[k] = n; i++; } }
    else out._.push(a);
  }
  return out;
}
function usage(msg) { if (msg) console.error(`用法错：${msg}`); console.error("用法：node scripts/map.mjs <replay|check> [--root <项目根>]"); process.exit(2); }
function fail(msg) { console.error(`失败：${msg}`); process.exit(1); }

const argv = process.argv.slice(2);
const sub = argv[0];
if (!sub) usage("缺少子命令");
const args = parseArgs(argv.slice(1));
const root = args.root && args.root !== true ? resolve(String(args.root)) : process.cwd();

const mapsJson = join(root, "docs", "maps.json");
const snapshotPath = join(root, "docs", "reports", "design-tree.json");
const mapsMd = join(root, "docs", "maps", "MAPS.md");

function readDelta() {
  if (!existsSync(mapsJson)) return { add: [], override: [], disable: [] };
  try {
    const o = JSON.parse(readFileSync(mapsJson, "utf8"));
    return { add: o.add ?? [], override: o.override ?? [], disable: o.disable ?? [] };
  } catch {
    fail("docs/maps.json 不是合法 JSON。remedy：修正 delta。");
  }
}
function readSnapshot() {
  if (!existsSync(snapshotPath)) return null;
  try { return JSON.parse(readFileSync(snapshotPath, "utf8")); } catch { return null; }
}

function render(delta, snap) {
  const lines = ["<!-- 派生视图，由 scripts/map.mjs replay 生成；禁手改 -->", "# 图集（MAPS.md）", ""];
  lines.push("## delta");
  lines.push("");
  for (const k of ["add", "override", "disable"]) {
    lines.push(`### ${k}（${(delta[k] || []).length}）`);
    for (const it of delta[k] || []) lines.push(`- ${typeof it === "string" ? it : JSON.stringify(it)}`);
    lines.push("");
  }
  lines.push("## 设计树快照摘要");
  lines.push("");
  if (snap) {
    lines.push(`- 设计件：${snap.counts?.design ?? "?"}；测试件：${snap.counts?.test ?? "?"}；用例编号：${snap.counts?.ids ?? "?"}`);
    const g = snap.gaps ?? {};
    lines.push(`- 缺口：unitTests=${(g.missingUnitTests || []).length} groupTests=${(g.missingGroupTests || []).length} dupTargets=${(g.duplicateTargets || []).length} dupIds=${(g.duplicateIds || []).length}`);
  } else {
    lines.push("- （无快照；先运行 scripts/snapshot.mjs）");
  }
  lines.push("");
  return lines.join("\n");
}
function normalize(s) { return s.replace(/\r\n/g, "\n").trim(); }

const delta = readDelta();
const snap = readSnapshot();

// 引用面巡检：add/override/disable 的字符串项若形如路径，须可解析（R20 判据④）。
for (const k of ["add", "override", "disable"]) {
  for (const it of delta[k] || []) {
    if (typeof it === "string" && /[/\\]/.test(it) && !it.includes("*")) {
      const p = join(root, it);
      if (!existsSync(p) && !existsSync(join(root, "docs", "ddd", it))) fail(`引用面不可解析：${it}（R20 判据④）`);
    }
  }
}

if (sub === "replay") {
  mkdirSync(dirname(mapsMd), { recursive: true });
  writeFileSync(mapsMd, render(delta, snap), "utf8");
  console.log("已重放 docs/maps/MAPS.md。");
  process.exit(0);
}
if (sub === "check") {
  if (!existsSync(mapsMd)) fail("派生视图 docs/maps/MAPS.md 不存在；先运行 replay。");
  if (normalize(readFileSync(mapsMd, "utf8")) !== normalize(render(delta, snap))) fail("派生视图与重放不一致（手改或未重放）。remedy：重跑 replay。");
  console.log("map check OK：派生视图一致且引用面可解析。");
  process.exit(0);
}
usage(`未知子命令 ${sub}`);
