/**
 * scripts/snapshot.mjs —— 设计树机器可读快照（M1）。
 *
 * 重放 docs/ddd/** 的受控 frontmatter 为快照（同构/覆盖/漂移的判定底座）。
 * 快照是派生件，禁手改。
 * 用法：node scripts/snapshot.mjs [--root <项目根>] [--check]
 * 退出码：0 过；1 失败（快照与设计树不一致，含手改检出）；2 用法错。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve, basename, relative } from "node:path";

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

function frontmatter(t) {
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const o = {};
  if (m) for (const l of m[1].split(/\r?\n/)) {
    const i = l.indexOf(":");
    if (i > 0) o[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return o;
}

const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.md$/.test(e.name)) files.push(p);
  }
})(dddRoot);

const designs = [];
const tests = [];
for (const p of files) {
  const rel = relative(dddRoot, p).replace(/\\/g, "/");
  const b = basename(p);
  const t = readFileSync(p, "utf8");
  const f = frontmatter(t);
  if (/^DESIGN(-.*)?\.md$/.test(b)) {
    designs.push({ path: "docs/ddd/" + rel, level: f.level, target: f.target, status: f.status, landed: f.landed, covers: f.covers, depends: f.depends });
  } else if (/^UNIT-TESTS-|^TESTS-/.test(b)) {
    const ids = [...t.matchAll(/\|\s*((?:UT|ST|MT|GT)-[A-Za-z0-9-]+-\d+)\s*\|/g)].map((m) => m[1]);
    tests.push({ path: "docs/ddd/" + rel, target: f.target, status: f.status, landed: f.landed, ids });
  }
}

// 缺口自省
const missingUnitTests = [];
for (const d of designs) {
  if (d.level !== "file") continue;
  const p = join(root, d.path);
  const b = basename(p).replace(/^DESIGN-/, "").replace(/\.md$/, "");
  if (!existsSync(join(dirname(p), `UNIT-TESTS-${b}.md`))) missingUnitTests.push(d.path);
}
const missingGroupTests = [];
for (const d of designs) {
  if (d.level !== "group") continue;
  const p = join(root, d.path);
  const groupName = (d.target || "").split("/").filter(Boolean).pop() || "group";
  const cands = [`TESTS-${groupName}.md`, `TESTS-${basename(dirname(p))}.md`];
  if (!cands.some((c) => existsSync(join(dirname(p), c)))) missingGroupTests.push(d.path);
}
const targetSeen = new Map();
const duplicateTargets = [];
for (const d of designs) {
  if (!d.target) continue;
  if (targetSeen.has(d.target)) duplicateTargets.push(d.target);
  else targetSeen.set(d.target, 1);
}
const idSeen = new Map();
const duplicateIds = [];
for (const t of tests) for (const id of t.ids) {
  if (idSeen.has(id)) duplicateIds.push(id);
  else idSeen.set(id, 1);
}

const byLevel = {};
for (const d of designs) byLevel[d.level] = (byLevel[d.level] || 0) + 1;

const snapshot = {
  ts: new Date().toISOString(),
  designs,
  tests,
  counts: { design: designs.length, test: tests.length, ids: idSeen.size, byLevel },
  gaps: { missingUnitTests, missingGroupTests, duplicateTargets, duplicateIds },
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
writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");
console.log(`快照已写出：design=${designs.length} test=${tests.length} ids=${idSeen.size} gaps=${missingUnitTests.length + missingGroupTests.length + duplicateTargets.length + duplicateIds.length}`);
process.exit(0);
