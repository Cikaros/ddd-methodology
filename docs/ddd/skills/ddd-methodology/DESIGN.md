---
doc: design
level: group
target: skills/ddd-methodology
status: frozen
landed: true
updated: 2026-11-11
---

# 分组设计：skills/ddd-methodology（主技能）

## 目录定位与边界

- **职责**：方法论**主技能**——代理发现并载入它的入口；只放**核心流程**，细节拆分到 `references/` 与 `assets/`。
- **边界内**：`SKILL.md` 正文（核心流程）、指向子目录的导航。
- **边界外**：机械可判定的取值（落 `assets/`）；长篇规范（落 `references/`）。

## 目录规划

| 文件/目录 | 一句话职责 |
|---|---|
| `SKILL.md` | 主技能正文：何时用、步骤大纲、注意事项、常见错误 |
| `references/` | 按需加载的规范散件（分组设计见 `references/DESIGN.md`） |

> **配置基线不在此处**：命令注册表、门禁集、规则基线等机械取值是**单点权威**，统一放**顶层 `assets/` 模块**（`docs/ddd/assets/DESIGN.md`），本技能只引用、不复写（M10 反漂移）。

## 渐进式披露

正文控制在「核心流程」；拆分判据：`.md` 超 2000 字或出现「同时/另外/顺便」提示需拆分。

## 依赖方向

只依赖 `docs/GLOSSARY.md` 术语；不依赖实现。

## 状态

`draft`。
