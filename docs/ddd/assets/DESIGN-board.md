---
doc: design
level: file
target: assets/board.json
status: frozen
landed: true
covers: [board-config]
depends: [src/lib/board.ts]
updated: 2026-11-11
---

# 文件设计：assets/board.json（看板配置基线）

## 定位与边界

- **职责**：看板的**机械取值**唯一权威（优先级域、反饥饿、孤儿阈值、状态与转移域）。
- **边界内**：阈值与取值域。
- **边界外**：判定算法（`src/lib/board.ts`）；数据（`docs/board/board.jsonl`）。

## 对外暴露接口

JSON：
```json
{
  "priorityDomain": ["P0","P1","P2","P3"],
  "defaultPriority": "P2",
  "statusDomain": ["pending","in_progress","blocked","done","dropped"],
  "starvationWindow": 8,
  "starvationLimit": 3,
  "orphanHours": 24,
  "maxLineBytes": 8192
}
```

## 需引入的依赖

无。被 `src/lib/board.ts` 与 `scripts/board.mjs` 只读消费。

## 调用的模块能力及接口

`admit` 读 `priorityDomain`/`defaultPriority`/`starvation*`；`detectOrphans` 读 `orphanHours`；写入器读 `maxLineBytes`。

## 已知约束

- **单点权威**：阈值只在此写；代码不得内置。
- 反饥饿：连续 `starvationWindow` 次追加优先级均严高于在办 → 提示；超 `starvationLimit` 须附 `reason` 才许写。