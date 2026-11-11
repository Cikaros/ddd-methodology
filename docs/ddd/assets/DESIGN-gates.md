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
- **边界内**：门禁 id、执行者、失败语义、是否入节点源。
- **边界外**：判据实现（`src/lib/gates.ts`）。

## 对外暴露接口

JSON：`{ "gates": [ { "id", "executor", "failSemantics", "inNodeSource" } ] }`

| 字段 | 取值 |
|---|---|
| `id` | `G1`…`G6` |
| `executor` | `human` / `machine` / `machine+human` |
| `failSemantics` | `block` / `visible` / `na` |
| `inNodeSource` | `true` / `false` |

## 需引入的依赖

无。被 `src/lib/gates.ts` 与 `scripts/` 只读消费。

## 调用的模块能力及接口

`src/lib/gates.ts` 的门禁函数与本件 `id` 一一对应。

## 已知约束

- **单点权威**：门禁条数（6）与取值只在此写；其余件引用（M10）。
