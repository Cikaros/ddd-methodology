---
doc: unit-tests
level: file
target: src/lib/trace-store.mjs
status: frozen
landed: true
updated: 2026-11-14
---

# 测试设计：src/lib/trace-store.mjs

| 用例 ID | 预期行为 | 执行位置 |
|---|---|---|
| UT-trace-store-rc-001 | 缺失用量拒绝评测、原始提示词不落盘、工具计数 | `tests/rc.test.mjs` |
| UT-trace-store-rc-002 | 异常输入拒绝，未有可执行证据不得伪造通过 | `tests/rc.test.mjs` / `npm test` |

测试设计是契约；真实运行与宿主联调结果应单独提供，不得以文档代替。
