---
doc: unit-tests
level: file
target: scripts/workflow.mjs
status: frozen
landed: true
updated: 2026-11-14
---

# 测试设计：scripts/workflow.mjs

| 用例 ID | 预期行为 | 执行位置 |
|---|---|---|
| UT-workflow-rc-001 | 未确认拒绝运行、不完整结果不能验收 | `tests/rc.test.mjs` |
| UT-workflow-rc-002 | 异常输入拒绝，未有可执行证据不得伪造通过 | `tests/rc.test.mjs` / `npm test` |

测试设计是契约；真实运行与宿主联调结果应单独提供，不得以文档代替。
