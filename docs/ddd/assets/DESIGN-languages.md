---
doc: design
level: file
target: assets/languages.json
status: frozen
landed: true
covers: [languages-catalog]
depends: [skills/lang/DESIGN-SKILL-TEMPLATE.md]
updated: 2026-11-11
---

# 文件设计：assets/languages.json（语言目录）

## 定位与边界

- **职责**：受支持语言的**唯一权威清单**——每语言的 id、显示名、基线来源、机械键、关联工具。
- **边界内**：目录数据。
- **边界外**：各语言正文（`skills/lang/<id>/`）；机械取值（`assets/lang-<id>.json`）。

## 对外暴露接口

JSON：`{ "languages": [ { "id", "display", "baseline", "mechanicalKeys", "tools" } ] }`

| 字段 | 含义 |
|---|---|
| `id` | 实例目录名（`html`/`css`/`javascript`/`vue`/`java`/`python`/`shell`/`android`/`sql`/`c`/`cpp`/`nasm`） |
| `baseline` | 基线来源（`google:<guide>` 或 `official:<doc>`，含版本/复核日） |
| `mechanicalKeys` | 该语言的机械键（指向 `lang-<id>.json`） |
| `tools` | 关联工具 id（指向 `skills/dev-tools/references/*`） |

## 需引入的依赖

无。被 `src/lib/router.ts`、`skills/lang/**`、`skills/dev-tools/**` 只读消费。

## 调用的模块能力及接口

router 据此判定检测到的语言 → 注入切片；dev-tools 据此关联工具。

## 已知约束

- **单点权威**：语言清单与基线来源只在此件；族设计件与技能正文引用不复写。

## 2.0.1 修订

该文件现在是 `assets/skills-catalog.json` 的**自动生成兼容投影**，不再是唯一权威。`vue` 与 `android` 在目录中分别归为 framework 与 platform，保留其旧 Skill ID；严格语言条目由目录 category=language 生成。禁止手改投影，运行 `npm run skill-sync` 同步。
