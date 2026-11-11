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
            context.ui.toast.show({
              message: `已采集：场景=${scenario}；四问已填 ${[who, result, accept, notdoing].filter((x) => x !== undefined && x !== "").length}/4（放行由 server /ddd-intent 的 assert 裁决）`,
              variant: "info",
            });
          },
        },
      ],
    }));

    // 会话侧面板：看板与报告（占位渲染，数据经 RPC）。
    const disposePanel = context.ui.slot({
      append: "session.panel",
      render: () => null,
    });

    return () => {
      disposePanel();
    };
  },
});
