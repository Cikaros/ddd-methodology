---
doc: unit-tests
level: file
target: scripts/board.mjs
status: frozen
landed: false
depends: [scripts/DESIGN-board.md]
updated: 2026-11-11
---

# 单元测试设计：scripts/board.mjs

## 执行件与前置

- 执行件：待实现（`scripts/board.mjs`）。
- 前置：`scripts/DESIGN-board.md`、`src/lib/board.ts`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-board-01 | append-only | 只追加不改旧行；状态转移以新行表达 | 待落地 |
| UT-scripts-board-02 | 手改检出 | 非法行/`seq` 非单调 → 退出码非零 | 待落地 |
| UT-scripts-board-03 | 派生一致 | `replay --check` 与 `BOARD.md` 一致，差异即失败 | 待落地 |
| UT-scripts-board-04 | 命令校验 | `add/move/evidence` 非法入参 → 拒写并给 remedy | 待落地 |
| UT-scripts-board-05 | 无归属收口 | `reqId:null` 未 `rehome`/`drop` → 收尾失败 | 待落地 |
| UT-scripts-board-06 | 无看板 | 首次无 `board.jsonl` → 报 `na` 退出 0，不判通过 | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。