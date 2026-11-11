---
doc: design
level: file
target: scripts/materialize.mjs
status: frozen
landed: true
covers: [materialize]
depends: [src/lib/paths.ts]
updated: 2026-11-11
---

# 文件设计：scripts/materialize.mjs（随包件物化 · F5）

## 定位与边界

- **职责**：把**随包件**（`agents/*.md`、静态 md 命令）**物化**到使用者项目的 `.opencode/` 下，使宿主能**发现**它们（**真跑证据**：宿主只从 `.opencode/agents/`、`.opencode/commands/` 发现；插件 `AgentEditor` **无 `add`**，无法注册 agent）。
- **边界内**：读随包目录（取**包根**）、写项目 `.opencode/`（取**项目根**）；幂等。
- **边界外**：角色定义内容（在 `agents/`）；宿主发现机制。

## 对外暴露接口

`node scripts/materialize.mjs <sub> [--root <项目根>]`
- `agents` — 把 `agents/*.md` → `<项目根>/.opencode/agents/`
- `commands` — 把随包静态命令（若存在 `commands/*.md`） → `.opencode/commands/`
- `all` — 上述二者
退出码：`0` 过；`1` 失败（包根缺件/写失败）；`2` 用法错。

## 需引入的依赖

- Node 标准库（`node:fs`、`node:path`、`node:url`）。

## 调用的模块能力及接口

- 由 `/ddd-init`（骨架生成）与 `/ddd-implement` 前置调用；供 `setup` 的「随包上下文（角色清单）」核对。
- **包根/项目根分离**：随包件取包根，落点取项目根（§8.7）——不得混用。

## 已知约束（关键）

- **幂等**：已存在且内容相同则跳过；内容不同则覆盖并报差异（不静默）。
- **不得以宿主进程身份启动**；工具路径取包根（§8.7）。
- **只写 `.opencode/**`**，不碰 `docs/**` 与其它。
- 真跑证据：宿主 `AgentEditor` 无 `add`，故「物化到 `.opencode/agents/`」是角色可被发现的**唯一途径**（F5 的直接修复）。

## 状态

本件为 `frozen`；与实物（`scripts/`）对账一致。
