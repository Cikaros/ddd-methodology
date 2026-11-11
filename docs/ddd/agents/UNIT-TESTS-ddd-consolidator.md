---
doc: unit-tests
level: file
target: agents/ddd-consolidator.md
status: frozen
landed: false
depends: [agents/DESIGN-ddd-consolidator.md]
updated: 2026-11-11
---

# 单元测试设计：agents/ddd-consolidator.md

## 执行件与前置

- 执行件：待实现（`agents/ddd-consolidator.md`）。
- 前置：`agents/DESIGN-ddd-consolidator.md`、`agents/DESIGN-AGENT-TEMPLATE.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-agents-ddd-consolidator-01 | frontmatter 合法 | 含 `description`、`mode: subagent`、目标块写权限 | 待落地 |
| UT-agents-ddd-consolidator-02 | 输入面受限 | 只读该块产物+变更流切片+冻结契约，无全量历史 | 待落地 |
| UT-agents-ddd-consolidator-03 | 不改契约语义 | 归并前后接口签名与 frontmatter 逐字对账通过 | 待落地 |
| UT-agents-ddd-consolidator-04 | 不删变更流 | 归并前后 `CHANGELOG.jsonl` 逐字节不变 | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。