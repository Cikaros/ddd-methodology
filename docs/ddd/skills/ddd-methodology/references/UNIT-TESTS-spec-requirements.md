---
doc: unit-tests
level: file
target: skills/ddd-methodology/references/spec-requirements.md
status: frozen
landed: true
depends: [skills/ddd-methodology/references/DESIGN-spec-requirements.md]
updated: 2026-11-11
---

# 单元测试设计：DESIGN-spec-requirements.md

## 执行件与前置

- 执行件：已实现（对应 `skills/ddd-methodology/references/spec-requirements.md`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-skills-ddd-methodology-references-spec-requirements-01 | frontmatter 合法 | name 与 description 存在 | 已落地 |
| UT-skills-ddd-methodology-references-spec-requirements-02 | 正文合规 | 只放核心流程；机械阈值不在正文 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
