---
doc: design
level: file
target: skills/dev-tools/SKILL.md
status: draft
landed: false
covers: [skill]
updated: 2026-11-11
---

# 文件设计：skills/dev-tools/SKILL.md

## 定位与边界

- **职责**：常用开发工具使用规范的**核心约定**与导航。
- **边界内**：跨工具通用约定：提交粒度、分支策略、验证前置、破坏性命令的处置。
- **边界外**：单工具细节（references）；工具机械默认值。

## 对外暴露接口

- frontmatter：`name`、`description`。
- 正文：Markdown。

## 需引入的依赖

无。

## 调用的模块能力及接口

经 router 注入；全文按需 `read`。

## 已知约束

- 只写**用法与判断**，不复制工具默认值。
- 破坏性命令（`git push --force`、`rm -rf` 等）的处置须指向守卫层（宿主权限/扫描器），不靠正文自律。