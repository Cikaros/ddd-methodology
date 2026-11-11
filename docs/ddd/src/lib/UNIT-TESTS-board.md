---
doc: unit-tests
level: file
target: src/lib/board.ts
status: frozen
landed: false
depends: [src/lib/DESIGN-board.md]
updated: 2026-11-11
---

# 单元测试设计：src/lib/board.ts

## 执行件与前置

- 执行件：待实现（`src/lib/board.ts`）。
- 前置：`src/lib/DESIGN-board.md`、`assets/board.json`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-src-lib-board-01 | 投影排序 | `project` 按 `priority` 升序、同优先级 `seq` 升序 | 待落地 |
| UT-src-lib-board-02 | 剔除规则 | 剔除 `archive`；剔除前驱未满足者 | 待落地 |
| UT-src-lib-board-03 | 准入判据 | `acceptance` 为空/`priority` 越域/`dependsOn` 不存在 → 拒入板 | 待落地 |
| UT-src-lib-board-04 | 转移合法 | `move` 的 `from` 与投影不符 → 拒；非法转移拒 | 待落地 |
| UT-src-lib-board-05 | 反饥饿 | 连续超阈值且缺 `reason` → 拒写 | 待落地 |
| UT-src-lib-board-06 | 孤儿检测 | `in_progress` 超 `orphanHours` → 列提示（visible，不判失败） | 待落地 |
| UT-src-lib-board-07 | 收尾判据 | 仅有 `pending/blocked` 时投影非空 → G6 不得过 | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。