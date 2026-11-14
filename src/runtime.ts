/**
 * src/runtime.ts —— server part 装配边界（Plugin.define({ id: "ddd", setup })）。
 *
 * 边界：装配与注册；options 只读一次（裁定 V-02）。
 * 装配：四类注册口（命令/技能/代理/工具）＋ hooks ＋ RPC，并返回 cleanup。
 * 承重：M4 命令改造口、M5 意图确认、M6 记忆、M7 看板、M8 执行规则、M12 归并、M13 注入/守卫。
 */

import { makeHandler } from "./lib/command-dispatcher.ts";
import { readFileSync, existsSync } from "node:fs";
import { COMMANDS, SKILLS } from "./lib/registry.ts";
import { readBoardRows } from "./lib/board-store.mjs";
import { evaluateProject } from "./lib/gate-evaluator.ts";
import { createContextHook } from "./lib/context-service.ts";
import {readMemoryRows,foldMemoryRows,recordMemoryHit,recordSessionDecay} from "./lib/memory-store.mjs";
import { Diagnostics } from "./lib/diagnostics.ts";
import { saveIntentDraft } from "./lib/intent-store.mjs";
import { packagePath, packageRoot, projectRoot } from "./lib/paths.ts";
import { detectIntent } from "./lib/router.ts";
import { promptSkillHints } from "./lib/skill-plan.ts";
import { evaluateBottomLines, assertEnforceable, type BottomLine } from "./lib/guard.ts";
import { matchesTrigger, type MemoryConfig } from "./lib/memory.ts";
import { projectAll as boardAll, summarize as boardSummary, type BoardConfig } from "./lib/board.ts";
import { applyEncodingPrefix } from "./lib/shell-encoding.ts";
import { needsUtf8Bom, withUtf8Bom } from "./lib/powershell-bom.ts";
import { Ddd } from "./rpc.ts";
import { readSessionOverview } from "./lib/session-overview.ts";
import { WorkflowController,sessionOfEvent } from './lib/workflow-controller.ts';
import {resumeHint} from './lib/workflow-store.mjs';

type Json = Record<string, unknown>;
type Registration = { dispose: () => Promise<void> | void };

function readJson(rel: string): Json | undefined {
  try {
    const p = packagePath(rel);
    if (!existsSync(p)) return undefined;
    return JSON.parse(readFileSync(p, "utf8")) as Json;
  } catch (error) {
    throw new Error(`ddd 配置损坏（${rel}）：${(error as Error).message}`);
  }
}

export async function setupRuntime(ctx: any) {
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
    const diagnostics = new Diagnostics();
    const workflow = new WorkflowController(projectRoot(ctx.location),(label,error)=>diagnostics.record(label,error));

    // —— 命令（M4 命令改造口）——
    // 派发策略单点权威在 assets/commands.json 的 dispatch 字段（M10，裁决 16）。
    registrations.push(
      await ctx.command.transform((editor: any) => {
        for (const c of COMMANDS) {
          editor.add({ name: c.name, description: c.description, execute: makeHandler(c.name, ctx, slices, workflow) });
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
          const attached = Array.isArray(ev.prompt?.files) ? ev.prompt.files : [];
          const files = attached.map((f: unknown) => typeof f === "string" ? f : typeof f === "object" && f && "path" in f ? String((f as {path:unknown}).path) : "").filter(Boolean);
          const intent = detectIntent(text, files);
          await ctx.storage.set(`ddd:intent:${sessionID}`, intent);
          const hints = promptSkillHints(projectRoot(ctx.location), { text, files });
          // Short-lived task hints only: no raw user prompt or Skill body is persisted.
          // Workspace-derived recommendations are reevaluated each model request.
          await ctx.storage.set(`ddd:skill-hints:${sessionID}`, hints);
          // 纪律经 instructions.entry 键控注入（见下），此处**不改** ev.prompt.text。
        } catch (error) {
          diagnostics.record("prompt.hook", error);
        }
      }),
    );

    // Context content, role tool controls, and Flash budgets live in one request service.
    registrations.push(await ctx.session.hook("context", createContextHook(ctx, {options, boardCfg, memoryCfg, slices, roleTools, diagnostics, ownerSession:(sid:string)=>workflow.originalSession(sid)})));

    // —— M6 复发统计（tool.execute.before，去重键落 storage）——
    registrations.push(
      await ctx.tool.hook("execute.before", async (ev: any) => {
        try {
          // 环境适配：.ps1 源码 BOM（PS 5.1 无 BOM 即按 GBK 解码 → 中文乱）。拦 write/edit 的写入内容。
          if (options.powershellUtf8 !== false && ev?.input && typeof ev.input === "object") {
            try {
              const inp = ev.input as { path?: string; content?: string; newString?: string };
              if (ev.tool === "write" && needsUtf8Bom(inp.path, inp.content)) {
                inp.content = withUtf8Bom(inp.content as string);
              } else if (ev.tool === "edit" && needsUtf8Bom(inp.path, inp.newString)) {
                inp.newString = withUtf8Bom(inp.newString as string);
              }
            } catch {
              /* ignore */
            }
          }
          const root = projectRoot(ctx.location);
          const entries=foldMemoryRows(readMemoryRows(root));
          for(const entry of entries){
            if(entry.trigger && matchesTrigger(entry.trigger,String(ev.tool),ev.input) && typeof ev.sessionID==='string'){
              await recordMemoryHit(root,entry,ev.sessionID,memoryCfg);
            }
          }
        } catch (error) {
          diagnostics.record("tool.before", error);
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
            if (prev.length > 128) prev.splice(0, prev.length - 128);
            await ctx.storage.set(key, prev as never);
          }
        } catch (error) {
          diagnostics.record("tool.after", error);
        }
        // Independent of storage cache failures: durable lifecycle and tool count.
        try { if (typeof ev.sessionID === 'string') await workflow.toolEvent(ev.sessionID, ev.status !== 'completed', typeof ev.tool==='string'?ev.tool:undefined, typeof ev.id==='string'?ev.id:undefined); }
        catch (error) { diagnostics.record('workflow.tool',error); }
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
        } catch (error) {
          diagnostics.record("permission.guard", error, "error");
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

    // Durable execution events close the loop only up to awaiting_verification.
    // A host success event is *never* a DDD gate pass. Event streams are volatile;
    // the durable checkpoint remains authoritative after reconnects.
    const ac = new AbortController();
    if (ctx.event?.subscribe) void (async () => {
      try {
        const types = ['session.execution.started','session.execution.succeeded',
          'session.execution.failed','session.execution.interrupted','session.usage.updated',
          'session.usage.recorded','session.model.selected','session.deleted'];
        const iter = ctx.event.subscribe({ types, signal: ac.signal } as never);
        for await (const ev of iter as AsyncIterable<unknown>) {
          try { await workflow.onHostEvent(ev); }
          catch (error) { diagnostics.record('workflow.event',error); }
          if((ev as any)?.type==='session.deleted'){
            const sid=sessionOfEvent(ev);
            if(sid)try{await recordSessionDecay(projectRoot(ctx.location),sid,memoryCfg);}catch(error){diagnostics.record('memory.decay',error);}
          }
        }
      } catch (error) {
        if (!ac.signal.aborted) diagnostics.record('event.subscribe', error);
      }
    })();

    // —— RPC：gates / board（只读方法面）——
    let rpcReg: Registration | undefined;
    try {
      rpcReg = (await ctx.rpc.register(Ddd, {
        gates: async () => {
          const result = evaluateProject(projectRoot(ctx.location), COMMANDS.map(c => c.name), packageRoot());
          return { readings: result.readings, summary: result.summary };
        },
        board: async () => {
          const root = projectRoot(ctx.location);
          return boardSummary(boardAll(readBoardRows(root, boardCfg.maxLineBytes)));
        },
        intentCapture: async (input: any) => saveIntentDraft(projectRoot(ctx.location), input),
        overview: async (input:{sessionID:string}) => readSessionOverview(
          projectRoot(ctx.location),input.sessionID,workflow,
          (owner:string)=>diagnostics.optional('storage.skillHints',()=>ctx.storage.get(`ddd:skill-hints:${owner}`),[]),
          boardCfg),
        workflow: async (input: {sessionID:string}) => {
          const ck=workflow.current(input.sessionID);
          return {present:!!ck,phase:ck?.phase??'',status:ck?.status??'missing',seq:ck?.seq??0,
            summary:ck?resumeHint(ck):'当前会话无 ddd 工作流',proofSha:ck?.proof?.fingerprint??''};
        },
        workflowVerify: async (input: {sessionID:string;confirmed:boolean}) => {
          if(input.confirmed!==true)throw Error('只有用户确认后才能运行项目测试');
          const result=await workflow.verify(input.sessionID);
          return {status:result.status,reason:result.reason,proofSha:result.checkpoint?.proof?.fingerprint??''};
        },
        workflowClose: async(input:{sessionID:string;confirmed:boolean;reason:string})=>{
          if(input.confirmed!==true || !input.reason?.trim())throw Error('关闭任务需要确认及原因');
          const ck=await workflow.acknowledgeFailure(input.sessionID,input.reason);
          return {status:ck.status,reason:ck.reason??''};
        },
      })) as unknown as Registration;
      if (rpcReg) registrations.push(rpcReg);
    } catch (error) {
      diagnostics.record("rpc.register", error);
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
}

/** 资源匹配：精确或通配 `**`。 */
function resourcesMatch(pattern: string, resources: readonly string[]): boolean {
  if (!resources || resources.length === 0) return false;
  const rx = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, ".*").replace(/(?<!\.)\*/g, "[^/]*") + "$", "i");
  return resources.some((r) => rx.test(r));
}

