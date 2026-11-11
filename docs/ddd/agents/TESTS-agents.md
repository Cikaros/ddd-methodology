---
doc: tests
level: module
target: agents
status: draft
landed: false
depends: [agents/DESIGN.md]
updated: 2026-11-11
---

# 测试设计：agents（模块级）

## 执行件与前置

- 执行件：待实现（`agents/` 模块）。
- 前置：`agents/DESIGN.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| MT-agents-01 | 角色清单齐备 | 清单中每个角色在实现时都有 `agents/<role>.md` | 待落地 |
| MT-agents-02 | 角色契约一致 | 每个角色 frontmatter 含 `description`+`mode: subagent` | 待落地 |
| MT-agents-03 | 命令→角色可读 | 每个命令能对应到一个角色（md `agent:` 或 handler 派发） | 待落地 |
| MT-agents-04 | 权限最小暴露 | 只读角色（reviewer/auditor）未声明写权限 | 待落地 |
| MT-agents-05 | 嵌套深度 | 派发遵循 `subagent_depth`（默认 1，子代理不再派子代理） | 待落地 |
| MT-agents-06 | 子件覆盖 | 其下每个文件级设计均有对应 `UNIT-TESTS-*` | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。