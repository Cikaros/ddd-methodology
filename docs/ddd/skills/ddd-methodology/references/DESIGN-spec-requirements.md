---
doc: design
level: file
target: skills/ddd-methodology/references/spec-requirements.md
status: frozen
landed: false
covers: [spec-requirements]
updated: 2026-11-11
---

# 文件设计：references/spec-requirements.md（需求规范）

## 定位与边界

- **职责**：需求表述的**判断式**规范——四问、澄清记录结构、冻结判断面。
- **边界内**：语义与结构；判据编号指回权威处。
- **边界外**：类型/状态取值（术语表）、G1 编号与判据（概要设计）。

## 对外暴露接口

Markdown 散文；由主技能/命令按需 `read`。

## 需引入的依赖

无。

## 调用的模块能力及接口

被 `ddd-intent` 命令与主技能引用。

## 已知约束

- 只写**不可机械判定**的语义；可判定者落 `assets/`。
