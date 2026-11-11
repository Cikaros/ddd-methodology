/**
 * scripts/change.mjs —— 变更流唯一写入器（M2）。
 *
 * docs/CHANGELOG.jsonl 的唯一写入器（append-only）+ docs/CHANGELOG.md 的重放。
 * 用法：node scripts/change.mjs <add|replay|check> [args] [--root <项目根>]
 *   add --rationale <why> --out-of-scope <x> --expected-signal <y> [--type <t>] [--version <v>] [--docs a,b]
 * 退出码：0 过；1 失败（缺必备字段/手改检出/派生不一致）；2 用法错。
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
  console.error("用法：node scripts/change.mjs <add|replay|check> [--root <项目根>]");
  process.exit(2);
}

const argv = process.argv.slice(2);
const sub = argv[0];
if (!sub) usage("缺少子命令");
const args = parseArgs(argv.slice(1));
const root = args.root && args.root !== true ? resolve(String(args.root)) : process.cwd();
const jsonlPath = join(root, "docs", "CHANGELOG.jsonl");
const mdPath = join(root, "docs", "CHANGELOG.md");

const REQUIRED = ["id", "ts", "version", "type", "docs", "rationale", "outOfScope", "expectedSignal"];

function readRows() {
  if (!existsSync(jsonlPath)) return [];
  const rows = [];
  let n = 0;
  for (const line of readFileSync(jsonlPath, "utf8").split(/\r?\n/)) {
    n++;
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { fail(`第 ${n} 行不是合法 JSON（手改检出）`); }
    for (const k of ["id", "ts", "rationale", "outOfScope", "expectedSignal"]) {
      if (o[k] === undefined || o[k] === "") fail(`第 ${n} 行缺必备字段 ${k}（手改检出）`);
    }
    rows.push(o);
  }
  return rows;
}
function fail(msg) { console.error(`失败：${msg}`); process.exit(1); }

function render(rows) {
  const lines = ["<!-- 派生视图，由 scripts/change.mjs replay 生成；禁手改 -->", "# CHANGELOG", ""];
  for (const r of rows) {
    lines.push(`## ${r.version ?? "?"} · ${r.id} · ${r.type ?? "?"}`);
    lines.push("");
    lines.push(`- 时间：${r.ts}`);
    lines.push(`- 为什么做：${r.rationale}`);
    lines.push(`- 本次不做：${r.outOfScope}`);
    lines.push(`- 怎么算做对：${r.expectedSignal}`);
    if (r.docs) lines.push(`- 涉及：${Array.isArray(r.docs) ? r.docs.join(", ") : r.docs}`);
    lines.push("");
  }
  return lines.join("\n");
}
function normalize(s) { return s.replace(/\r\n/g, "\n").trim(); }
function replay() {
  const rows = readRows();
  mkdirSync(dirname(mdPath), { recursive: true });
  writeFileSync(mdPath, render(rows), "utf8");
}

if (sub === "add") {
  for (const [flag, key] of [["rationale", "rationale"], ["out-of-scope", "outOfScope"], ["expected-signal", "expectedSignal"]]) {
    if (!args[flag] || args[flag] === true) fail(`add 缺 --${flag}（三字段必填）`);
  }
  const rows = readRows();
  const row = {
    id: `CHG-${String(rows.length + 1).padStart(4, "0")}`,
    ts: new Date().toISOString(),
    version: args.version && args.version !== true ? String(args.version) : "unreleased",
    type: args.type && args.type !== true ? String(args.type) : "other",
    docs: args.docs && args.docs !== true ? String(args.docs).split(",").map((s) => s.trim()).filter(Boolean) : [],
    rationale: String(args.rationale),
    outOfScope: String(args["out-of-scope"]),
    expectedSignal: String(args["expected-signal"]),
  };
  mkdirSync(dirname(jsonlPath), { recursive: true });
  appendFileSync(jsonlPath, JSON.stringify(row) + "\n", "utf8");
  replay();
  console.log(`已记变更 ${row.id}`);
  process.exit(0);
}

if (sub === "replay") {
  replay();
  console.log("已重放 docs/CHANGELOG.md。");
  process.exit(0);
}

if (sub === "check") {
  readRows();
  if (!existsSync(mdPath)) fail("派生视图 docs/CHANGELOG.md 不存在；先运行 replay。");
  const expected = render(readRows());
  if (normalize(readFileSync(mdPath, "utf8")) !== normalize(expected)) fail("派生视图与重放不一致（手改或未重放）。remedy：重跑 replay。");
  console.log("change check OK：行契约合法且派生视图一致。");
  process.exit(0);
}

usage(`未知子命令 ${sub}`);
