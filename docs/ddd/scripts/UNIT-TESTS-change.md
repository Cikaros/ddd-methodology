---
doc: unit-tests
level: file
target: scripts/change.mjs
status: frozen
landed: true
depends: [scripts/DESIGN-change.md]
updated: 2026-11-11
---

# 单元测试设计：scripts/change.mjs

## 执行件与前置

- 执行件：已实现（`scripts/change.mjs`）。
- 前置：`scripts/DESIGN-change.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-change-01 | 三字段必填 | 缺 `rationale`/`outOfScope`/`expectedSignal` 任一 → 拒写，退出 1 | 已落地 |
| UT-scripts-change-02 | append-only | 只追加不改旧行 | 已落地 |
| UT-scripts-change-03 | 手改检出 | 非法行/字段缺失 → `check` 退出 1 | 已落地 |
| UT-scripts-change-04 | 重放一致 | `CHANGELOG.md` 与重放一致，差异即失败 | 已落地 |
| UT-scripts-change-05 | 版本不回写 | 已发布版本组不得回写（校验版本位） | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
