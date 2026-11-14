---
doc: design
level: file
target: src/lib/file-lock.mjs
status: frozen
landed: true
covers: [withFileLock]
updated: 2026-11-14
---

# 文件设计：统一跨进程文件锁

## 唯一职责

单写入者、PID 存活检查、残留锁安全回收、符号链接拒绝；看板/工作流/指标共用，避免三套锁实现。

## 可执行契约

对外：`withFileLock`；异常不得静默成功，不篡改用户事实。实际行为由原版自测及 `tests/rc.test.mjs` 中的并发、损坏状态、幂等、恢复用例验证。
