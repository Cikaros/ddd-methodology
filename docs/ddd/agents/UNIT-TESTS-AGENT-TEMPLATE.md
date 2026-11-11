---
doc: unit-tests
level: file
target: agents/<role>.md
status: frozen
landed: false
depends: [agents/DESIGN-AGENT-TEMPLATE.md]
updated: 2026-11-11
---

# 单元测试设计：agents/DESIGN-AGENT-TEMPLATE.md

## 执行件与前置

- 执行件：待实现（各角色 md 的契约校验）。
- 前置：`agents/DESIGN-AGENT-TEMPLATE.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-agents-AGENT-TEMPLATE-01 | frontmatter 合法 | 含 `description`、`mode: subagent` | 待落地 |
| UT-agents-AGENT-TEMPLATE-02 | 正文必备节齐全 | 含 职责/输入面/输出/约束 四节 | 待落地 |
| UT-agents-AGENT-TEMPLATE-03 | 角色清单一致 | `agents/DESIGN.md` 每角色有对应实例且 frontmatter 合法 | 待落地 |
| UT-agents-AGENT-TEMPLATE-04 | 输入面受限 | 每角色显式声明只读件；无"全量历史"表述 | 待落地 |
| UT-agents-AGENT-TEMPLATE-05 | 权限最小暴露 | 只读角色不声明写权限；破坏性动作指向守卫层 | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。