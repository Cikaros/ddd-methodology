---
doc: design
level: file
target: skills/lang/<id>/SKILL.md
status: frozen
landed: true
covers: [lang-skill-template]
depends: [assets/lang-<id>.json]
updated: 2026-11-11
---

# 文件设计：skills/lang/<id>/SKILL.md（语言技能模板）

## 定位与边界

- **职责**：`skills/lang/<id>/SKILL.md` 的**统一模板**（每语言按其生成同构实例）。
- **边界内**：何时载入＋核心约定＋导航。
- **边界外**：具体阈值（`assets/lang-<id>.json`）；上游指南全文（引用）。

## 对外暴露接口

- frontmatter：`name`、`description`（路由/模型据此识别语言）。
- 正文：Markdown。

## 需引入的依赖

无。

## 调用的模块能力及接口

经 router 注入；全文按需 `read`。

## 已知约束

- **正文不写具体阈值**——读 `assets/lang-<id>.json`。
- 基线来源在 `assets/languages.json` 声明（Google 优先；无对应用官方/事实标准）。
- 模板须薄：全文拆到 `references/`。

## 2.0.1 补充契约

语言 Skills 不再由 `injection-slices.json` 硬编码注入；通过 `assets/skills-catalog.json` 提供信号与来源，宿主 `skill` 工具按 ID 按需载入正文。新 Skills 存放 `skills/lang/<id>/`，框架/数据库/工具按各自目录分类。旧 Vue 与 Android 路径暂不迁移，以保持 ID 和用户已有资源兼容。
