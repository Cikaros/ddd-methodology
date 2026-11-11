---
doc: design
level: file
target: src/index.ts
status: draft
landed: false
covers: [Plugin.define, setup]
depends: [src/lib/registry.ts, src/lib/paths.ts, src/rpc.ts]
updated: 2026-11-11
---

# 文件设计：src/index.ts（server part 入口）

## 定位与边界

- **职责**：server part 入口。`Plugin.define({ id: "ddd", setup })`；在 `setup` 中注册四类注册口、挂 hooks、注册 RPC，并返回 cleanup。
- **边界内**：装配与注册；options 读取（**只读一次**）。
- **边界外**：清单内容（`src/lib/registry.ts`）、判据逻辑（`src/lib/gates.ts`）、契约定义（`src/rpc.ts`）。

## 对外暴露接口

| 导出 | 形态 | 说明 |
|---|---|---|
| `default` | `Plugin` | `{ id: "ddd", setup(ctx) }`；宿主 server part 入口 |

**`setup(ctx)` 行为契约**：

- 命令：遍历 `COMMANDS`，逐个 `ctx.command.transform(editor => editor.add({name, description, execute}))`（§8.3，核心命令由 server 提供）。
- 技能：`ctx.skill.transform` 注册 `SKILLS`，`path` 取**包根**相对路径。
- RPC：`ctx.rpc.register(Ddd, { gates, board })`。
- hook：`ctx.session.hook("prompt", ...)` 注入随包上下文，**幂等**（以标记串判重，§9.3）。
- **角色工具面强制（Q4）**：`ctx.session.hook("context", ...)` 按 `event.agent` 删除不在 `assets/role-tools.json` 白名单的工具（`delete event.tools[x]`）；同时 `ctx.permission.hook("evaluate", ...)` 做运行时 deny 兜底（fail-safe）。
- **记忆注入与复发统计（M6）**：`ctx.session.hook("context")` 注入 topN + 候选提示；`ctx.tool.hook("execute.before")` 匹配 `trigger` 计 `occur`；`ctx.event.subscribe(["session.deleted"])` 触发 `decay`。
- 返回 cleanup：`dispose` 各 registration。

## 需引入的依赖

- `@opencode/plugin`（宿主）：`Plugin`、`Skill`。
- `./lib/registry.ts`、`./lib/paths.ts`、`./lib/router.ts`、`./lib/guard.ts`、`./lib/memory.ts`、`./rpc.ts`。

## 调用的模块能力及接口

| 被调用 | 能力 |
|---|---|
| `ctx.command.transform / ctx.skill.transform` | 注册面编辑（同步回调，返回 `Registration`） |
| `ctx.rpc.register` | 注册 RPC 实现 |
| `ctx.session.hook("prompt")` | 准入注入（幂等） |
| `ctx.session.prompt` | 命令把内容送进会话 |
| `ctx.options` | 读 `profile`／`gates`／`paths`（只读一次，裁定 V-02） |

## 已知约束

- transform 回调**必须同步**；不得在回调里 `await`。
- 工具面**只增不移**（裁定 V-01）。
