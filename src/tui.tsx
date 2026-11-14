/**
 * src/tui.tsx —— tui part（增强，非承重）。
 *
 * 边界：keymap.layer、ui.slot/panel、ui.dialog.*、attention.notify；不含业务逻辑（跨端走 RPC）。
 * 裁定 V-08：核心命令一律由 server part 提供；TUI 不通时命令仍可用。
 * 裁定 V-06：id 显式声明为与 server 相同前缀 `ddd`。
 * §9.5 分职责：dialog.select/prompt 只做**输入采集**（选场景、收四问）；「过闸机」的阻塞确认
 *              由 server 侧 `ctx.permission.assert` 承担（见 DESIGN-index.md 的 M5）。二者不重叠。
 */

import { Plugin } from "@opencode/plugin/tui";
import { Ddd } from "./rpc.ts";

const SCENARIOS = [
  { title: "场景一 · 项目从零开始选型实现", value: "greenfield", description: "无既有代码/设计树" },
  { title: "场景二 · 二次开发（追加功能 / 修 bug）", value: "incremental", description: "已有项目，Todo 驱动" },
  { title: "场景三 · 项目迁移", value: "migration", description: "代码存在，设计树不存在（反推一次）" },
] as const;

export default Plugin.define({
  id: "ddd",
  setup(context) {
    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "ddd-validate",
          title: "ddd 门禁读数",
          description: "经 RPC 读 server 的门禁摘要",
          slash: { name: "ddd-tui-validate" },
          run: async () => {
            try {
              const rpc = context.client.rpc(Ddd);
              const res = (await rpc.gates({})) as { summary: { pass: number; block: number; visible: number; na: number } };
              const s = res.summary;
              context.ui.toast.show({ message: `ddGates pass=${s.pass} block=${s.block} visible=${s.visible} na=${s.na}`, variant: s.block ? "warning" : "success" });
            } catch {
              context.ui.toast.show({ message: "ddGates 不可用：RPC 未连通（命令仍由 server part 提供）", variant: "info" });
            }
          },
        },
        {
          id: "ddd-board",
          title: "ddd 看板摘要",
          description: "经 RPC 读 server 的看板投影摘要",
          slash: { name: "ddd-tui-board" },
          run: async () => {
            try {
              const rpc = context.client.rpc(Ddd);
              const res = (await rpc.board({})) as { pending: number; inProgress: number; blocked: number };
              context.ui.toast.show({ message: `ddBoard 待办 ${res.pending} / 进行 ${res.inProgress} / 阻塞 ${res.blocked}`, variant: res.blocked ? "warning" : "info" });
            } catch {
              context.ui.toast.show({ message: "ddBoard 不可用：RPC 未连通", variant: "info" });
            }
          },
        },
        {
          id: "ddd-workflow",
          title: "ddd 工作流状态与验收",
          description: "查看真实执行状态，并在显式确认后运行项目测试",
          slash: { name: "ddd-tui-workflow" },
          run: async () => {
            const sessionID = (await context.ui.dialog.prompt({ title: "输入 OpenCode 会话 ID", placeholder: "从当前会话复制 ID" }))?.trim();
            if (!sessionID) return;
            try {
              const rpc = context.client.rpc(Ddd);
              const current = await rpc.overview({ sessionID });
              context.ui.toast.show({ message: `ddd/${current.phase || '-'} ${current.status} #${current.seq}；Skill:${current.skills.join(',')||'-'}；Gates:${current.gates.pass}/6 (阻塞:${current.blockedGates.join(',')||'无'})；Board:${current.board.pending}/${current.board.inProgress}/${current.board.blocked}`.slice(0,260), variant: current.blockedGates.length ? 'warning' : current.status === 'verified' ? 'success' : 'info' });
              if (current.status === 'verified' || current.status === 'failed' || current.status === 'missing') return;
              const action = await context.ui.dialog.select({title:'执行验收？会运行项目测试（可能执行项目自定义脚本）', options:[
                {title:'仅查看，不执行',value:'view'},
                ...(current.canVerify?[{title:'我确认执行真实测试验证',value:'verify'}]:[]),
                {title:'关闭未完成任务（需要填写失败原因）',value:'close'},
              ]});
              if(action==='close'){
                const reason=await context.ui.dialog.prompt({title:'未完成/失败原因（至少三字）',placeholder:'说明失败或取消原因'});
                if(!reason || reason.trim().length<3)return;
                const confirm=await context.ui.dialog.select({title:'确认关闭？任务不会自动重放',options:[{title:'取消',value:'cancel'},{title:'确认关闭为 failed',value:'close'}]});
                if(confirm!=='close')return;
                const closed=await rpc.workflowClose({sessionID,confirmed:true,reason:reason.trim()});
                context.ui.toast.show({message:`任务已标记 ${closed.status}：${closed.reason}`.slice(0,260),variant:'warning'});
              }else if(action==='verify'){
                const result = await rpc.workflowVerify({sessionID,confirmed:true});
                context.ui.toast.show({message:`验收 ${result.status}：${result.reason}`.slice(0,260),variant:result.status==='verified'?'success':'warning'});
              }
            } catch(error) {
              context.ui.toast.show({message:`工作流查询/验收失败：${String(error).slice(0,150)}`,variant:'warning'});
            }
          },
        },
        {
          // §9.5：dialog 只做**输入采集**（选场景 + 收四问）；放行（闸机）不在此，由 server assert 承担。
          id: "ddd-intent-input",
          title: "ddd 意图输入（收集场景与四问）",
          description: "交互式采集：选场景 → 收四问作答（不含放行）",
          slash: { name: "ddd-tui-intent" },
          run: async () => {
            void context.attention.notify({ title: "ddd 意图输入", message: "开始采集场景与四问；放行由 server /ddd-intent 的 assert 裁决。", sound: { name: "question" } });
            const scenario = await context.ui.dialog.select({ title: "选择场景", options: SCENARIOS.map((s) => ({ title: s.title, value: s.value, description: s.description })) });
            if (scenario === undefined) {
              context.ui.toast.show({ message: "已取消（未采集输入；放行仍由 server assert 承担）", variant: "info" });
              return;
            }
            const who = await context.ui.dialog.prompt({ title: "四问 · 谁在什么场景遇到什么", placeholder: "使用者与触发条件" });
            const result = await context.ui.dialog.prompt({ title: "四问 · 要什么可观察的结果", placeholder: "可见的行为/读数" });
            const accept = await context.ui.dialog.prompt({ title: "四问 · 怎么判断做对", placeholder: "可判定的验收线索" });
            const notdoing = await context.ui.dialog.prompt({ title: "四问 · 本次明确不做", placeholder: "边界" });
            // 经 server RPC 保存为原始草稿，不直接冻结需求或越过确认。
            try {
              const data = { scenario, who: who ?? "", result: result ?? "", accept: accept ?? "", notdoing: notdoing ?? "" };
              const saved = await context.client.rpc(Ddd).intentCapture(data);
              context.ui.toast.show({ message: `四问草稿已持久保存；缺 ${saved.missing} 项。下一步使用 /ddd-intent 澄清并确认。`, variant: saved.missing ? "warning" : "success" });
            } catch (error) {
              context.ui.toast.show({ message: `保存失败：${String(error).slice(0,100)}`, variant: "warning" });
            }
          },
        },
      ],
    }));

    // 不注册空的 session.panel：宿主显示空面板会误导用户。读数通过上述 RPC 命令展示。
    return () => {};
  },
});
