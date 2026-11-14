---
doc: unit-tests
level: file
target: src/lib/session-overview.ts
status: frozen
landed: true
updated: 2026-11-14
---

# src/lib/session-overview.ts — 测试设计

- `UT-202-session-overview-01`：与 DDD 运行时/Skills/状态接口相互兼容，不产生两份状态源。
- `UT-202-session-overview-02`：异常输入、重启、冲突、符号链接与数据损坏时不得静默通过。
- 具体实现测试：`tests/integration202.test.mjs` 以及原有 `tests/rc.test.mjs`、`tests/skills201.test.mjs`。
