---
doc: design
level: file
target: src/lib/memory-store.d.mts
status: frozen
landed: true
covers: [foldMemoryRows, recordMemoryHit, recordSessionDecay]
updated: 2026-11-14
---

# 文件设计：记忆写入器类型契约

## 唯一职责

声明有界历史与持久写入接口；运行时调用只读投影和显式事件写入。

## 可执行契约

对外：`foldMemoryRows, recordMemoryHit, recordSessionDecay`；异常不得静默成功，不篡改用户事实。实际行为由原版自测及 `tests/rc.test.mjs` 中的并发、损坏状态、幂等、恢复用例验证。
