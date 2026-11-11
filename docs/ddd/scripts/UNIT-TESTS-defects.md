---
doc: unit-tests
level: file
target: scripts/defects.mjs
status: frozen
landed: true
depends: [scripts/DESIGN-defects.md]
updated: 2026-11-11
---

# 单元测试设计：scripts/defects.mjs

## 执行件与前置

- 执行件：已实现（`scripts/defects.mjs`）。
- 前置：`scripts/DESIGN-defects.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-defects-01 | 行契约 | `add` 赋 `DEF-####`，含 severity/status | 已落地 |
| UT-scripts-defects-02 | append-only + 手改检出 | 只追加；非法行 `check` 退出 1 | 已落地 |
| UT-scripts-defects-03 | 重放一致 | `known-issues.md` 与重放一致 | 已落地 |
| UT-scripts-defects-04 | 唯一权威处 | 登记册为唯一处（散落他处即违规） | 已落地 |
| UT-scripts-defects-05 | 零 FAIL ≠ 零缺陷 | 有 open 缺陷时仍可无 FAIL，两读数可分 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
