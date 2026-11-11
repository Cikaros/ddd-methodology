---
doc: unit-tests
level: file
target: agents/ddd-consolidator.md
status: frozen
landed: false
depends: [agents/DESIGN-ddd-consolidator.md]
updated: 2026-11-11
---

# 单元测试设计：DESIGN-ddd-consolidator.md

## 执行件与前置

- 执行件：待实现（对应 `agents/ddd-consolidator.md`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-agents-ddd-consolidator-01 | frontmatter 合法 | 含 description 与 mode: subagent | 待落地 |
| UT-agents-ddd-consolidator-02 | 输入面受限 | 只读该块产物+变更流切片+冻结契约 | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
