---
doc: design
level: module
target: skills
status: frozen
landed: false
updated: 2026-11-11
---

# 模块设计：skills（知识层 · 随包技能）

## 定位与边界

- **职责**：知识层载体。技能是**按需加载**的结构化目录，代理据描述判断何时载入。
- **边界内**：技能正文（核心流程）与 `references/` 配套散件。
- **边界外**：机械可判定的**取值**不写进正文，落**顶层 `assets/` 模块**的配置基线（薄文本 + 资产两态）。

## 目录规划（分组层）

| 分组 | 路径 | 职责 |
|---|---|---|
| 主技能 | `skills/ddd-methodology/` | 方法论主技能 |
| 参考资料 | `skills/ddd-methodology/references/` | 按需加载的规范散件（需求/设计/测试/变更/规则） |
| 前端通用技能 | `skills/frontend-variant-contract/` | 变体契约奠基（第 0 步）：UI 生成前枚举合法变化空间 |
| 语言规范族 | `skills/lang/<id>/` | 各语言约定（同构实例）；目录在 `assets/languages.json`；机械值落 `assets/lang-<id>.json` |
| 工具规范 | `skills/dev-tools/` | 常用开发工具用法与判断（git/包管理器/格式化/测试/CI/容器/shell） |

> **配置基线不在此模块**：命令注册表、门禁集、规则基线等机械取值是**单点权威**，统一放顶层 `assets/` 模块（`docs/ddd/assets/DESIGN.md`），本模块只引用、不复写（M10 反漂移）。

## 渐进式披露（三层）

① 元数据层（`name` + 一行 `description`，始终加载）；② 说明层（`SKILL.md` 正文，按需 `read`）；③ 资源层（`references/`、脚本，执行时加载）。宿主每步只列 ID+名称+描述，正文经 `skill` 工具按需载入。

## 依赖方向

只依赖 `docs/GLOSSARY.md` 的术语与命令注册表；不依赖 `src/**` 实现。

## 状态

`draft`。
