---
doc: design
level: file
target: assets/bottom-lines.json
status: frozen
landed: false
covers: [bottom-lines]
depends: [src/lib/guard.ts]
updated: 2026-11-11
---

# 文件设计：assets/bottom-lines.json（底线清单）

## 定位与边界

- **职责**：**底线的唯一权威**——每条底线的判面、执法点、失败语义、补救。
- **边界内**：底线数据。
- **边界外**：执法施加（`src/index.ts`）；判定逻辑（`src/lib/guard.ts`）。

## 对外暴露接口

JSON：`{ "bottomLines": [ { "id", "surface", "action", "resource", "effect", "remedy", "failSemantics" } ] }`

| 字段 | 取值 |
|---|---|
| `surface` | `permission` / `tool-hook` / `gate` |
| `effect` | `deny`（默认拒绝倾向）/ `ask` |
| `failSemantics` | `block` / `visible` |
| `remedy` | 补救指令（必填） |

## 需引入的依赖

无。被 `src/lib/guard.ts` 与 `src/index.ts` 读入。

## 调用的模块能力及接口

guard 逐条判定；`src/index.ts` 把 `permission`/`gate` 类落到宿主可执行面。

## 已知约束

- **每条底线必有执法点**；无 `surface` 者不入此件（R57）。
- 变更流 `CHANGELOG.jsonl` 的写保护须在此声明为 `permission deny`（除唯一工具）。