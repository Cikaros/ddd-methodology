---
doc: design
level: file
target: scripts/defects.mjs
status: frozen
landed: true
covers: [defect-register]
depends: [src/lib/paths.ts]
updated: 2026-11-11
---

# 文件设计：scripts/defects.mjs（缺陷登记册唯一写入器 · R36）

## 定位与边界

- **职责**：`docs/defects.jsonl`（缺陷登记册，**唯一权威处**）的**唯一写入器**（append-only，禁手改）；并**重放**人读件 `docs/reports/known-issues.md`。
- **边界内**：`add` / `resolve` / `replay` / `check`。
- **边界外**：缺陷的**判定**（审计/评审）；缺陷的修复。

## 对外暴露接口

`node scripts/defects.mjs <sub> [args] [--root <项目根>]`
- `add --title <t> --severity <high|med|low> [--area <a>] [--ref <file>]`
- `resolve --id <DEF-####> [--note <n>]`
- `replay`（重放 `docs/reports/known-issues.md`）
- `check`（行合法 + 派生一致）

退出码：`0` 过；`1` 失败（缺字段/手改检出/派生不一致）；`2` 用法错。

**行契约**：`id`（`DEF-####`）/ `ts` / `status`（`open`|`resolved`）/ `severity` / `title` / `area?` / `ref?` / `note?`。

## 需引入的依赖

- Node 标准库。**不**依赖模型。

## 调用的模块能力及接口

- 被审计/评审在登记发现时调用；被 `scripts/validate.mjs` 的 G6 核「登记册存在且为唯一处」。

## 已知约束（关键）

- **「缺陷已全部登记」是交付判据本身**（R36）：登记册是**唯一权威处**；散落他处的缺陷记录视为违规。
- **append-only、禁手改**；人读件由重放得，禁手写。
- **区分「零 FAIL」与「零缺陷」**：本件登记缺陷，不等于门禁 FAIL。
- 固定位置：`docs/defects.jsonl`（R11 所要求的「缺陷登记」，补 §4.2 表未列之项）。
- 路径：登记册写项目根；工具取包根（§8.7）。

## 状态

本件为 `frozen`；与实物（`scripts/`）对账一致。
