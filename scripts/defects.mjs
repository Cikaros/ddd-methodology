/**
 * scripts/defects.mjs —— 缺陷登记册唯一写入器（R36）。
 *
 * docs/defects.jsonl（唯一权威处）的 append-only 写入器 + docs/reports/known-issues.md 重放。
 * 用法：node scripts/defects.mjs <add|resolve|replay|check> [args] [--root <项目根>]
 *   add --title <t> --severity <high|med|low> [--area <a>] [--ref <file>]
 *   resolve --id <DEF-####> [--note <n>]
 * 退出码：0 过；1 失败（缺字段/手改检出/派生不一致）；2 用法错。
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
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
function usage(msg) { if (msg) console.error(`用法错：${msg}`); console.error("用法：node scripts/defects.mjs <add|resolve|replay|check> [--root <项目根>]"); process.exit(2); }
function fail(msg) { console.error(`失败：${msg}`); process.exit(1); }

const argv = process.argv.slice(2);
const sub = argv[0];
if (!sub) usage("缺少子命令");
const args = parseArgs(argv.slice(1));
const root = args.root && args.root !== true ? resolve(String(args.root)) : process.cwd();
const jsonlPath = join(root, "docs", "defects.jsonl");
const mdPath = join(root, "docs", "reports", "known-issues.md");

function readRows() {
  if (!existsSync(jsonlPath)) return [];
  const rows = [];
  let n = 0;
  for (const line of readFileSync(jsonlPath, "utf8").split(/\r?\n/)) {
    n++;
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { fail(`第 ${n} 行不是合法 JSON（手改检出）`); }
    if (!o.id || !o.status || !o.severity || !o.title) fail(`第 ${n} 行缺必备字段（手改检出）`);
    rows.push(o);
  }
  return rows;
}
function fold(rows) {
  const m = new Map();
  for (const r of rows) m.set(r.id, { ...(m.get(r.id) ?? {}), ...r });
  return [...m.values()];
}
function render(rows) {
  const folded = fold(rows);
  const open = folded.filter((r) => r.status === "open");
  const lines = ["<!-- 派生视图，由 scripts/defects.mjs replay 生成；禁手改 -->", "# 已知问题（known-issues）", "", `open=${open.length} / total=${folded.length}`, ""];
  lines.push("| id | severity | status | area | title |");
  lines.push("|---|---|---|---|---|");
  for (const r of folded) lines.push(`| ${r.id} | ${r.severity} | ${r.status} | ${r.area ?? ""} | ${r.title} |`);
  lines.push("");
  return lines.join("\n");
}
function normalize(s) { return s.replace(/\r\n/g, "\n").trim(); }
function replay() {
  const rows = readRows();
  mkdirSync(dirname(mdPath), { recursive: true });
  writeFileSync(mdPath, render(rows), "utf8");
}

if (sub === "add") {
  if (!args.title || !args.severity) fail("add 需要 --title 与 --severity");
  if (!["high", "med", "low"].includes(String(args.severity))) fail(`severity 越域：${args.severity}`);
  const rows = readRows();
  const ids = fold(rows).map((r) => Number(String(r.id).replace(/\D/g, "")) || 0);
  const next = (ids.length ? Math.max(...ids) : 0) + 1;
  const row = { id: `DEF-${String(next).padStart(4, "0")}`, ts: new Date().toISOString(), status: "open", severity: String(args.severity), title: String(args.title), area: args.area && args.area !== true ? String(args.area) : undefined, ref: args.ref && args.ref !== true ? String(args.ref) : undefined };
  mkdirSync(dirname(jsonlPath), { recursive: true });
  appendFileSync(jsonlPath, JSON.stringify(row) + "\n", "utf8");
  replay();
  console.log(`已登记缺陷 ${row.id}`);
  process.exit(0);
}

if (sub === "resolve") {
  if (!args.id) fail("resolve 需要 --id");
  const cur = fold(readRows()).find((r) => r.id === args.id);
  if (!cur) fail(`缺陷不存在：${args.id}`);
  appendFileSync(jsonlPath, JSON.stringify({ id: String(args.id), ts: new Date().toISOString(), status: "resolved", severity: cur.severity, title: cur.title, area: cur.area, ref: cur.ref, note: args.note && args.note !== true ? String(args.note) : undefined }) + "\n", "utf8");
  replay();
  console.log(`已结清 ${args.id}`);
  process.exit(0);
}

if (sub === "replay") { replay(); console.log("已重放 docs/reports/known-issues.md。"); process.exit(0); }
if (sub === "check") {
  readRows();
  if (!existsSync(mdPath)) fail("派生视图不存在；先运行 replay。");
  if (normalize(readFileSync(mdPath, "utf8")) !== normalize(render(readRows()))) fail("派生视图与重放不一致。remedy：重跑 replay。");
  console.log("defects check OK：行合法且派生一致。");
  process.exit(0);
}
usage(`未知子命令 ${sub}`);
