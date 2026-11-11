---
doc: unit-tests
level: file
target: scripts/map.mjs
status: frozen
landed: true
depends: [scripts/DESIGN-map.md]
updated: 2026-11-11
---

# 单元测试设计：scripts/map.mjs

## 执行件与前置

- 执行件：已实现（`scripts/map.mjs`）。
- 前置：`scripts/DESIGN-map.md`、`scripts/snapshot.mjs`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-map-01 | 重放产出 | 由 `maps.json` + 快照产出 `MAPS.md` | 已落地 |
| UT-scripts-map-02 | 重放一致 | 同输入恒得同一图；`check` 检出差异 | 已落地 |
| UT-scripts-map-03 | 产图者不宣判 | 不得输出缺陷判定（只产图与巡检引用面） | 已落地 |
| UT-scripts-map-04 | 引用面可解析 | 悬空引用 → 失败（R20 判据④） | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
