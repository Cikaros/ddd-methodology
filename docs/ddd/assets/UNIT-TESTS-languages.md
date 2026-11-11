---
doc: unit-tests
level: file
target: assets/languages.json
status: frozen
landed: true
depends: [assets/DESIGN-languages.md]
updated: 2026-11-11
---

# 单元测试设计：DESIGN-languages.md

## 执行件与前置

- 执行件：已实现（对应 `assets/languages.json`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-assets-languages-01 | schema 合法 | 可被 JSON 解析且键集齐全 | 已落地 |
| UT-assets-languages-02 | 单点权威 | 具体值只在本件；消费方引用不复写 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
