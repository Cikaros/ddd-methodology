---
doc: design
level: group
target: skills/lang
status: frozen
landed: false
covers: [lang-family]
depends: [assets/languages.json]
updated: 2026-11-11
---

# 分组设计：skills/lang（语言规范技能族）

## 目录定位与边界

- **职责**：常用语言的**判断式**约定族。每语言一实例目录 `skills/lang/<id>/`，共享同一模板与同一目录资产。
- **边界内**：约定（命名/结构/惯用法/错误处理）、基线引用、项目覆盖说明。
- **边界外**：**机械取值**（缩进/行宽/引号/严格度）落 `assets/lang-<id>.json`；格式化/lint 交宿主。

## 实例目录（`<id>` 取值域）

权威清单在 **`assets/languages.json`**（单点权威，本件不复写具体条目）：

`html`、`css`、`javascript`、`vue`、`java`、`python`、`shell`（`sh`/`zsh`/`bash`/`pwsh`）、`android`、`sql`（`mysql`/`redis`）、`c`、`cpp`、`nasm`

## 同构实例（族设计：为何不逐语言另立完整设计树）

- 每个 `<id>` 目录结构相同：`SKILL.md` + `references/{google-style,project-overrides}.md`。
- 因此**族设计件 + `assets/languages.json` 覆盖全部语言**；逐语言另立完整设计树是**同构冗余**，违反单点权威（M10）。新增语言＝在 `languages.json` 加一条 + 生成同构实例，**不改族设计**。

## 载入方式

**不常驻**：router 检测到某语言时经 `assets/injection-slices.json` 注入该语言的切片（R62）。

## 状态

`draft`。