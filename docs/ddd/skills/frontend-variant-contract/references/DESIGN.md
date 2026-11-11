---
doc: design
level: group
target: skills/frontend-variant-contract/references
status: draft
landed: false
covers: [frontend-variant-references]
updated: 2026-11-11
---

# 分组设计：skills/frontend-variant-contract/references

## 目录定位与边界

- **职责**：五步流程的细化散件（按需加载）。
- **边界内**：维度表、影响范围表、审计两类失败与 remedy。
- **边界外**：schema 结构（assets）；项目取值。

## 目录规划

| 文件 | 一句话职责 |
|---|---|
| `spec-dimensions.md` | 五维标准枚举与"30 秒说不出场景即封死"的判据 |
| `spec-impact-scope.md` | token 层级与 `forbiddenCrossEffects`（仅作前端内部知识） |
| `spec-single-entry.md` | 变体入口唯一：仅 shell；组件不接风格发明参数 |
| `spec-audit.md` | 审计两类失败（token 值违规 / 变体契约违规）与 remedy |

## 依赖方向

只引用 schema 与术语表。

## 状态

`draft`。