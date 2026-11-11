---
doc: design
level: file
target: assets/variant-contract-schema.json
status: frozen
landed: false
covers: [variant-contract-schema]
updated: 2026-11-11
---

# 文件设计：assets/variant-contract-schema.json

## 定位与边界

- **职责**：变体契约的**字段结构**（五维、`allowedTokenLayer`、`forbiddenCrossEffects`、禁止组合）的唯一权威；**不是**某项目的取值。
- **边界内**：schema 结构。
- **边界外**：项目取值（`docs/variant-contract.json`）。

## 对外暴露接口

JSON Schema：`dimensions`（主题/品牌/密度/强调色/圆角）、每维 `enum`/`allowedTokenLayer`/`forbiddenCrossEffects`、`forbiddenCombinations`。

## 需引入的依赖

无。被前端技能与变体审计门禁消费。

## 调用的模块能力及接口

技能生成项目契约时按本 schema 校验；审计按本 schema 判非法值。

## 已知约束

- **单点权威**：字段结构只在此件；技能正文与项目契约引用不复写。
- token 层级（Primitive/Semantic/Component）仅作前端内部知识，不上升为 ddd 机制。