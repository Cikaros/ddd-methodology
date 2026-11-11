---
doc: design
level: file
target: agents/<role>.md
status: frozen
landed: false
covers: [agent-template]
depends: [agents/DESIGN.md]
updated: 2026-11-11
---

# 文件设计：agents/<role>.md（代理统一模板）

## 定位与边界

- **职责**：`agents/` 下每个角色 md 的**统一契约**（frontmatter + 正文结构）；各角色按其生成同构实例。
- **边界内**：契约字段、正文必备节。
- **边界外**：角色清单（`agents/DESIGN.md`，单一权威）；编排（宿主）。

## 对外暴露接口（frontmatter 契约）

| 键 | 取值 | 必填 |
|---|---|---|
| `description` | 一行职责（模型/编排据此识别） | 是 |
| `mode` | 固定 `subagent` | 是 |
| `model` | 可选，`provider/model#variant` | 否 |
| `permissions` | 可选，角色级权限（最小暴露） | 否 |
| `tools` | 可选，允许的工具集 | 否 |

正文必备节：**职责** / **输入面**（只读哪些）/ **输出** / **约束**（不改契约、破坏性动作走守卫）。

## 需引入的依赖

无（纯 Markdown）。

## 调用的模块能力及接口

由宿主 `subagent` 工具按 `mode: subagent` 与 `description` 触发；经 `experimental.subagent_depth` 控嵌套。

## 已知约束

- `mode: subagent`（不得为主代理）。
- 输入面必须**显式受限**（防上下文污染）。
- 权限最小暴露；敏感动作交 `guard`/权限层。
- 角色文件不得复制角色清单（引用 `agents/DESIGN.md`）。