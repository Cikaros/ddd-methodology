---
doc: unit-tests
level: file
target: src/lib/memory.ts
status: frozen
landed: false
depends: [src/lib/DESIGN-memory.md]
updated: 2026-11-11
---

# 单元测试设计：src/lib/memory.ts

## 执行件与前置

- 执行件：待实现（`src/lib/memory.ts`）。
- 前置：`src/lib/DESIGN-memory.md`、`assets/memory.json`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-src-lib-memory-01 | 星级计算 | `computeConfidence` 随次数/一致率单调，落 1–5★ | 待落地 |
| UT-src-lib-memory-02 | 提醒/晋升阈值 | `shouldRemind`/`shouldPromote` 严格读 `assets/memory.json`，代码无内置阈值 | 待落地 |
| UT-src-lib-memory-03 | 衰减与归档 | 未再现条目逐会话减星，低于 1★ 转 archived 且不进默认注入 | 待落地 |
| UT-src-lib-memory-04 | scope 隔离 | 不同项目根互不注入、互不归并 | 待落地 |
| UT-src-lib-memory-05 | 幂等去重 | 同会话同 key 只计一次 occur | 待落地 |
| UT-src-lib-memory-06 | 判定对象缺失 | 无 memory.jsonl 时报 na，不判通过 | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。