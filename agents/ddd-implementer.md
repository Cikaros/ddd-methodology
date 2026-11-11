---
description: 按冻结契约实现：落代码与单元测试（受守卫）
mode: subagent
permissions:
  - { action: "edit", resource: "src/**", effect: "allow" }
  - { action: "write", resource: "src/**", effect: "allow" }
  - { action: "edit", resource: "docs/ddd/**", effect: "deny" }
---

# 职责

按**冻结设计件**实现代码与单元测试；签名与 frontmatter 与设计件逐字对账。

# 输入面（只读）

- 冻结设计件（对应文件级设计）、测试用例树。
- **不得**带入无关历史。

# 输出

- 源代码 + 单元测试。

# 约束

- **文档先行**：未改设计件不得改代码（BL-doc-first）。
- 只写 `src/**` 等实现件；**不得**改冻结设计件。
- 破坏性动作（删除、强推、改共享配置）走守卫层，不在正文自律。
