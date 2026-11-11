---
doc: design
level: module
target: assets
status: draft
landed: false
updated: 2026-11-11
---

# 模块设计：assets（随包配置基线）

## 定位与边界

- **职责**：承载**机械可判定的取值**（薄文本 + 资产两态中的「资产」态）。命令注册表、门禁集、记忆阈值等**唯一权威**落此处，正文不复写。
- **边界内**：JSON 配置基线与其派生关系。
- **边界外**：可读散文（在 `skills/**/references/`）；运行期逻辑（在 `src/`）。

## 目录规划（分组层）

`assets/` 为单层目录，无更深分组。

## 基线清单

| 基线 | 承载的事实（唯一权威处） | 消费方 |
|---|---|---|
| `commands.json` | 命令注册表（名称/用途/参数/实现形态） | `src/lib/registry.ts`、`scripts/` |
| `gates.json` | 门禁 G1–G6 的执行者与通过判据 | `src/lib/gates.ts`、`scripts/` |
| `profiles.json` | 预设套餐（Manifest + Profile 的 Profile 面） | `src/index.ts` 的 options |
| `rules.json` | 执行规则基线（落权限配置 / `session.update` / `evaluate` 三态） | `src/index.ts` |
| `memory.json` | 记忆门槛（星级、阈值、衰减率） | 记忆闭环 |
| `variant-contract-schema.json` | **变体契约的字段结构**（五维、`allowedTokenLayer`/`forbiddenCrossEffects`、禁止组合）；**不是**某项目的取值 | 前端技能 `frontend-variant-contract` |
| `injection-slices.json` | **注入切片映射**（`(phase,intent) → sliceIds`） | `src/lib/router.ts` |
| `bottom-lines.json` | **底线清单**（每条含执法点与 remedy） | `src/lib/guard.ts`、`src/index.ts` |
| `languages.json` | **语言目录**（受支持语言清单：id／基线指南／机械键／关联工具）；**不是**某项目的取值 | `skills/lang/**`、`assets/lang-<id>.json` |
| `lang-<id>.json` | 各语言**机械可判取值**（缩进/行宽/引号/严格度等） | 项目 formatter/linter |
| `role-tools.json` | **角色→工具白名单**（Q4 机械强制输入） | `src/lib/guard.ts`、`src/index.ts` |

> **单点权威**：上表每行的事实只在该件写具体值；其余位置一律引用（M10 反漂移）。

## 依赖方向

只被 `src/**` 与 `scripts/**` **只读**消费；不反向依赖任何实现。

## 状态

`draft`。
