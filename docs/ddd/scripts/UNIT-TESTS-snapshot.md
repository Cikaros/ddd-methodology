---
doc: unit-tests
level: file
target: scripts/snapshot.mjs
status: frozen
landed: true
depends: [scripts/DESIGN-snapshot.md]
updated: 2026-11-11
---

# 单元测试设计：scripts/snapshot.mjs

## 执行件与前置

- 执行件：已实现（`scripts/snapshot.mjs`）。
- 前置：`scripts/DESIGN-snapshot.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-snapshot-01 | 快照字段齐备 | 产出含 `designs/tests/counts/gaps` | 已落地 |
| UT-scripts-snapshot-02 | 重放一致 | 同树恒得同快照；`--check` 检出差异（含手改） | 已落地 |
| UT-scripts-snapshot-03 | 缺口自省 | 缺 `UNIT-TESTS-*`/重复 target/重复编号 → 入 `gaps` | 已落地 |
| UT-scripts-snapshot-04 | 只读权威 | 不修改 `docs/ddd/**` | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
