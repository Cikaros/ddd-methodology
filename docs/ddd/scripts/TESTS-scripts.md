---
doc: tests
level: module
target: scripts
status: frozen
landed: true
depends: [scripts/DESIGN.md]
updated: 2026-11-11
---

# 测试设计：DESIGN.md

## 执行件与前置

- 执行件：已实现（对应 `scripts`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| MT-scripts-01 | 子件覆盖 | 其下每个设计件均有对应测试件 | 已落地 |
| MT-scripts-02 | 跨件对账 | 声明面与实物/引用可解析，单点权威无复写 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
