---
doc: design
level: file
target: assets/gates.json
status: frozen
landed: true
covers: [gates]
depends: [src/lib/gates.ts]
updated: 2026-11-11
---

# 文件设计：assets/gates.json（门禁集）

## 定位与边界

- **职责**：门禁 G1–G6 的**执行者**与**通过判据**取值的唯一权威（判据的**散文语义**在概要设计 §6.2，本件承载**可机械读的结构**）。
- **边界内**：**对接规范七字段 ＋ `ext`**（R28/裁决 3a）：门禁 id、判面、执行者、读数形态、完成判据、失败语义、是否入节点源。
- **边界外**：判据实现（`src/lib/gates.ts`）。

## 对外暴露接口

JSON：`{ "gates": [ { "id", "scope", "executor", "readingShape", "criterion", "failSemantics", "inNodeSource", "ext"? } ] }`

| 字段 | 取值 | R28 七字段 |
|---|---|---|
| `id` | `G1`…`G6` | ① id |
| `scope` | **判什么／不判什么**（判面） | ② 判面 |
| `executor` | `human` / `machine` / `machine+human` | ③ 执行者 |
| `readingShape` | **读数形态**（如 `{ examined, unrecognized }`） | ④ 读数形态 |
| `criterion` | **完成判据** | ⑤ 完成判据 |
| `failSemantics` | `block` / `visible` / `na` | ⑥ 失败语义 |
| `inNodeSource` | `true` / `false` | ⑦ 是否入节点源 |
| `ext` | 扩展位（可选） | ＋ `ext` |

> **登记面自省**：每条门禁的读数形态须自报 `examined`（判定对象数）与 `unrecognized`（未识别形态数）；「零 FAIL」与「无判定对象」是两个读数（R28）。

## 需引入的依赖

无。被 `src/lib/gates.ts` 与 `scripts/` 只读消费。

## 调用的模块能力及接口

`src/lib/gates.ts` 的门禁函数与本件 `id` 一一对应。

## 已知约束

- **单点权威**：门禁条数（6）与取值只在此写；其余件引用（M10）。
