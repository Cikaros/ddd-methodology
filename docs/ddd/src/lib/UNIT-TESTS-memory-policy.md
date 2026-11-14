---
doc: unit-tests
level: file
target: src/lib/memory-policy.ts
status: frozen
landed: true
updated: 2026-11-14
---

# 测试设计：src/lib/memory-policy.ts

| 用例 ID | 预期行为 | 执行位置 |
|---|---|---|
| UT-memory-policy-rc-001 | 旧版记忆兼容、失效时间和版本错配 | `tests/rc.test.mjs` |
| UT-memory-policy-rc-002 | 异常输入拒绝，未有可执行证据不得伪造通过 | `tests/rc.test.mjs` / `npm test` |

测试设计是契约；真实运行与宿主联调结果应单独提供，不得以文档代替。
