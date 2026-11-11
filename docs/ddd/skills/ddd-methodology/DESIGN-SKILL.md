---
doc: design
level: file
target: skills/ddd-methodology/SKILL.md
status: frozen
landed: true
covers: [skill]
updated: 2026-11-11
---

# 文件设计：skills/ddd-methodology/SKILL.md（主技能正文）

## 定位与边界

- **职责**：方法论主技能的**核心流程**正文；代理发现并载入它的入口。
- **边界内**：何时用、步骤大纲、注意事项、常见错误、导航到 `references/`。
- **边界外**：取值（落 `assets/`）；长篇规范（落 `references/`）。

## 对外暴露接口

- frontmatter：`name`、`description`（模型据此判断是否载入；无 `description` 则不被广告）。
- 正文：Markdown。

## 需引入的依赖

无（纯 Markdown）。

## 调用的模块能力及接口

由宿主 `skill` 工具按 ID `ddd-methodology` 载入；正文按需 `read`。

## 已知约束

- 正文只放**核心流程**；超 2000 字或出现「同时/另外/顺便」即须拆分。
- 机械可判定的条目**不写进正文**，落 `assets/`（§三.7）。
