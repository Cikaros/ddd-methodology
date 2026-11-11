/**
 * src/lib/memory.ts —— M6 记忆闭环（纯函数部分）。
 *
 * 边界：纯函数；阈值由调用方从 assets/memory.json 传入，代码不内置。
 * 目标：经验可沉淀、可衰减、可晋升、可自动注入；与 AGENTS.md 分工不打架。
 */

export type MemoryKind = "record" | "occur" | "decay" | "promote" | "archive" | "session" | "checkpoint";
export type MemoryType = "pitfall" | "procedure";

export interface MemoryEntry {
  readonly id: string;
  readonly ts?: string;
  readonly kind: MemoryKind;
  readonly type: MemoryType;
  readonly scope: string;
  readonly key: string;
  readonly symptom?: string;
  readonly cause?: string;
  readonly trigger?: string;
  readonly guardId?: string;
  readonly occurrences: number;
  readonly confidence: number;
  /** 一致率（0–1）。 */
  readonly consistency?: number;
  readonly source?: string;
  readonly archived?: boolean;
}

export interface MemoryConfig {
  readonly remindAt: number;
  readonly promoteAt: number;
  readonly consistency: number;
  readonly decayPerSession: number;
  readonly injectTopN: number;
  readonly redlines: readonly string[];
}

const MIN_STARS = 1;
const MAX_STARS = 5;

/** 由次数与一致率得 1–5★（单调不减；阈值语义读入参，非硬编码门槛）。 */
export function computeConfidence(occurrences: number, consistency = 1): number {
  const n = Math.max(0, Math.floor(occurrences));
  let stars = MIN_STARS;
  if (n >= 2) stars = 2;
  if (n >= 3) stars = 3;
  if (n >= 5) stars = 4;
  if (n >= 8) stars = 5;
  // 一致率低则封顶：低于 0.5 只保留 1★。
  if (consistency < 0.5) stars = Math.min(stars, 1);
  else if (consistency < 0.8) stars = Math.min(stars, 3);
  return Math.max(MIN_STARS, Math.min(MAX_STARS, stars));
}

export function shouldRemind(entry: MemoryEntry, cfg: MemoryConfig): boolean {
  if (entry.archived) return false;
  return entry.confidence >= cfg.remindAt;
}

export function shouldPromote(entry: MemoryEntry, cfg: MemoryConfig): boolean {
  if (entry.archived) return false;
  return entry.confidence >= cfg.promoteAt && (entry.consistency ?? 1) >= cfg.consistency;
}

/** 未再现条目逐会话减星；低于 1★ 转 archived。 */
export function decay(entry: MemoryEntry, cfg: MemoryConfig): { confidence: number; archived: boolean } {
  const next = entry.confidence - cfg.decayPerSession;
  if (next < MIN_STARS) return { confidence: MIN_STARS, archived: true };
  return { confidence: next, archived: false };
}

/** 取项目根名作 scope（跨项目隔离）。 */
export function projectScope(root: string): string {
  const norm = String(root).replace(/[\\/]+$/, "");
  const parts = norm.split(/[\\/]/);
  return parts[parts.length - 1] || norm;
}

const KEY_TRIGGER_KEYS = ["tool", "command", "name"] as const;

/** 命中去重键：scope+key+sessionID+位移。 */
export function occurrenceDedupKey(scope: string, key: string, sessionID: string, offset: number): string {
  return `${scope}|${key}|${sessionID}|${offset}`;
}

/** 从一条 trigger 形态与工具调用是否匹配（工具名模式或入参模式）。 */
export function matchesTrigger(trigger: string | undefined, tool: string, input: unknown): boolean {
  if (!trigger) return false;
  if (trigger === tool) return true;
  if (trigger.startsWith("tool:")) return trigger.slice(5) === tool;
  if (trigger.startsWith("input:")) {
    const needle = trigger.slice(6);
    const text = typeof input === "string" ? input : safeStringify(input);
    return text.includes(needle);
  }
  return false;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? "";
  } catch {
    return "";
  }
}

/** 默认注入：按 scope 过滤、取 confidence 降序 topN 的 symptom 摘要。 */
export function selectInjection(entries: readonly MemoryEntry[], scope: string, cfg: MemoryConfig): MemoryEntry[] {
  return entries
    .filter((e) => !e.archived && e.scope === scope && shouldRemind(e, cfg))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, cfg.injectTopN);
}

export function countCandidates(entries: readonly MemoryEntry[], cfg: MemoryConfig): number {
  return entries.filter((e) => !e.archived && shouldPromote(e, cfg)).length;
}

export { KEY_TRIGGER_KEYS };
