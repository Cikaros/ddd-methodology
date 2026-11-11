---
doc: design
level: file
target: skills/ddd-methodology/references/spec-test.md
status: frozen
landed: true
covers: [spec-test]
updated: 2026-11-11
---

# 文件设计：references/spec-test.md（测试规范）

## 定位与边界

- **职责**：测试用例的**判断式**规范——合格形态、编号唯一、落地凭据、期望值须人工校对面。
- **边界内**：语义。
- **边界外**：编号规则与落地判据编号（概要设计/用例清单）。

## 对外暴露接口

Markdown 散文。

## 需引入的依赖

无。

## 调用的模块能力及接口

被 `ddd-test-design`／`ddd-test` 命令引用。

## 已知约束

- 「声明即有执行面」；未落地报「待落地」而非「缺陷」。
