---
doc: unit-tests
level: file
target: scripts/scaffold.mjs
status: frozen
landed: true
depends: [scripts/DESIGN-scaffold.md]
updated: 2026-11-11
---

# 单元测试设计：scripts/scaffold.mjs

## 执行件与前置

- 执行件：已实现（`scripts/scaffold.mjs`）。
- 前置：`scripts/DESIGN-scaffold.md`、`scripts/materialize.mjs`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-scaffold-01 | 骨架落点齐备 | 三件根文档 + `docs/` 固定位置清单齐备 | 已落地 |
| UT-scripts-scaffold-02 | 幂等 | 二次运行不覆盖既有件（一致则跳过） | 已落地 |
| UT-scripts-scaffold-03 | 根文档白名单 | 已存在第四件文档 → 报错（R12） | 已落地 |
| UT-scripts-scaffold-04 | 物化联动 | 生成时调 `materialize.mjs`，`.opencode/agents/` 齐备 | 已落地 |
| UT-scripts-scaffold-05 | 不写业务 | 只落骨架与占位，不写业务代码 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
