---
doc: design
level: file
target: src/rpc.ts
status: frozen
landed: true
covers: [Rpc.define, Ddd]
updated: 2026-11-11
---

# 文件设计：src/rpc.ts（RPC 契约）

## 定位与边界

- **职责**：定义 server ↔ tui／外部客户端的**类型化契约**。**只放 `Rpc.define`，不含实现**。
- **边界内**：方法（`gates`、`board`）与事件（`refreshed`）的 schema。
- **边界外**：方法实现（在 `src/index.ts` 的 `ctx.rpc.register`）；调用方（tui、外部 HTTP）。

## 对外暴露接口

| 导出 | 形态 | 说明 |
|---|---|---|
| `Ddd` | `Rpc.define({ id:"ddd", methods, events })` | 契约常量 |
| `DddContract` | `typeof Ddd` | 契约类型 |

**方法与事件**：

| 名 | 形态 | 输入 | 输出 |
|---|---|---|---|
| `gates` | method | `{}` | `{ readings: [] }` |
| `board` | method | `{}` | `{ pending, inProgress, blocked }` |
| `refreshed` | event | — | `{ gate, verdict }`（object） |

## 需引入的依赖

- `@opencode/plugin/rpc`（宿主）：`Rpc`。

## 调用的模块能力及接口

不调用任何运行期能力（纯契约）。被 `src/index.ts`（实现）与 tui/外部（调用）只读导入。

## 已知约束

- **契约与实现分离**：本件可被他人 `import` 而不加载实现（§8.4）。
- 事件数据**必须是 object**；`id` 为命名空间（前缀 `rpc.ddd.*`）。
- 外部客户端可直连 `POST /api/rpc/ddd/{method}`；**入参须服务端校验**，不能只靠 TS 类型。

## 2.0.0 RPC 扩展

`intentCapture` 校验 scenario 四问数据，将其作为可恢复的输入草稿保存，不代替冻结后的 `docs/REQUIREMENTS.md` 或阻塞式 `permission.assert`。`gates` 与 CLI 共用同一评价器，`board` 严格读取完整历史。

## 2.0.0 收尾契约（2026-11-14）

**RPC 读写契约**：原 gates/board/intentCapture 保持；新增 workflow 状态、需 confirmed 的 workflowVerify 和 workflowClose；所有入参服务端再次校验。

## 2.0.2 全局集成约束

新增 overview RPC，把 workflow、Skills、G1–G6 与 board 的实时读数统一暴露给 TUI；原方法保持兼容。
