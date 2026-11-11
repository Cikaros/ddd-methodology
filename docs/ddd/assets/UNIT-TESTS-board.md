---
doc: unit-tests
level: file
target: assets/board.json
status: frozen
landed: false
depends: [assets/DESIGN-board.md]
updated: 2026-11-11
---

# 单元测试设计：assets/board.json

## 执行件与前置

- 执行件：待实现（看板配置基线校验）。
- 前置：`assets/DESIGN-board.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-assets-board-01 | schema 合法 | JSON 可解析，键集齐全（priorityDomain/statusDomain/starvation*/orphanHours/maxLineBytes） | 待落地 |
| UT-assets-board-02 | 阈值唯一权威 | 代码与脚本不内置阈值，均读本件 | 待落地 |
| UT-assets-board-03 | 取值域 | `defaultPriority` ∈ `priorityDomain`；`statusDomain` 与合法转移一致 | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。