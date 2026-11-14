---
doc: design
level: file
target: src/lib/memory-store.mjs
status: frozen
landed: true
covers: [foldMemoryRows, readMemoryRows, recordMemoryHit, recordSessionDecay]
updated: 2026-11-14
---

# 文件设计：事件溯源记忆单一写入器

## 唯一职责

严格校验 JSONL；按照事件顺序投影最终状态；复发按会话 SHA 去重；删除会话时对未命中记录衰减，均在同一锁内读改写，保留历史。

## 可执行契约

对外：`foldMemoryRows, readMemoryRows, recordMemoryHit, recordSessionDecay`；异常不得静默成功，不篡改用户事实。实际行为由原版自测及 `tests/rc.test.mjs` 中的并发、损坏状态、幂等、恢复用例验证。
