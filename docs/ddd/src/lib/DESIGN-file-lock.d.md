---
doc: design
level: file
target: src/lib/file-lock.d.mts
status: frozen
landed: true
covers: [withFileLock<T>]
updated: 2026-11-14
---

# 文件设计：文件锁类型契约

## 唯一职责

声明跨进程写锁 API 及超时/陈旧判定参数；不含行为。

## 可执行契约

对外：`withFileLock<T>`；异常不得静默成功，不篡改用户事实。实际行为由原版自测及 `tests/rc.test.mjs` 中的并发、损坏状态、幂等、恢复用例验证。
