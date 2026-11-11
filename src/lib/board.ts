/**
 * src/lib/board.ts —— 看板投影与判定（M7 · 持久多步待办）。
 *
 * 目的：把「多步待办」做成持久、可验收、跨会话不丢的看板，防止 Agent「做一半丢一半」。
 * 边界：纯函数（入参为行数组）；阈值由调用方从 assets/board.json 传入，代码不内置。
 * 与 todowrite 不双记账：持久任务只在看板；todowrite 仅会话内草稿（裁决 #10）。
 */

import type { Verdict } from "./gates.ts";

export type BoardKind =
  | "task"
  | "move"
  | "evidence"
  | "archive"
  | "rule-hit"
  | "rule-undecided"
  | "profile-change"
  | "stale-hit";

export type BoardStatus = "pending" | "in_progress" | "blocked" | "done" | "dropped";

export interface BoardRow {
  readonly kind: BoardKind;
  readonly ts: string;
  readonly taskId: string;
  readonly reqId?: string | null;
  readonly title?: string;
  readonly acceptance?: string;
  readonly priority?: string;
  readonly status?: BoardStatus;
  readonly dependsOn?: readonly string[];
  readonly seq?: number;
  readonly from?: BoardStatus;
  readonly to?: BoardStatus;
  readonly reason?: string;
  readonly evidence?: string;
}

export interface BoardItem {
  readonly taskId: string;
  readonly reqId: string | null;
  readonly title: string;
  readonly acceptance: string;
  readonly priority: string;
  readonly status: BoardStatus;
  readonly dependsOn: readonly string[];
  readonly seq: number;
  /** 该任务最新一行的 ts（用于孤儿检测）。 */
  readonly ts: string;
}

export interface BoardConfig {
  readonly priorityDomain: readonly string[];
  readonly defaultPriority: string;
  readonly statusDomain: readonly string[];
  readonly starvationWindow: number;
  readonly starvationLimit: number;
  readonly orphanHours: number;
  readonly maxLineBytes: number;
}

const RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function rankOf(priority: string): number {
  return RANK[priority] ?? 99;
}

const TERMINAL: readonly BoardStatus[] = ["done", "dropped"];

/**
 * 折叠每 taskId 最新态 → 剔除 archive → 剔除前驱未满足 → 按 (priority 升, seq 升) 排序。
 * 前驱未满足：任一 dependsOn 不在已 done 集合内即剔除。
 */
export function project(rows: readonly BoardRow[]): BoardItem[] {
  const byId = new Map<string, BoardItem>();
  const ordered = [...rows].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  for (const r of ordered) {
    if (!r.taskId) continue;
    const cur = byId.get(r.taskId);
    if (r.kind === "task") {
      byId.set(r.taskId, {
        taskId: r.taskId,
        reqId: r.reqId ?? null,
        title: r.title ?? "",
        acceptance: r.acceptance ?? "",
        priority: r.priority ?? "P2",
        status: (r.status as BoardStatus) ?? "pending",
        dependsOn: r.dependsOn ?? [],
        seq: r.seq ?? 0,
        ts: r.ts,
      });
    } else if (r.kind === "move" && cur) {
      byId.set(r.taskId, { ...cur, status: (r.to as BoardStatus) ?? cur.status, ts: r.ts });
    } else if (r.kind === "archive" && cur) {
      byId.delete(r.taskId);
    } else if (r.kind === "evidence" && cur) {
      byId.set(r.taskId, { ...cur, ts: r.ts });
    }
  }
  const done = new Set<string>();
  for (const it of byId.values()) if (TERMINAL.includes(it.status)) done.add(it.taskId);
  const visible = [...byId.values()].filter((it) => it.dependsOn.every((d) => done.has(d)));
  visible.sort((a, b) => {
    const p = rankOf(a.priority) - rankOf(b.priority);
    return p !== 0 ? p : a.seq - b.seq;
  });
  return visible;
}

/** 合法转移：见 DESIGN-board.md；其余拒。 */
export function canTransition(from: BoardStatus, to: BoardStatus): boolean {
  if (to === "dropped") return from !== "dropped" && from !== "done";
  switch (from) {
    case "pending":
      return to === "in_progress" || to === "done";
    case "in_progress":
      return to === "blocked" || to === "done";
    case "blocked":
      return to === "in_progress" || to === "done";
    // done/dropped → archive 由 archive 行表达（非 move），故此处无合法 move。
    case "done":
    case "dropped":
      return false;
    default:
      return false;
  }
}

export interface AdmitResult {
  readonly ok: boolean;
  readonly rank: number;
  readonly reason?: string;
}

/**
 * 准入：acceptance 非空、priority 在域、dependsOn 实存；返回插入位次。
 * 反饥饿：连续超阈值且缺 reason → 拒。
 */
export function admit(row: BoardRow, projection: readonly BoardItem[], cfg: BoardConfig): AdmitResult {
  const acceptance = (row.acceptance ?? "").trim();
  if (!acceptance) return { ok: false, rank: -1, reason: "acceptance 必填（缺者不进板，R33）" };
  const priority = row.priority ?? cfg.defaultPriority;
  if (!cfg.priorityDomain.includes(priority)) return { ok: false, rank: -1, reason: `priority 越域: ${priority}` };
  const exist = new Set(projection.map((it) => it.taskId));
  for (const d of row.dependsOn ?? []) {
    if (!exist.has(d)) return { ok: false, rank: -1, reason: `dependsOn 不存在: ${d}` };
  }
  const rank = insertRank(priority, row.seq ?? 0, projection);
  if (isStarving(priority, projection, cfg) && !(row.reason && row.reason.trim())) {
    return { ok: false, rank, reason: `反饥饿：连续 ${cfg.starvationWindow} 次追加均严高于在办，须附 reason` };
  }
  return { ok: true, rank };
}

function insertRank(priority: string, seq: number, projection: readonly BoardItem[]): number {
  let i = 0;
  for (const it of projection) {
    const p = rankOf(priority) - rankOf(it.priority);
    if (p > 0 || (p === 0 && seq > it.seq)) i++;
    else break;
  }
  return i;
}

/** 反饥饿：projection 中优先级均严高于新行，且数量 ≥ 阈值。 */
function isStarving(priority: string, projection: readonly BoardItem[], cfg: BoardConfig): boolean {
  const active = projection.filter((it) => it.status !== "done" && it.status !== "dropped");
  if (active.length < cfg.starvationWindow) return false;
  const higher = active.filter((it) => rankOf(it.priority) < rankOf(priority)).length;
  return higher >= cfg.starvationWindow && higher > cfg.starvationLimit;
}

export interface OrphanTip {
  readonly taskId: string;
  readonly hours: number;
}

/** in_progress 超 orphanHours 无新行 → 列提示（visible，不判失败）。 */
export function detectOrphans(projection: readonly BoardItem[], now: Date, cfg: BoardConfig): OrphanTip[] {
  const tips: OrphanTip[] = [];
  for (const it of projection) {
    if (it.status !== "in_progress") continue;
    const t = Date.parse(it.ts);
    if (Number.isNaN(t)) continue;
    const hours = (now.getTime() - t) / 3_600_000;
    if (hours > cfg.orphanHours) tips.push({ taskId: it.taskId, hours: Math.floor(hours) });
  }
  return tips;
}

export function summarize(projection: readonly BoardItem[]): { pending: number; inProgress: number; blocked: number } {
  let pending = 0;
  let inProgress = 0;
  let blocked = 0;
  for (const it of projection) {
    if (it.status === "pending") pending++;
    else if (it.status === "in_progress") inProgress++;
    else if (it.status === "blocked") blocked++;
  }
  return { pending, inProgress, blocked };
}

/** 收尾判据：活跃投影（未 archive）为空才过；否则 block 带 remedy。 */
export function wrapupVerdict(projection: readonly BoardItem[], cfg: BoardConfig): { verdict: Verdict; examined: number; unrecognized: number; remedy?: string } {
  const unrehomed = projection.filter((it) => it.reqId === null && !TERMINAL.includes(it.status));
  if (projection.length === 0) return { verdict: "pass", examined: 0, unrecognized: 0 };
  const parts: string[] = [`看板活跃投影非空（${projection.length} 项）`];
  if (unrehomed.length) parts.push(`${unrehomed.length} 项 reqId:null 须 rehome 或 drop`);
  return { verdict: "block", examined: projection.length, unrecognized: 0, remedy: `${parts.join("，")}；收尾要求活跃投影为空（G6/R33）。` };
}

export { rankOf };
export function priorityDomainOf(cfg: BoardConfig): readonly string[] {
  return cfg.priorityDomain;
}
