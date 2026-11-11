/**
 * src/lib/guard.ts —— 底线守卫（M13 守卫层）。
 *
 * 边界：纯函数；底线数据由调用方从 assets/bottom-lines.json 传入。
 * 铁律：落不进执法点的不是底线（R57）；assertEnforceable 必须拦下。
 * 失败语义三分：block / visible / na；block/visible 带 remedy（Linter 即 Prompt）。
 */

import type { Verdict } from "./gates.ts";

/** 机械执法点三分。 */
export type Enforcement = "permission" | "tool-hook" | "gate";

export interface BottomLine {
  readonly id: string;
  readonly surface: Enforcement;
  readonly action: string;
  readonly resource: string;
  readonly effect: "deny" | "ask";
  readonly failSemantics: "block" | "visible";
  readonly remedy: string;
}

export interface EvaluateInput {
  /** 当前风险面观测（每条底线给出 examined/unrecognized 计数）。 */
  readonly observed?: Readonly<Record<string, { readonly examined: number; readonly unrecognized: number; readonly hits?: number }>>;
}

export interface GuardVerdict {
  readonly id: string;
  readonly verdict: Verdict;
  readonly examined: number;
  readonly unrecognized: number;
  readonly remedy?: string;
}

const ENFORCEMENTS: readonly Enforcement[] = ["permission", "tool-hook", "gate"];

/**
 * 逐条判定底线。
 * - 无 surface/非法 surface → 该条不是底线，报 block（应被 assertEnforceable 拦下）。
 * - 有观测命中 → 按 failSemantics 出 block/visible，带 remedy。
 * - 零命中 → pass（注意：与「无判定对象」不同）。
 * - 无观测（判定对象缺失）→ na，不判通过。
 */
export function evaluateBottomLines(bottomLines: readonly BottomLine[], input: EvaluateInput = {}): GuardVerdict[] {
  return bottomLines.map((bl) => {
    if (!bl.surface || !ENFORCEMENTS.includes(bl.surface)) {
      return { id: bl.id, verdict: "block" as Verdict, examined: 0, unrecognized: 1, remedy: `底线 ${bl.id} 无执法点，不是底线；须声明 permission/tool-hook/gate。` };
    }
    const obs = input.observed?.[bl.id];
    if (!obs) {
      return { id: bl.id, verdict: "na" as Verdict, examined: 0, unrecognized: 0 };
    }
    const hits = obs.hits ?? 0;
    if (hits > 0) {
      const v: Verdict = bl.failSemantics === "block" ? "block" : "visible";
      return { id: bl.id, verdict: v, examined: obs.examined, unrecognized: obs.unrecognized, remedy: bl.remedy };
    }
    return { id: bl.id, verdict: "pass" as Verdict, examined: obs.examined, unrecognized: obs.unrecognized };
  });
}

/**
 * 自检：无执法点的底线 → 报错（不是底线）。
 * @returns 问题列表（空即合格）。
 */
export function assertEnforceable(bottomLines: readonly BottomLine[]): string[] {
  const problems: string[] = [];
  for (const bl of bottomLines) {
    if (!bl.surface || !ENFORCEMENTS.includes(bl.surface)) problems.push(`${bl.id}: 无执法点`);
    if (!bl.remedy || !bl.remedy.trim()) problems.push(`${bl.id}: 缺 remedy`);
    if (bl.effect !== "deny" && bl.effect !== "ask") problems.push(`${bl.id}: effect 越域`);
  }
  return problems;
}
