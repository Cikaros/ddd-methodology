---
doc: design
level: file
target: src/tui.tsx
status: frozen
landed: false
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
| `context.ui.dialog.confirm/prompt/select` | 阻塞式确认（「明确意图」的取得确认） |
| `context.attention.notify` | 长任务提醒 |
| `context.client.rpc(Ddd)` | 调 server 的 `gates`／`board` |

## 已知约束

- 命令名与 server 命令**不重名**（前缀化，§8.3）。
- 不得依赖宿主 renderable 的内部结构。
