---
doc: unit-tests
level: file
target: scripts/validate.mjs
status: frozen
landed: true
depends: [scripts/DESIGN-validate.md]
updated: 2026-11-11
---

# 单元测试设计：scripts/validate.mjs

## 执行件与前置

- 执行件：已实现（`scripts/validate.mjs`）。
- 前置：`scripts/DESIGN-validate.md`、`src/lib/gates.ts`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-validate-01 | 读数形态 | 产出六条 `GateReading` + `summary` + `canAdvance` | 已落地 |
| UT-scripts-validate-02 | na ≠ pass | 判定对象缺失报 `na`，绝不判 `pass` | 已落地 |
| UT-scripts-validate-03 | block 带 remedy | 每条 `block`/`visible` 带补救指令 | 已落地 |
| UT-scripts-validate-04 | 退出码 | 有 `block` 退 1；无退 0；用法错退 2 | 已落地 |
| UT-scripts-validate-05 | G6 含缺陷册 | G6 核缺陷登记册存在且为唯一处（R36） | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
