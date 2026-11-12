---
doc: unit-tests
level: file
target: scripts/report-io.mjs
status: frozen
landed: true
depends: [scripts/DESIGN-report-io.md]
updated: 2026-11-12
---

# 单元测试设计：scripts/report-io.mjs

## 执行件与前置

- 执行件：已实现（`scripts/report-io.mjs`）。
- 前置：`scripts/DESIGN-report-io.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-report-io-01 | 首写落盘 | 目标不存在 → 写盘，返回 true | 已落地 |
| UT-scripts-report-io-02 | 内容不变保留 ts | 再次写同内容（ts 不同）→ 文件不变、旧 ts 保留、返回 false | 已落地 |
| UT-scripts-report-io-03 | 内容变化更新 | 实质字段变化 → 落盘且 ts 更新，返回 true | 已落地 |
| UT-scripts-report-io-04 | 文本幂等 | `writeReportText` 同内容不落盘 | 已落地 |
| UT-scripts-report-io-05 | 可复算 | 同一输入连跑两次 → 文件逐字节相同 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
