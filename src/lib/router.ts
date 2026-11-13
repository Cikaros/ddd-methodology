/**
 * src/lib/router.ts —— 自主注入路由（M13 注入层）。
 *
 * 边界：只依赖标准库；切片映射表由调用方从 assets/injection-slices.json 读入后传入。
 * 关键：判定必须可观测（返回 basis）；本件只选内容，不做机械强制（那是 guard.ts）。
 */

export type Phase =
  | "init"
  | "intent"
  | "arch"
  | "design"
  | "review"
  | "test-design"
  | "implement"
  | "test"
  | "validate"
  | "change"
  | "map"
  | "wrapup"
  | "consolidate"
  | "board"
  | "memo"
  | "idle";

export type Intent = "frontend" | "backend" | "bugfix" | "docs" | "unknown";

export interface SliceSpec {
  readonly id: string;
  readonly source: string;
  readonly when: { readonly phase?: string; readonly intent?: string };
}

export interface RouteInput {
  readonly phase?: Phase;
  readonly intent?: Intent;
  readonly scenario?: "greenfield" | "incremental" | "migration";
}

export interface RouteOutput {
  readonly sliceIds: readonly string[];
  /** 判定依据（可观测）。 */
  readonly basis: { readonly phase?: string; readonly intent?: string; readonly scenario?: string; readonly matched: number };
}

/**
 * 据相位/意图/场景选最小切片集。
 * 规则：when 为空的切片常驻；when.phase 命中相位则选；when.intent 命中意图则选。
 * 同 id 去重；顺序按 slices 定义顺序。
 */
export function routeSlices(input: RouteInput, slices: readonly SliceSpec[]): RouteOutput {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const s of slices) {
    const phaseHit = s.when.phase === undefined || s.when.phase === input.phase;
    const intentHit = s.when.intent === undefined || s.when.intent === input.intent;
    if (phaseHit && intentHit) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        ids.push(s.id);
      }
    }
  }
  return {
    sliceIds: ids,
    basis: { phase: input.phase, intent: input.intent, scenario: input.scenario, matched: ids.length },
  };
}

/**
 * 从角色 md 正文提取「# 约束」节条目。
 *
 * 单点权威：约束正文只在 `agents/<role>.md`；此处是**只读投影**，不复制。
 * 用途：`same` 派发路径不切 agent，角色约束不会自动进入上下文——须由指令显式带入。
 */
export function roleConstraints(md: string): string[] {
  const lines = (md ?? "").split(/\r?\n/);
  const out: string[] = [];
  let inSection = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^#{1,6}\s*约束/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^#{1,6}\s*\S/.test(line)) break; // 下一个标题即结束
      if (/^[-*]\s+/.test(line)) out.push(line.replace(/^[-*]\s+/, ""));
    }
  }
  return out;
}

/** 选定切片的来源件路径（供指令指示「按需读全文」，渐进式披露）。 */
export function sliceSources(sliceIds: readonly string[], slices: readonly SliceSpec[]): string[] {
  const byId = new Map(slices.map((s) => [s.id, s.source]));
  const out: string[] = [];
  for (const id of sliceIds) {
    const src = byId.get(id);
    if (src && !out.includes(src)) out.push(src);
  }
  return out;
}

/** 启发式意图探测：文本关键词 + 文件扩展名。可选由宿主 decisions 复核（此处保持纯函数）。 */
export function detectIntent(text: string, files: readonly string[] = []): Intent {
  const t = (text || "").toLowerCase();
  const exts = files.map((f) => {
    const i = f.lastIndexOf(".");
    return i >= 0 ? f.slice(i + 1).toLowerCase() : "";
  });
  const frontendExt = new Set(["tsx", "jsx", "vue", "css", "scss", "html", "svelte"]);
  if (exts.some((e) => frontendExt.has(e))) return "frontend";
  if (/\b(bug|fix|修复|报错|异常|错误|崩溃|fail|error|regression)\b/i.test(t)) return "bugfix";
  if (/\b(前端|页面|组件|样式|主题|ui|theme|variant|变体|color|颜色)\b/i.test(t)) return "frontend";
  if (/\b(文档|说明|readme|docs?|注释)\b/i.test(t)) return "docs";
  if (/\b(接口|后端|服务|api|server|数据库|database|表结构)\b/i.test(t)) return "backend";
  return "unknown";
}
