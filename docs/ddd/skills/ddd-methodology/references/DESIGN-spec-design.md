---
doc: design
level: file
target: skills/ddd-methodology/references/spec-design.md
status: frozen
landed: true
covers: [spec-design]
updated: 2026-11-11
---

# 文件设计：references/spec-design.md（设计规范）

## 定位与边界

- **职责**：设计树的**判断式**规范——四级同构语义、frontmatter 用法、声明面与实物对账语义。
- **边界内**：落点与对账的语义；键集取值指回权威。
- **边界外**：键集与取值（概要设计 §5.2）、机械对账实现（`scripts/`）。

## 对外暴露接口

Markdown 散文。

## 需引入的依赖

无。

## 调用的模块能力及接口

被 `ddd-design`／`ddd-review` 命令引用。

## 已知约束

- 「凭空发明」是最重缺陷：签名须与实物逐字对账。
- 只写语义，不写键集具体值。
