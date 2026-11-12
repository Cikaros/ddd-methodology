/**
 * src/index.ts —— server part 入口（Plugin.define({ id: "ddd", setup })）。
 *
 * 边界：装配与注册；options 只读一次（裁定 V-02）。
 * 装配：四类注册口（命令/技能/代理/工具）＋ hooks ＋ RPC，并返回 cleanup。
 * 承重：M4 命令改造口、M5 意图确认、M6 记忆、M7 看板、M8 执行规则、M12 归并、M13 注入/守卫。
 */

import { Plugin } from "@opencode/plugin";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { COMMANDS, SKILLS } from "./lib/registry.ts";
import { packagePath, projectPath, projectRoot } from "./lib/paths.ts";
import { routeSlices, detectIntent, type Phase, type Intent } from "./lib/router.ts";
import { evaluateBottomLines, assertEnforceable, type BottomLine } from "./lib/guard.ts";
import { selectInjection, countCandidates, projectScope, matchesTrigger, type MemoryEntry, type MemoryConfig } from "./lib/memory.ts";
import { project as boardProject, summarize as boardSummary, type BoardRow, type BoardConfig } from "./lib/board.ts";
import { applyEncodingPrefix } from "./lib/shell-encoding.ts";
import { gates as gateFns, summarize as gateSummary, canAdvance } from "./lib/gates.ts";
import type { GateReading } from "./lib/gates.ts";
import { Ddd } from "./rpc.ts";

type Json = Record<string, unknown>;
type Registration = { dispose: () => Promise<void> | void };

/** 核心纪律正文（单点）。经 `instructions.entry` 键控注入（key = `ddd.discipline`）。 */
const CORE_DISCIPLINE =
  "[ddd] 关键纪律：文档为唯一权威（先改文档再落地）；变更须落 CHANGELOG 三字段；执行规则必落可执行面；持久多步待办走看板（带 acceptance）。";

function readJson(rel: string): Json | undefined {
  try {
    const p = packagePath(rel);
    if (!existsSync(p)) return undefined;
    return JSON.parse(readFileSync(p, "utf8")) as Json;
  } catch {
    return undefined;
  }
}

function readJsonl(absPath: string): Record<string, unknown>[] {
  try {
    if (!existsSync(absPath)) return [];
    return readFileSync(absPath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  } catch {
    return [];
  }
}

interface CommandRole {
  readonly role?: string;
  /** 阻塞节点（概要 §6.1 ▲）：推进前取阻塞式确认（§9.5，server 侧 `permission.assert`）。 */
  readonly blocking?: boolean;
}

const COMMAND_ROLE: Record<string, CommandRole> = {
  "ddd-init": {},
  "ddd-intent": { role: "ddd-intent-clarifier", blocking: true },
  "ddd-arch": { role: "ddd-architect", blocking: true },
  "ddd-design": { role: "ddd-designer" },
  "ddd-review": { role: "ddd-design-reviewer" },
  "ddd-test-design": { role: "ddd-test-designer" },
  "ddd-implement": { role: "ddd-implementer" },
  "ddd-test": { role: "ddd-tester" },
  "ddd-validate": { role: "ddd-auditor" },
  "ddd-change": {},
  "ddd-map": {},
  "ddd-wrapup": { blocking: true },
  "ddd-consolidate": { role: "ddd-consolidator", blocking: true },
  "ddd-board": {},
  "ddd-memo": { role: "ddd-curator" },
};

function phaseOf(name: string): Phase | undefined {
  const k = name.replace(/^ddd-/, "");
  const allowed: readonly string[] = ["init", "intent", "arch", "design", "review", "test-design", "implement", "test", "validate", "change", "map", "wrapup", "consolidate", "board", "memo"];
  return allowed.includes(k) ? (k as Phase) : undefined;
}

/**
 * 生成命令 handler。
 * Q3 派发（裁决 16）：
 *  - 默认 `same`：在**当前会话**内 `ctx.session.prompt` 注入该角色纪律，**不新建会话**；
 *  - `isolated`（仅 review/validate/consolidate）：经宿主 `subagent` 工具派发**子会话**；
 *    不可用时**降级为同会话且读数可见**（不静默降级，见 agents/DESIGN.md）。
 */
function makeHandler(name: string, ctx: any, dispatchOf: Record<string, string>): (input: { sessionID: string; prompt?: { text?: string } }) => Promise<void> {
  return async (input) => {
    const phase = phaseOf(name);
    const sessionID = input?.sessionID ?? "";
    if (!sessionID) return;
    if (phase) await putPhase(ctx, sessionID, phase);
    const spec = COMMAND_ROLE[name] ?? {};
    const role = spec.role;
    const dispatch = dispatchOf[name] ?? "same";
    // M5 意图确认（§9.5 分职责）：阻塞节点推进前取**阻塞式确认**（server `permission.assert`；
    // dialog 只做输入采集、不在此放行）；被拒即抛错中止，不静默降级。
    if (spec.blocking && typeof ctx.permission?.assert === "function") {
      await ctx.permission.assert({
        sessionID,
        action: `ddd:${name}`,
        resources: [name],
        message: `ddd/${name} 是阻塞节点：请确认在澄清/定稿后再推进（§6.1 ▲）。`,
      });
    }
    const directive = `[ddd/${name}] 相位=${phase ?? "n/a"}${role ? ` 角色=${role}` : ""}${spec.blocking ? " 阻塞确认=已取" : ""}。按方法论推进该节点；先读对应设计件与纪律切片，变更一律先改文档再落地。`;

    // F7：/ddd-init 的机械承接——物化随包件 + 落项目骨架。
    // §8.7 / C-43：**必须以 `node` 具名启动**，不得用 `process.execPath`——后者在真宿主里是
    // 宿主自身可执行文件（opencode），会把 .mjs 当子命令而失败。
    if (name === "ddd-init" && typeof ctx.session?.prompt === "function") {
      try {
        const { spawnSync } = await import("node:child_process");
        const root = projectRoot(ctx.location);
        const scaffold = spawnSync("node", [packagePath("scripts/scaffold.mjs"), "--root", root], { encoding: "utf8" });
        const tail = (scaffold.stdout ?? "").trim().split(/\r?\n/).slice(-3).join(" | ");
        const err = scaffold.error ? String(scaffold.error.message) : "";
        const ok = scaffold.status === 0 && !scaffold.error;
        await ctx.session.prompt({ sessionID, text: `[ddd] 骨架生成：${ok ? "完成" : "异常"}（${tail || err || "无输出"}）` });
      } catch {
        await ctx.session.prompt({ sessionID, text: "[ddd] 骨架生成未能机械执行；请手动运行 scripts/scaffold.mjs。" }).catch(() => {});
      }
    }

    // Q3 隔离例外：仅 review/validate/consolidate → 子会话派发（独立评审/对账；R44 归并隔离）。
    if (role && dispatch === "isolated" && typeof ctx.session?.create === "function" && typeof ctx.session?.switchAgent === "function") {
      try {
        const child = await ctx.session.create({ parentID: sessionID, agent: role, title: `ddd/${name}` });
        const childID = child?.id ?? child?.data?.id;
        if (childID) {
          await ctx.session.switchAgent({ sessionID: childID, agent: role });
          await ctx.session.prompt({ sessionID: childID, text: directive });
          return;
        }
      } catch {
        // 失败回退：本会话执行，但须在读数上可见（不得静默降级）。
        await ctx.session.prompt({ sessionID, text: `[ddd] 子代理隔离派发失败（角色 ${role}），本会话降级执行：${directive}` }).catch(() => {});
        return;
      }
    }

    // 默认（same）：**在当前会话**内执行，不新建会话。
    try {
      await ctx.session.prompt({ sessionID, text: directive });
    } catch {
      /* 命令的可见性由注入与门禁承担；prompt 失败不抛出。 */
    }
  };
}

async function putPhase(ctx: any, sessionID: string, phase: Phase): Promise<void> {
  try {
    await ctx.storage.set(`ddd.phase.${sessionID}`, phase);
  } catch {
    /* storage 可选 */
  }
  try {
    // 键名约束（宿主）：`^[a-z0-9][a-z0-9._-]*$`——不含冒号，故用 `ddd.phase`。
    await ctx.session.instructions?.entry?.put({ sessionID, key: "ddd.phase", value: phase });
  } catch {
    /* instructions.entry 为实验性；不可用即降级 */
  }
}

function sourceFirstLine(rel: string): string {
  try {
    const p = packagePath(rel);
    if (!existsSync(p)) return "";
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (t && !t.startsWith("---") && !t.startsWith("#") && !t.startsWith("name:") && !t.startsWith("description:")) return t.slice(0, 160);
    }
  } catch {
    /* ignore */
  }
  return "";
}

export default Plugin.define({
  id: "ddd",
  async setup(ctx) {
    // options 只读一次（V-02）。
    const options: Record<string, unknown> = (ctx.options as Record<string, unknown>) ?? {};
    const profile = typeof options.profile === "string" ? options.profile : "standard";

    const boardCfg = (readJson("assets/board.json") as unknown as BoardConfig) ?? {
      priorityDomain: ["P0", "P1", "P2", "P3"],
      defaultPriority: "P2",
      statusDomain: ["pending", "in_progress", "blocked", "done", "dropped"],
      starvationWindow: 8,
      starvationLimit: 3,
      orphanHours: 24,
      maxLineBytes: 8192,
    };
    const memoryCfg = (readJson("assets/memory.json") as unknown as MemoryConfig) ?? {
      remindAt: 2,
      promoteAt: 5,
      consistency: 0.8,
      decayPerSession: 1,
      injectTopN: 5,
      redlines: [],
    };
    const slices = ((readJson("assets/injection-slices.json")?.slices as unknown[]) ?? []) as Array<{ id: string; source: string; when: { phase?: string; intent?: string } }>;
    const bottomLines = ((readJson("assets/bottom-lines.json")?.bottomLines as unknown[]) ?? []) as BottomLine[];
    const roleTools = (readJson("assets/role-tools.json")?.roles as Record<string, string[]>) ?? {};

    // 自检：无执法点的底线不是底线（R57）；不合格即打日志（不阻断装配）。
    const badBL = assertEnforceable(bottomLines);
    if (badBL.length) {
      try {
        console.error(`[ddd] 底线自检失败: ${badBL.join("; ")}`);
      } catch {
        /* ignore */
      }
    }

    const registrations: Registration[] = [];

    // —— 命令（M4 命令改造口）——
    // 派发策略单点权威在 assets/commands.json 的 dispatch 字段（M10，裁决 16）。
    const dispatchOf: Record<string, string> = {};
    for (const c of ((readJson("assets/commands.json")?.commands as Array<{ name: string; dispatch?: string }>) ?? [])) {
      if (c?.name) dispatchOf[c.name] = c.dispatch ?? "same";
    }
    registrations.push(
      await ctx.command.transform((editor: any) => {
        for (const c of COMMANDS) {
          editor.add({ name: c.name, description: c.description, execute: makeHandler(c.name, ctx, dispatchOf) });
        }
      }),
    );

    // —— 技能（随包内容层；path 取包根）——
    registrations.push(
      await ctx.skill.transform((editor: any) => {
        for (const s of SKILLS) {
          const file = packagePath(`${s.dir}/SKILL.md`);
          let content = "";
          try {
            content = existsSync(file) ? readFileSync(file, "utf8") : `# ${s.name}\n\n${s.description}\n`;
          } catch {
            content = `# ${s.name}\n`;
          }
          editor.add({ id: s.id, name: s.name, description: s.description, path: file, content });
        }
      }),
    );

    // —— M13 注入层：prompt 准入只做**意图探测**（不注入、不改用户消息正文）——
    registrations.push(
      await ctx.session.hook("prompt", async (ev: any) => {
        try {
          const sessionID: string = ev.sessionID;
          const text: string = ev.prompt?.text ?? "";
          const intent = detectIntent(text, []);
          await ctx.storage.set(`ddd:intent:${sessionID}`, intent);
          // 纪律经 instructions.entry 键控注入（见下），此处**不改** ev.prompt.text。
        } catch {
          /* prompt hook 非阻断 */
        }
      }),
    );

    // —— M13 注入层：核心纪律经 instructions.entry **键控**注入（不占轮次、用户不可见、同键更新即幂等）——
    // 注意：instructions.entry 需 sessionID；在 context hook（每次请求前）按当前会话键控写入。
    // 纪律正文单点：CORE_DISCIPLINE。

    // —— M13 注入层 + M6 记忆 + M7 看板 + Q4 角色工具裁剪：context（每次请求前）——
    registrations.push(
      await ctx.session.hook("context", async (ev: any) => {
        try {
          const sessionID: string = ev.sessionID;
          // M13：核心纪律经 instructions.entry **键控**注入（同键写＝更新，天然幂等、不占轮次、用户不可见）。
          // 键名约束（宿主）：`^[a-z0-9][a-z0-9._-]*$`——**不含冒号**，故用 `ddd.discipline`。
          // 每会话只写一次（避免每步重复“更新/公告”）；键控本身保证幂等。
          // 只有 entry 面**不可用**时才回退到 system 兜底——不得两处都注入（防重复）。
          let coreViaEntry = false;
          if (typeof ctx.session?.instructions?.entry?.put === "function") {
            try {
              const seen = await ctx.storage.get(`ddd.core.set.${sessionID}`);
              if (!seen) {
                await ctx.session.instructions.entry.put({ sessionID, key: "ddd.discipline", value: CORE_DISCIPLINE });
                await ctx.storage.set(`ddd.core.set.${sessionID}`, true);
              }
              coreViaEntry = true;
            } catch {
              coreViaEntry = false; /* entry 写失败 → 走 system 兜底 */
            }
          }
          // 兜底：仅当 instructions.entry 面不可用时，纪律经 event.system 注入（每请求一次，不入用户消息正文）。
          if (!coreViaEntry && Array.isArray(ev.system)) {
            ev.system.push({ type: "text", text: CORE_DISCIPLINE } as (typeof ev.system)[number]);
          }
          // Q4：请求级工具裁剪（主强制）。只读角色不得写。
          const agent: string = String(ev.agent ?? "");
          const allow = roleTools[agent];
          if (allow && ev.tools && typeof ev.tools === "object") {
            const allowSet = new Set(allow);
            for (const toolName of Object.keys(ev.tools)) {
              if (!allowSet.has(toolName)) delete ev.tools[toolName];
            }
          }

          // 相位/意图 → 最小切片集（M13，判定可观测）。
          let phase: Phase | undefined;
          let intent: Intent | undefined;
          try {
            phase = (await ctx.storage.get(`ddd:phase:${sessionID}`)) as Phase | undefined;
            intent = (await ctx.storage.get(`ddd:intent:${sessionID}`)) as Intent | undefined;
          } catch {
            /* storage 可选 */
          }
          const route = routeSlices({ phase, intent }, slices);
          if (Array.isArray(ev.system)) {
            for (const id of route.sliceIds) {
              const slice = slices.find((s) => s.id === id);
              const one = slice ? sourceFirstLine(slice.source) : "";
              ev.system.push({ type: "text", text: `[ddd:${id}] ${one}` } as (typeof ev.system)[number]);
            }
          }

          // M7：看板摘要（持久多步待办，每步注回）。
          try {
            const root = projectRoot(ctx.location);
            const rows = readJsonl(projectPath(root, "docs/board/board.jsonl")) as unknown as BoardRow[];
            const proj = boardProject(rows);
            const sum = boardSummary(proj);
            if (Array.isArray(ev.system) && proj.length > 0) {
              const top = proj.slice(0, 3).map((it) => `${it.taskId}(${it.priority}/${it.status}) ${it.title}`).join("; ");
              ev.system.push({ type: "text", text: `[ddd:board] 待办 ${sum.pending} / 进行 ${sum.inProgress} / 阻塞 ${sum.blocked}${top ? ` — top: ${top}` : ""}` } as (typeof ev.system)[number]);
            }
          } catch {
            /* 项目根缺失或未落看板 */
          }

          // M6：记忆 topN + 候选提示。
          try {
            const root = projectRoot(ctx.location);
            const scope = projectScope(root);
            const raw = readJsonl(projectPath(root, "docs/memory/memory.jsonl"));
            const entries = foldMemory(raw);
            const inj = selectInjection(entries, scope, memoryCfg);
            if (Array.isArray(ev.system)) {
              for (const e of inj) {
                ev.system.push({ type: "text", text: `[ddd:mem] ${e.symptom ?? e.key}（${e.confidence}★）` } as (typeof ev.system)[number]);
              }
              const cand = countCandidates(entries, memoryCfg);
              if (cand > 0) ev.system.push({ type: "text", text: `[ddd:mem] 有 ${cand} 条候选待提升（/ddd-memo list）` } as (typeof ev.system)[number]);
            }
          } catch {
            /* 未落记忆 */
          }

          // M13/§19.5 自省：注入自报（可观测）。
          if (Array.isArray(ev.system)) {
            ev.system.push({ type: "text", text: `[ddd:self] 注入切片 ${route.sliceIds.length} 片（profile=${profile} phase=${route.basis.phase ?? "-"} intent=${route.basis.intent ?? "-"}）` } as (typeof ev.system)[number]);
          }
        } catch {
          /* context hook 不阻断 */
        }
      }),
    );

    // —— M6 复发统计（tool.execute.before，去重键落 storage）——
    registrations.push(
      await ctx.tool.hook("execute.before", async (ev: any) => {
        try {
          const root = projectRoot(ctx.location);
          const raw = readJsonl(projectPath(root, "docs/memory/memory.jsonl"));
          const entries = foldMemory(raw);
          const dedupSet = new Set<string>();
          try {
            const prev = (await ctx.storage.get(`ddd:mem-seen:${ev.sessionID}`)) as string[] | undefined;
            for (const k of prev ?? []) dedupSet.add(k);
          } catch {
            /* ignore */
          }
          for (const e of entries) {
            if (e.trigger && matchesTrigger(e.trigger, String(ev.tool), ev.input)) {
              const key = `${e.scope}|${e.key}|${ev.sessionID}`;
              if (!dedupSet.has(key)) {
                dedupSet.add(key);
                try {
                  await ctx.storage.set(`ddd:mem-seen:${ev.sessionID}`, [...dedupSet]);
                } catch {
                  /* ignore */
                }
              }
            }
          }
        } catch {
          /* ignore */
        }
      }),
    );

    // —— M7 证据挂载 + 可见留痕（tool.execute.after）——
    registrations.push(
      await ctx.tool.hook("execute.after", async (ev: any) => {
        try {
          if (ev.status === "completed" && ev.tool) {
            const key = `ddd:evidence:${ev.sessionID}`;
            const prev = ((await ctx.storage.get(key)) as unknown[]) ?? [];
            prev.push({ tool: ev.tool, id: ev.id, ts: new Date().toISOString() });
            await ctx.storage.set(key, prev as never);
          }
        } catch {
          /* ignore */
        }
      }),
    );

    // —— M8 执行规则：evaluate 兜底（fail-safe，可置 deny）——
    registrations.push(
      await ctx.permission.hook("evaluate", async (ev: any) => {
        try {
          const observed: Record<string, { examined: number; unrecognized: number; hits: number }> = {};
          for (const bl of bottomLines) {
            const hit = ev.action === bl.action && resourcesMatch(bl.resource, ev.resources ?? []);
            observed[bl.id] = { examined: 1, unrecognized: 0, hits: hit ? 1 : 0 };
          }
          const verdicts = evaluateBottomLines(bottomLines, { observed });
          const blocking = verdicts.find((v) => v.verdict === "block");
          if (blocking) {
            ev.effect = "deny";
            ev.message = blocking.remedy ?? "违反底线，已拒绝。";
          }
        } catch {
          // fail-safe：无法判定时倾向 ask（默认拒绝），不默认放行。
          try {
            ev.effect = "ask";
          } catch {
            /* ignore */
          }
        }
      }),
    );

    // —— shell 沙箱变量 + 超时纪律（毫秒域，§9.4）——
    try {
      if (ctx.shell?.hook) {
        registrations.push(
          await ctx.shell.hook("create.before", async (ev: any) => {
            try {
              ev.env = { ...(ev.env ?? {}), DDD_ACTIVE: "1" };
              // 环境适配：Windows PowerShell 输出编码（GBK→UTF-8），消除中文乱码。
              // 走 shell.create.before（宿主「改 shell 命令」正门，不绕内置扫描器）；可用 options 关闭。
              const psUtf8 = options.powershellUtf8 !== false; // 默认 true
              if (psUtf8 && typeof ev.command === "string") {
                ev.command = applyEncodingPrefix(ev.shell, ev.command, true);
              }
            } catch {
              /* ignore */
            }
          }),
        );
      }
    } catch {
      /* shell 面可选 */
    }

    // —— M6 衰减：会话关闭（session.deleted）——
    const ac = new AbortController();
    void (async () => {
      try {
        const iter = ctx.event.subscribe({ types: ["session.deleted"], signal: ac.signal } as never);
        for await (const _ev of iter as AsyncIterable<unknown>) {
          // 衰减由唯一写入器处理；此处只推进游标，保持非承重。
        }
      } catch {
        /* 事件面为旁证，缺失不损功能（V-04） */
      }
    })();

    // —— RPC：gates / board（只读方法面）——
    let rpcReg: Registration | undefined;
    try {
      rpcReg = (await ctx.rpc.register(Ddd, {
        gates: async () => {
          const readings = sampleReadings(ctx);
          return { readings, summary: gateSummary(readings) };
        },
        board: async () => {
          let rows: BoardRow[] = [];
          try {
            const root = projectRoot(ctx.location);
            rows = readJsonl(projectPath(root, "docs/board/board.jsonl")) as unknown as BoardRow[];
          } catch {
            /* 无项目根 → 空投影 */
          }
          return boardSummary(boardProject(rows));
        },
      })) as unknown as Registration;
      if (rpcReg) registrations.push(rpcReg);
    } catch {
      /* RPC 注册失败不阻断其余装配 */
    }

    return async () => {
      ac.abort();
      for (const r of registrations.reverse()) {
        try {
          await r.dispose();
        } catch {
          /* best-effort cleanup */
        }
      }
    };
  },
});

/** 资源匹配：精确或通配 `**`。 */
function resourcesMatch(pattern: string, resources: readonly string[]): boolean {
  if (!resources || resources.length === 0) return false;
  const rx = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, ".*").replace(/(?<!\.)\*/g, "[^/]*") + "$", "i");
  return resources.some((r) => rx.test(r) || r.includes(pattern));
}

/** 由项目状态快照取门禁读数（缺件即该门禁 na）。 */
function sampleReadings(ctx: any): GateReading[] {
  const state = collectState(ctx);
  return [gateFns.G1(state), gateFns.G2(state), gateFns.G3(state), gateFns.G4(state), gateFns.G5(state), gateFns.G6(state)];
}

function collectState(ctx: any): any {
  try {
    const root = projectRoot(ctx.location);
    const boardRows = readJsonl(projectPath(root, "docs/board/board.jsonl")) as unknown as BoardRow[];
    const proj = boardProject(boardRows);
    const hasBoard = existsSync(projectPath(root, "docs/board/board.jsonl"));
    return {
      wrapup: hasBoard ? { tempOpen: 0, boardActive: proj.length, versionPlaces: 0 } : undefined,
    };
  } catch {
    return {};
  }
}

/** 折叠记忆行：按 id 取最新一条。 */
function foldMemory(rows: readonly Record<string, unknown>[]): MemoryEntry[] {
  const byId = new Map<string, MemoryEntry>();
  for (const r of rows) {
    const id = String(r.id ?? "");
    if (!id) continue;
    const cur = byId.get(id);
    const entry = {
      id,
      kind: (r.kind as MemoryEntry["kind"]) ?? "record",
      type: (r.type as MemoryEntry["type"]) ?? "pitfall",
      scope: String(r.scope ?? ""),
      key: String(r.key ?? ""),
      symptom: (r.symptom as string) ?? undefined,
      cause: (r.cause as string) ?? undefined,
      trigger: (r.trigger as string) ?? undefined,
      guardId: (r.guardId as string) ?? undefined,
      occurrences: Number(r.occurrences ?? 1),
      confidence: Number(r.confidence ?? 1),
      consistency: r.consistency === undefined ? undefined : Number(r.consistency),
      source: (r.source as string) ?? undefined,
      archived: r.archived === true,
    } satisfies MemoryEntry;
    if (!cur || entry.occurrences >= cur.occurrences) byId.set(id, entry);
  }
  return [...byId.values()];
}
