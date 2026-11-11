---
doc: design
level: file
target: scripts/change.mjs
status: frozen
landed: true
covers: [changelog-writer]
depends: [src/lib/paths.ts]
updated: 2026-11-11
---

# 文件设计：scripts/change.mjs（变更流唯一写入器 · M2）

## 定位与边界

- **职责**：`docs/CHANGELOG.jsonl` 的**唯一写入器**（append-only）＋人读件 `docs/CHANGELOG.md` 的**重放**；禁手改（手改可机械检出）。
- **边界内**：`add` / `replay` / `check`。
- **边界外**：三字段语义（`skills/ddd-methodology/references/spec-change.md`）；版本落点校验（`scripts/validate.mjs`）。

## 对外暴露接口

`node scripts/change.mjs <sub> [args] [--root <项目根>]`
- `add --rationale <why> --out-of-scope <x> --expected-signal <y> [--type <t>] [--version <v>] [--docs <a,b>]`
- `replay`（由 jsonl 重放生成 `docs/CHANGELOG.md`）
- `check`（核对 jsonl 每行必备字段；`CHANGELOG.md` 与重放一致）

退出码：`0` 过；`1` 失败（缺必备字段/手改检出/派生不一致）；`2` 用法错。

**行契约**（必备三字段）：`id` / `ts` / `version` / `type` / `docs` / **`rationale`** / **`outOfScope`** / **`expectedSignal`**。

## 需引入的依赖

- Node 标准库。**不**依赖模型。

## 调用的模块能力及接口

- 被 `/ddd-change` 命令与 `ddd-consolidator`（写 `type: docs` 归并记录）调用。
- 供 `scripts/validate.mjs` 读版本落点（G6）。

## 已知约束（关键）

- **append-only**：只追加不改旧行；`id`/`ts` 由写入器赋。
- **禁手改**：`docs/CHANGELOG.jsonl` 的写操作由 `assets/bottom-lines.json` 的 `BL-consolidate-no-delete` 声明为 `permission deny`（**除本唯一工具**）；本件即该「唯一工具」。
- **人读件由重放得**：`docs/CHANGELOG.md` 禁手写。
- **不得回写已发布版本组**（版本三处纪律，§十一）。
- 路径取项目根（写入使用者项目件）；工具自身以 `node` 具名启动、取包根（§8.7）。

## 状态

本件为 `frozen`；与实物（`scripts/`）对账一致。
