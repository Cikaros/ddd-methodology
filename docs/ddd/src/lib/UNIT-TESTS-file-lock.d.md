---
doc: unit-tests
level: file
target: src/lib/file-lock.d.mts
status: frozen
landed: true
updated: 2026-11-14
---

# 用例设计：src/lib/file-lock.d.mts

| 用例 ID | 可观察结果 | 执行位置 |
|---|---|---|
| UT-file-lock-d-rc-001 | 正常状态正确读写并在多进程中保持一致 | `tests/rc.test.mjs` |
| UT-file-lock-d-rc-002 | 锁/历史损坏拒绝假通过；重试幂等 | `tests/rc.test.mjs` |
