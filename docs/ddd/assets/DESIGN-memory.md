---
doc: design
level: file
target: assets/memory.json
status: draft
landed: false
covers: [memory-thresholds]
updated: 2026-11-11
---

# 文件设计：assets/memory.json（记忆门槛）

## 定位与边界

- **职责**：记忆闭环（M6）的**门槛与衰减**取值的唯一权威。
- **边界内**：星级门槛、一致率、衰减率、注入条数上限、红线清单。
- **边界外**：记忆行的读写（在 `scripts/` 或运行时）；条目内容（在 `docs/memory/memory.jsonl`）。

## 对外暴露接口

JSON：`{ "remindAt", "promoteAt", "consistency", "decayPerSession", "injectTopN", "redlines": [...] }`

| 键 | 含义 |
|---|---|
| `remindAt` | 达此出现次数开始注入提醒 |
| `promoteAt` | 达此次数且一致率达标转 `candidate` |
| `consistency` | 一致率阈值 |
| `decayPerSession` | 每次会话关闭的降星 |
| `injectTopN` | 每请求注入的条目上限 |
| `redlines` | 三条红线（未跑测试不得宣告完成 / 交付物为空不得宣告完成 / 看板有未落幕项不得宣告收尾） |

## 需引入的依赖

无。

## 调用的模块能力及接口

被记忆闭环与看板闭环只读消费；**不得写死在代码里**（门槛可调）。

## 已知约束

- **门槛可调**：一切阈值读本件，代码不得内置。
