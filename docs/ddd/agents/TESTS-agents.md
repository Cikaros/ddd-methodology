---
doc: tests
level: module
target: agents
status: frozen
landed: false
depends: [agents/DESIGN.md]
updated: 2026-11-11
---

# 测试设计：DESIGN.md

## 执行件与前置

- 执行件：待实现（对应 `agents`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| MT-agents-01 | 子件覆盖 | 其下每个设计件均有对应测试件 | 待落地 |
| MT-agents-02 | 跨件对账 | 声明面与实物/引用可解析，单点权威无复写 | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
