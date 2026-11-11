/**
 * src/tui.tsx —— tui part（增强，非承重）。
 *
 * 边界：keymap.layer、ui.slot/panel、ui.dialog.*、attention.notify；不含业务逻辑（跨端走 RPC）。
 * 裁定 V-08：核心命令一律由 server part 提供；TUI 不通时命令仍可用。
 * 裁定 V-06：id 显式声明为与 server 相同前缀 `ddd`。
 */

import { Plugin } from "@opencode/plugin/tui";
import { Ddd } from "./rpc.ts";

export default Plugin.define({
  id: "ddd",
  setup(context) {
    // 斜杠命令：查看门禁与看板（读 server 的 RPC；不通则降级为 plain notify）。
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
