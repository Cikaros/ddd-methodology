/** Command dispatch and durable receipt coordination. No host registration side effects. */
import { readFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { COMMANDS } from './registry.ts';
import { packagePath, projectRoot } from './paths.ts';
import { routeSlices, roleConstraints, sliceSources, type Phase, type SliceSpec } from './router.ts';
import { asData } from './model-policy.ts';
import { readCheckpoint, recordDispatch, recordWorkflow, resumeHint } from './workflow-store.mjs';
import type { WorkflowController } from './workflow-controller.ts';
import {buildHandoff} from './agent-handoff.ts';
function phaseOf(name: string): Phase | undefined {
  const k = name.replace(/^ddd-/, "");
  return COMMANDS.some(c => c.name === name) ? (k as Phase) : undefined;
}

/** 读取随包角色件正文（只读；缺失即返回空串，不回落、不发明）。 */
function readRoleBody(role: string): string {
  const p = packagePath(`agents/${role}.md`);
  if (!existsSync(p)) throw new Error(`角色规则缺失，不得无约束执行：${role}`);
  return readFileSync(p, "utf8");
}

/**
 * 生成命令 handler。
 * Q3 派发（裁决 16）：
 *  - 默认 `same`：在**当前会话**内 `ctx.session.prompt` 注入该角色纪律，**不新建会话**；
 *  - `isolated`（仅 review/validate/consolidate）：经宿主 `subagent` 工具派发**子会话**；
 *    不可用时**降级为同会话且读数可见**（不静默降级，见 agents/DESIGN.md）。
 */
export function makeHandler(name: string, ctx: any, slices: readonly SliceSpec[], workflow?: WorkflowController): (input: { sessionID: string; prompt?: { text?: string; [key: string]: unknown }; delivery?: "steer" | "queue" }) => Promise<void> {
  return async (input) => {
    const phase = phaseOf(name);
    const sessionID = input?.sessionID ?? "";
    if (!sessionID) throw new Error("ddd 命令缺少 sessionID");
    const spec = COMMANDS.find(c => c.name === name);
    if (!spec) throw new Error(`未知 ddd 命令：${name}`);
    const role = spec.role;
    const dispatch = spec.dispatch;
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
    if (phase) await putPhase(ctx, sessionID, phase);
    const root = projectRoot(ctx.location);
    const previous = readCheckpoint(root, sessionID);
    if (phase) {
      await recordDispatch(root, sessionID, phase, "prepared", input.prompt?.text ?? "");
      await workflow?.prepared(sessionID,phase,input.prompt?.text ?? "");
    }
    let promptAccepted = false;
    try {
    // 指令构建（单点权威：角色约束正文只在 agents/<role>.md，此处是只读投影，不复制）。
    // 背景：`same` 派发不切 agent → 角色 md 的「约束」节不会自动进入上下文；须由指令显式带入。
    // 指令尾部的 〖硬约束〗 放在 END 区：即使模型对中段注意力衰减，边界约束仍处于末位。
    const parts = [`[ddd/${name}] 相位=${phase ?? "n/a"}${role ? ` 角色=${role}` : ""}${spec.blocking ? " 阻塞确认=已取" : ""}。按方法论推进该节点；变更一律先改文档再落地。`];
    if (previous) parts.push(`[ddd:resume] ${resumeHint(previous)}`);
    const sources = sliceSources(routeSlices({ phase }, slices).sliceIds, slices);
    if (sources.length) parts.push(`先读纪律切片（全文，按需）：${sources.join("、")}。`);
    if (role) {
      const constraints = roleConstraints(readRoleBody(role));
      if (constraints.length) {
        parts.push(`〖硬约束 · 逐条遵守〗\n${constraints.map((c, i) => `${i + 1}. ${c}`).join("\n")}`);
      }
    }
    // OpenCode CommandInvocation.prompt contains user arguments and attachments.
    // Preserve them; structured quoting keeps user data out of method instructions.
    if (input.prompt?.text?.trim()) parts.push(`〖命令请求（原文数据）〗${JSON.stringify(input.prompt.text).slice(0, 8000)}`);
    parts.push("〖执行前自检〗未读齐上列切片与对应设计件即开始产出 → 停止并报告缺口；未改设计件不得改代码。");
    const handoff=buildHandoff({name,phase:phase??'n/a',role,parentSession:sessionID,isolated:dispatch==='isolated',sources,resume:previous?resumeHint(previous):undefined});
    const directive = [parts[0],handoff,...parts.slice(1)].join('\n');
    const prompt = { ...(input.prompt ?? {}), sessionID, text: directive, ...(input.delivery ? { delivery: input.delivery } : {}) };

    // F7：/ddd-init 的机械承接——物化随包件 + 落项目骨架。
    // §8.7 / C-43：**必须以 `node` 具名启动**，不得用 `process.execPath`——后者在真宿主里是
    // 宿主自身可执行文件（opencode），会把 .mjs 当子命令而失败。
    if (name === "ddd-init") {
      try {
        const { stdout, stderr } = await promisify(execFile)("node", [packagePath("scripts/scaffold.mjs"), "--root", root], { cwd: root, timeout: 45_000, maxBuffer: 1024 * 1024 });
        prompt.text += `\n[ddd:init] 骨架执行成功：${asData((stdout || stderr).trim().split(/\r?\n/).slice(-3).join(' | '), 500)}`;
      } catch (error) {
        throw new Error(`ddd-init 骨架失败（中止后续派发）：${(error as Error).message}`);
      }
    }

    // Isolate only agent setup errors; a prompt/receipt failure must never replay
    // the same request in the parent session (at-most-once dispatch).
    let targetSession = sessionID;
    let fallback = '';
    if (role && dispatch === "isolated" && typeof ctx.session?.create === "function" && typeof ctx.session?.switchAgent === "function") {
      try {
        const child = await ctx.session.create({ parentID: sessionID, agent: role, title: `ddd/${name}` });
        const childID = child?.id ?? child?.data?.id;
        if (!childID) throw new Error('宿主未返回子会话 ID');
        await ctx.session.switchAgent({ sessionID: childID, agent: role });
        targetSession = childID;
        await workflow?.trackChild(childID,sessionID);
      } catch (error) {
        fallback = `[ddd] 子代理隔离派发不可用（${(error as Error).message}），改为当前会话执行。\n`;
      }
    } else if (role && dispatch === 'isolated') {
      fallback = '[ddd] 宿主不支持隔离派发，改为当前会话执行。\n';
    }
    await ctx.session.prompt({ ...prompt, sessionID: targetSession, text: fallback + prompt.text });
    promptAccepted = true;
    if (phase) {
      if(workflow) await workflow.dispatched(sessionID,phase);
      else await recordDispatch(root,sessionID,phase,'dispatched',input.prompt?.text ?? '');
    }
    } catch (error) {
      if (!promptAccepted && phase) {
        const last=readCheckpoint(root,sessionID);
        if(last && ['prepared','dispatched','running'].includes(last.status))
          await recordWorkflow(root,sessionID,{phase,status:'failed',reason:'命令派发中止'}).catch(()=>{});
      }
      throw error;
    }
  };
}

async function putPhase(ctx: any, sessionID: string, phase: Phase): Promise<void> {
  try {
    await ctx.storage.set(`ddd:phase:${sessionID}`, phase);
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

