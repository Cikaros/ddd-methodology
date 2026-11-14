---
doc: design
level: file
target: src/tui.tsx
status: frozen
landed: true
covers: [Plugin.define]
depends: [src/rpc.ts]
updated: 2026-11-11
---

# 文件设计：src/tui.tsx（tui part）

## 定位与边界

- **职责**：终端交互层——斜杠命令、会话侧面板、阻塞式确认对话框、长任务通知。
- **定位**：**增强**，非承重。核心命令一律由 server part 提供；TUI 不通（如远程 RPC）时命令仍可用（裁定 V-08）。
- **边界内**：`context.keymap.layer`、`context.ui.*`、`context.attention.notify`。
- **边界外**：任何业务逻辑（不得在 TUI 复制业务，跨端走 RPC）。

## 阻塞式确认：两者分职责（§9.5）

§9.5 要求同一确认点**显式择一**。本实现**两个原语都用，但职责分离、确认点不重叠**：

| 原语 | 归属 | 职责（回答什么） | 落点 |
|---|---|---|---|
| `context.ui.dialog.select/prompt` | tui（本件） | **采集结构化输入**（选场景、收集四问作答） | `ddd-tui-intent` 交互流程 |
| `ctx.permission.assert` | server（`DESIGN-index.md`） | **过闸机**：确认「据此推进」（可中止、可记忆、远程恒可用） | 阻塞节点 `ddd-intent/arch/wrapup/consolidate` |

- **不重叠**：dialog 在「输入段」，assert 在「放行段」；同一确认点仍只由一个原语承担 → 不违反 §9.5。
- **可删边界（Build to Delete）**：dialog 是**增强**（无交互 TUI 时省略），assert 是**机制底线**（绕不过）。
- dialog 取消（`undefined`）不直接中止流程；是否中止由 assert 的闸机结果决定。

## 对外暴露接口

| 导出 | 形态 | 说明 |
|---|---|---|
| `default` | `Plugin.define`（tui） | tui part 入口；`id` 显式声明为 `ddd` 前缀（规避一致性裁决 V-06） |

## 需引入的依赖

- `@opencode/plugin/tui`：`Plugin`。
- `@opentui/solid`、`solid-js`（渲染 peers，运行时由宿主解析）。
- `./rpc.ts`：只读导入契约，经 `context.client.rpc(Ddd)` 调用。

## 调用的模块能力及接口

| 被调用 | 能力 |
|---|---|
| `context.keymap.layer` | 注册斜杠命令/快捷键（工厂须**纯**） |
| `context.ui.slot/panel` | 看板与报告面板 |
| `context.ui.dialog.select/prompt` | **采集结构化输入**（选场景、收四问）；非闸机（§§9.5） |
| `context.attention.notify` | 长任务提醒（`ddd-intent`/`ddd-consolidate` 长流程收尾） |
| `context.client.rpc(Ddd)` | 调 server 的 `gates`／`board` |

## 已知约束

- 命令名与 server 命令**不重名**（前缀化，§8.3）。
- 不得依赖宿主 renderable 的内部结构。

## 2.0.0 输入闭环

四问采集通过 `Ddd.intentCapture` RPC 持久落入 `.ddd/state/intent-draft.json`，缺项给出提示；宿主不支持 RPC 时提示失败。避免挂载 `render:()=>null` 的无效 panel，门禁和看板仍经命令/RPC 读取。

## 2.0.0 收尾契约（2026-11-14）

**TUI 显示与显式验收**：保留四问/看板/门禁入口；新增工作流查看与明确选择才运行测试；RPC 不可用时提示而不关闭主命令链。

## 2.0.2 全局集成约束

工作流状态改为调用 overview RPC，展示阶段/技能/门禁/看板，并保留人工确认测试与失败关闭。
