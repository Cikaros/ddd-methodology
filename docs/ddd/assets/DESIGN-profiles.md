---
doc: design
level: file
target: assets/profiles.json
status: frozen
landed: true
covers: [profiles]
updated: 2026-11-11
---

# 文件设计：assets/profiles.json（预设套餐）

## 定位与边界

- **职责**：Manifest + Profile 的 **Profile 面**——预设套餐（模块/门禁的组合），供使用者按需装入。
- **边界内**：套餐名与所含组件/门禁开关。
- **边界外**：装载机制（对接宿主 `plugins` 的 `options`，见 §8.5）。

## 对外暴露接口

JSON：`{ "profiles": { "<name>": { "gates": {...}, "skills": [...] } } }`

| 套餐 | 含义 |
|---|---|
| `minimal` | 只装核心门禁与主技能 |
| `standard` | 缺省：核心 + 四级测试 + 记忆/看板 |
| `strict` | 加执行规则、审批风控 |

## 需引入的依赖

无。被 `src/index.ts` 的 options 消费（`profile` 键）。

## 调用的模块能力及接口

映射到 `opencode.json(c)` 的 `{ "package": "@cikaros/ddd-methodology", "options": { "profile": "<name>" } }`。

## 已知约束

- 套餐取值**单点权威**在此件；`src/index.ts` 只读 `options.profile`，不自带套餐表。
