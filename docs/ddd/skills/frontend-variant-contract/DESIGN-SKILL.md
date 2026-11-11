---
doc: design
level: file
target: skills/frontend-variant-contract/SKILL.md
status: draft
landed: false
covers: [frontend-variant-skill]
updated: 2026-11-11
---

# 文件设计：skills/frontend-variant-contract/SKILL.md

## 定位与边界

- **职责**：变体契约奠基的**五步流程**正文与反模式。
- **边界内**：枚举维度、影响范围、固化契约、入口唯一、审计。
- **边界外**：字段结构（schema 资产）；项目取值（项目件）。

## 对外暴露接口

- frontmatter：`name`、`description`。
- 正文：五步 + 反模式 + 导航。

## 需引入的依赖

无。引用 `assets/variant-contract-schema.json`。

## 调用的模块能力及接口

经 router 注入；全文按需 `read`。

## 已知约束

- **默认建议非硬法则**：总维度 ≤3、强调色/圆角各 ≤2；超限附代价。
- 只写判断式；机械契约值写项目 `docs/variant-contract.json`。