---
doc: design
level: file
target: src/index.ts
status: frozen
landed: true
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
- **F7 骨架生成（`ddd-init`）**：`ddd-init` handler 机械调用 `scripts/scaffold.mjs`（物化随包件 + 落 `docs/` 骨架），而不是只发提示词。
- **Q3 命令→角色派发（默认同会话 + 隔离例外）**：策略读 `assets/commands.json` 的 `dispatch`——
  - `same`（默认，12 条）：在**当前会话**内 `ctx.session.prompt` 注入该角色指令，**不新建会话**；不切该会话的 agent。
  - `isolated`（仅 `ddd-review`／`ddd-validate`／`ddd-consolidate`）：经宿主 `subagent` 工具派发**子会话**（独立交叉评审／独立对账／R44 归并隔离）。
  - 隔离派发不可用时**降级为同会话且读数可见**（不静默降级）。
- **M5 意图确认（§9.5 分职责）**：阻塞节点（概要 §6.1 ▲：`ddd-intent`/`ddd-arch`/`ddd-wrapup`/`ddd-consolidate`）在推进前调用 `ctx.permission.assert` 取**阻塞式确认**（过闸机：可中止/可记忆/远程恒可用）；被拒即中止该步，不静默降级。TUI 侧 `dialog.select/prompt` 只承担**输入采集**（选场景、收四问），与 assert **确认点不重叠**（见 `DESIGN-tui.md`）。
- 技能：`ctx.skill.transform` 注册 `SKILLS`，`path` 取**包根**相对路径。
- RPC：`ctx.rpc.register(Ddd, { gates, board })`。
- hook：`ctx.session.hook("prompt", ...)` **只做意图探测**（写 `ctx.storage` 的 `ddd:intent`），**不改用户消息正文**；纪律与切片经 `ctx.session.instructions.entry.put`（**键控** `ddd.discipline`／`ddd.phase`，渲染 `<context key>`，不占轮次、用户不可见）+ `ctx.session.hook("context", ...)` 注入。
  - **键名约束（宿主）**：`^[a-z0-9][a-z0-9._-]*$`——**不含冒号**（`ddd.discipline` 合法，`ddd:discipline` 会被拒收）。
  - 幂等靠**键控**（同键重复写＝更新/替换），**不再用正文哨兵** `<!--ddd:core-->`。
- **角色工具面强制（Q4）**：`ctx.session.hook("context", ...)` 按 `event.agent` 删除不在 `assets/role-tools.json` 白名单的工具（`delete event.tools[x]`）；同时 `ctx.permission.hook("evaluate", ...)` 做运行时 deny 兜底（fail-safe）。
- **记忆注入与复发统计（M6）**：`ctx.session.hook("context")` 注入 topN + 候选提示；`ctx.tool.hook("execute.before")` 匹配 `trigger` 计 `occur`；`ctx.event.subscribe(["session.deleted"])` 触发 `decay`。
- **看板（M7）**：`/ddd-board list|add|move|evidence|drop|rehome` 由 `COMMANDS` 注册；`ctx.session.hook("context")` 注入看板摘要（待办/进行/阻塞）；`ctx.tool.hook("execute.after")` 自动挂 `evidence`；G6 要求活跃投影为空。
- 返回 cleanup：`dispose` 各 registration。

## 需引入的依赖

- `@opencode/plugin`（宿主）：`Plugin`、`Skill`。
- `./lib/registry.ts`、`./lib/paths.ts`、`./lib/router.ts`、`./lib/guard.ts`、`./lib/memory.ts`、`./lib/board.ts`、`./rpc.ts`。

## 调用的模块能力及接口

| 被调用 | 能力 |
|---|---|
| `ctx.command.transform / ctx.skill.transform` | 注册面编辑（同步回调，返回 `Registration`） |
| `ctx.rpc.register` | 注册 RPC 实现 |
| `ctx.session.hook("prompt")` | 意图探测（写 `ddd:intent`）；**不注入、不改消息正文** |
| `ctx.session.instructions.entry.put` | 纪律/切片**键控**注入（`ddd:discipline`/`ddd:<sliceId>`；渲染 `<context key>`；不占轮次） |
| `ctx.session.prompt` | 命令把内容送进会话（**默认同会话**路径） |
| `ctx.permission.assert` | 阻塞式确认（M5；§9.5 分职责，server 侧） |
| `ctx.session.create` / `ctx.session.switchAgent` | Q3 **隔离例外**子会话派发（仅 review/validate/consolidate） |
| `child_process.spawnSync("node", […])` | 调 `scripts/scaffold.mjs`（F7 骨架生成）；**禁 `process.execPath`**（§8.7/C-43） |
| `ctx.options` | 读 `profile`／`gates`／`paths`（只读一次，裁定 V-02） |

## 已知约束

- transform 回调**必须同步**；不得在回调里 `await`。
- 工具面**只增不移**（裁定 V-01）。
