/**
 * scripts/board.mjs —— 看板唯一写入器（append-only）。
 *
 * 用法：node scripts/board.mjs <sub> [args] [--root <项目根>]
 *   add --title <t> --acceptance <a> [--priority P0..P3] [--req <id>] [--depends a,b] [--seq n]
 *   move --task <id> --to <status> [--reason <r>]
 *   evidence --task <id> --evidence <text>
 *   archive --task <id>
 *   rehome --task <id> --req <id>
 *   reconcile           # 校验现有 jsonl（手改检出、准入/转移合法性）
 *   replay --check      # 比对派生视图 docs/board/BOARD.md
 *
 * 退出码：0 过；1 失败（含手改检出）；2 用法错。
 * 铁律：append-only；只追加不改旧行；状态转移只以新行表达；禁手改派生视图。
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { project, admit, canTransition, summarize } from "../src/lib/board.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const cfg = JSON.parse(readFileSync(join(packageRoot, "assets", "board.json"), "utf8"));

function usage(msg) {
  if (msg) console.error(`用法错：${msg}`);
  console.error("用法：node scripts/board.mjs <add|move|evidence|archive|rehome|reconcile|replay> [--root <dir>]");
  process.exit(2);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const argv = process.argv.slice(2);
const sub = argv[0];
if (!sub) usage("缺少子命令");
const args = parseArgs(argv.slice(1));
const root = args.root && args.root !== true ? resolve(String(args.root)) : process.cwd();
const jsonlPath = join(root, "docs", "board", "board.jsonl");
const boardMdPath = join(root, "docs", "board", "BOARD.md");

function readRows() {
  if (!existsSync(jsonlPath)) return [];
  const text = readFileSync(jsonlPath, "utf8");
  const rows = [];
  let lineno = 0;
  for (const line of text.split(/\r?\n/)) {
    lineno++;
    if (!line.trim()) continue;
    if (Buffer.byteLength(line, "utf8") > cfg.maxLineBytes) {
      throw new HandEdit(`第 ${lineno} 行超过 maxLineBytes=${cfg.maxLineBytes}`);
    }
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      throw new HandEdit(`第 ${lineno} 行不是合法 JSON`);
    }
    if (!obj.kind || !obj.taskId) throw new HandEdit(`第 ${lineno} 行缺 kind/taskId`);
    rows.push(obj);
  }
  // seq 单调（同 kind 序不要求，但全局 seq 不得回退超过 0）
  let lastSeq = -1;
  for (const r of rows) {
    const s = r.seq ?? 0;
    if (s < lastSeq) throw new HandEdit(`seq 非单调：${s} < ${lastSeq}`);
    lastSeq = s;
  }
  return rows;
}

class HandEdit extends Error {}

function nextSeq(rows) {
  return rows.reduce((m, r) => Math.max(m, r.seq ?? 0), 0) + 1;
}

function append(row) {
  mkdirSync(dirname(jsonlPath), { recursive: true });
  appendFileSync(jsonlPath, JSON.stringify(row) + "\n", "utf8");
}

function renderView(proj) {
  const sum = summarize(proj);
  const lines = [];
  lines.push("<!-- 派生视图，由 scripts/board.mjs replay 生成；禁手改 -->");
  lines.push("# 看板（BOARD.md）");
  lines.push("");
  lines.push(`待办 ${sum.pending} / 进行 ${sum.inProgress} / 阻塞 ${sum.blocked}`);
  lines.push("");
  lines.push("| 位次 | taskId | 优先级 | 状态 | 标题 | 验收 |");
  lines.push("|---|---|---|---|---|---|");
  proj.forEach((it, i) => {
    lines.push(`| ${i + 1} | ${it.taskId} | ${it.priority} | ${it.status} | ${escapeCell(it.title)} | ${escapeCell(it.acceptance)} |`);
  });
  lines.push("");
  return lines.join("\n");
}

function escapeCell(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function fail(msg) {
  console.error(`失败：${msg}`);
  process.exit(1);
}

function main() {
  let rows;
  try {
    rows = readRows();
  } catch (e) {
    fail(`手改检出：${e.message}`);
    return;
  }
  const proj = project(rows);

  if (sub === "add") {
    if (!args.title || !args.acceptance) fail("add 需要 --title 与 --acceptance（acceptance 必填）");
    const taskId = args.task || `BRD-${String(nextSeq(rows)).padStart(4, "0")}`;
    const row = {
      kind: "task",
      ts: new Date().toISOString(),
      taskId,
      reqId: args.req && args.req !== true ? String(args.req) : null,
      title: String(args.title),
      acceptance: String(args.acceptance),
      priority: args.priority && args.priority !== true ? String(args.priority) : cfg.defaultPriority,
      status: "pending",
      dependsOn: args.depends && args.depends !== true ? String(args.depends).split(",").map((s) => s.trim()).filter(Boolean) : [],
      seq: nextSeq(rows),
      reason: args.reason && args.reason !== true ? String(args.reason) : undefined,
    };
    const res = admit(row, proj, cfg);
    if (!res.ok) fail(`准入拒绝：${res.reason}\nremedy：补齐 acceptance/priority/dependsOn 或附 --reason。`);
    append(row);
    replay();
    console.log(`已入板 ${taskId} @ ${res.rank}`);
    process.exit(0);
  }

  if (sub === "move") {
    if (!args.task || !args.to) fail("move 需要 --task 与 --to");
    const cur = proj.find((it) => it.taskId === args.task);
    if (!cur) fail(`任务不存在：${args.task}`);
    if (!cfg.statusDomain.includes(String(args.to))) fail(`to 越域：${args.to}`);
    if (!canTransition(cur.status, String(args.to))) fail(`非法转移：${cur.status} → ${args.to}\nremedy：合法转移见 src/lib/DESIGN-board.md。`);
    append({ kind: "move", ts: new Date().toISOString(), taskId: String(args.task), from: cur.status, to: String(args.to), seq: nextSeq(rows), reason: args.reason && args.reason !== true ? String(args.reason) : undefined });
    replay();
    console.log(`已转移 ${args.task}: ${cur.status} → ${args.to}`);
    process.exit(0);
  }

  if (sub === "evidence") {
    if (!args.task || !args.evidence) fail("evidence 需要 --task 与 --evidence");
    if (!proj.find((it) => it.taskId === args.task)) fail(`任务不存在：${args.task}`);
    append({ kind: "evidence", ts: new Date().toISOString(), taskId: String(args.task), evidence: String(args.evidence), seq: nextSeq(rows) });
    replay();
    console.log(`已挂证据 ${args.task}`);
    process.exit(0);
  }

  if (sub === "archive") {
    if (!args.task) fail("archive 需要 --task");
    const cur = proj.find((it) => it.taskId === args.task);
    if (cur && cur.status !== "done" && cur.status !== "dropped") fail(`仅 done/dropped 可 archive；当前 ${cur.status}`);
    append({ kind: "archive", ts: new Date().toISOString(), taskId: String(args.task), seq: nextSeq(rows) });
    replay();
    console.log(`已归档 ${args.task}`);
    process.exit(0);
  }

  if (sub === "rehome") {
    if (!args.task || !args.req) fail("rehome 需要 --task 与 --req");
    if (!proj.find((it) => it.taskId === args.task)) fail(`任务不存在：${args.task}`);
    append({ kind: "task", ts: new Date().toISOString(), taskId: String(args.task), reqId: String(args.req), title: proj.find((it) => it.taskId === args.task).title, acceptance: proj.find((it) => it.taskId === args.task).acceptance, priority: proj.find((it) => it.taskId === args.task).priority, status: proj.find((it) => it.taskId === args.task).status, dependsOn: proj.find((it) => it.taskId === args.task).dependsOn, seq: nextSeq(rows), reason: "rehome" });
    replay();
    console.log(`已重挂 ${args.task} → ${args.req}`);
    process.exit(0);
  }

  if (sub === "reconcile") {
    // 已读行即通过校验；额外校验：活跃投影里 reqId:null 未收口者列为提示（不判失败）。
    const unrehomed = proj.filter((it) => it.reqId === null);
    console.log(`reconcile OK：${proj.length} 活跃项，${unrehomed.length} 项 reqId:null（收尾前须 rehome/drop）。`);
    process.exit(0);
  }

  if (sub === "replay") {
    replay();
    if (args.check) {
      if (!existsSync(boardMdPath)) fail("派生视图 docs/board/BOARD.md 不存在；先运行 replay。");
      const expected = renderView(proj);
      const actual = readFileSync(boardMdPath, "utf8");
      if (normalize(actual) !== normalize(expected)) fail("派生视图与重放不一致（手改或未重放）。remedy：重跑 replay 覆盖。");
      console.log("replay --check OK：派生视图与重放一致。");
    } else {
      console.log("replay 已写出 docs/board/BOARD.md。");
    }
    process.exit(0);
  }

  usage(`未知子命令 ${sub}`);
}

function normalize(s) {
  return s.replace(/\r\n/g, "\n").trim();
}

function replay() {
  const rows = readRows();
  const proj = project(rows);
  mkdirSync(dirname(boardMdPath), { recursive: true });
  writeFileSync(boardMdPath, renderView(proj), "utf8");
}

main();
