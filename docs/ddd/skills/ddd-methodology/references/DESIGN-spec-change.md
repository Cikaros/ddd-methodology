---
doc: design
level: file
target: skills/ddd-methodology/references/spec-change.md
status: frozen
landed: true
covers: [spec-change]
updated: 2026-11-11
---

# 文件设计：references/spec-change.md（变更规范）

## 定位与边界

- **职责**：变更流的**判断式**语义——三字段（为什么做／本次不做／怎么算做对）、版本与收尾纪律、**冻结即归并**的口径。
- **边界内**：语义。
- **边界外**：行契约字段的机械校验（`scripts/`）；版本号取值（术语表）。

## 对外暴露接口

Markdown 散文。

## 需引入的依赖

无。

## 调用的模块能力及接口

被 `ddd-change`／`ddd-wrapup`／`ddd-consolidate` 命令引用。

## 已知约束

- 归并**只删产物内联痕迹，不删权威变更流**。
- 不得回写已发布版本组。
