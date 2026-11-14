---
doc: unit-tests
level: file
target: tests/rc.test.mjs
status: frozen
landed: true
updated: 2026-11-14
---

# 测试设计：tests/rc.test.mjs

| 用例 ID | 预期行为 | 执行位置 |
|---|---|---|
| UT-rc-test-rc-001 | 16 个新反例场景，失败必须产生非零退出码 | `tests/rc.test.mjs` |
| UT-rc-test-rc-002 | 异常输入拒绝，未有可执行证据不得伪造通过 | `tests/rc.test.mjs` / `npm test` |

测试设计是契约；真实运行与宿主联调结果应单独提供，不得以文档代替。
