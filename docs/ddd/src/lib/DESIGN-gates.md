---
doc: design
level: file
target: src/lib/gates.ts
status: frozen
landed: true
covers: [Verdict, GateReading, ProjectState, gates, summarize, canAdvance]
updated: 2026-11-11
---

# 文件设计：src/lib/gates.ts（门禁判据）

## 定位与边界

- **职责**：六道门禁 G1–G6 的**纯函数判据**，入参为项目状态快照。
- **边界内**：判据与读数汇总（区分 `pass/block/visible/na`）。
- **边界外**：盘面读取（在 `scripts/` 或调用方，凑出 `ProjectState`）；门禁的通过文字说明（权威在 `docs/OUTLINE-DESIGN.md` §6.2）。

## 对外暴露接口

| 导出 | 形态 | 说明 |
|---|---|---|
| `Verdict` | 类型 | `"pass" | "block" | "visible" | "na"` |
| `GateReading` | 类型 | `{ id, verdict, examined, unrecognized, remedy? }` |
| `ProjectState` | 类型 | 门禁判据唯一入参 |
| `gates` | `{ G1..G6 }` | 各门禁判据函数 |
| `summarize(readings)` | 汇总 | `{ pass, block, visible, na }` |
| `canAdvance(readings)` | 判定 | `block` 为零即可推进 |

## 需引入的依赖

无（**只依赖标准库**）。

## 调用的模块能力及接口

被 `src/index.ts`（RPC `gates`）与 `scripts/`（门禁读取器）调用。

## 已知约束

- **「零 FAIL」与「无判定对象」是两个读数**：判定对象不存在时报 `na`，**绝不判为 `pass`**（§8 补充线索、R25）。
- `block`／`visible` 必须带**补救指令**（§三.6 Linter 即 Prompt）。
- 自省字段 `examined`／`unrecognized` 必填（§10.1 登记面自省）。
