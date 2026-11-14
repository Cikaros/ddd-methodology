/**
 * scripts/snapshot.mjs —— 设计树机器可读快照（M1）。
 *
 * 重放 docs/ddd/** 的受控 frontmatter 为快照（同构/覆盖/漂移的判定底座）。
 * 快照是派生件，禁手改。
 * 用法：node scripts/snapshot.mjs [--root <项目根>] [--check]
 * 退出码：0 过；1 失败（快照与设计树不一致，含手改检出）；2 用法错。
 */

import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { writeReportJson } from "./report-io.mjs";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const n = argv[i + 1];
      if (n === undefined || n.startsWith("--")) out[k] = true;
      else { out[k] = n; i++; }
    } else out._.push(a);
  }
  return out;
}
function usage(msg) {
  if (msg) console.error(`用法错：${msg}`);
  console.error("用法：node scripts/snapshot.mjs [--root <项目根>] [--check]");
  process.exit(2);
}

const args = parseArgs(process.argv.slice(2));
const root = args.root && args.root !== true ? resolve(String(args.root)) : process.cwd();
const dddRoot = join(root, "docs", "ddd");
if (!existsSync(dddRoot)) {
  // 无设计树：na，退出 0（不判通过）。
  console.log("无设计树（na，不判通过）。");
  process.exit(0);
}

// Shared with CLI and RPC: one design-tree parser, one set of gap rules.
const { scanDesignTree } = await import("../src/lib/evidence.mjs");
const tree = scanDesignTree(root);
if (!tree) {
  console.log("无设计树（na，不判通过）。");
  process.exit(0);
}
const byLevel = {};
for (const d of tree.designs) byLevel[d.level] = (byLevel[d.level] ?? 0) + 1;
const snapshot = {
  ts: new Date().toISOString(),
  designs: tree.designs,
  tests: tree.tests,
  counts: { ...tree.counts, byLevel },
  gaps: { ...tree.gaps },
};

const outPath = join(root, "docs", "reports", "design-tree.json");
const stable = (o) => { const c = { ...o, ts: "" }; return JSON.stringify(c, null, 2); };

if (args.check) {
  if (!existsSync(outPath)) {
    console.error("失败：快照不存在；先运行 snapshot 生成。");
    process.exit(1);
  }
  const actual = JSON.parse(readFileSync(outPath, "utf8"));
  if (stable(actual) !== stable(snapshot)) {
    console.error("失败：快照与设计树重放不一致（手改或未重放）。remedy：重跑 snapshot 覆盖。");
    process.exit(1);
  }
  console.log("snapshot --check OK：快照与重放一致。");
  process.exit(0);
}

mkdirSync(dirname(outPath), { recursive: true });
const changed = writeReportJson(outPath, snapshot);
console.log(`快照已写出：design=${tree.designs.length} test=${tree.tests.length} ids=${tree.counts.ids} gaps=${Object.values(tree.gaps).reduce((a, xs) => a + xs.length, 0)}${changed ? "" : "（内容未变）"}`);
process.exit(0);
