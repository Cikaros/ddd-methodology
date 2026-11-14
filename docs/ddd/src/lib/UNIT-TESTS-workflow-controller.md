---
doc: unit-tests
level: file
target: src/lib/workflow-controller.ts
status: frozen
landed: true
updated: 2026-11-14
---

# 测试设计：src/lib/workflow-controller.ts

| 用例 ID | 预期行为 | 执行位置 |
|---|---|---|
| UT-workflow-controller-rc-001 | 宿主事件时序竞态、子代理归属、测试通过与失败和回执验证 | `tests/rc.test.mjs` |
| UT-workflow-controller-rc-002 | 异常输入拒绝，未有可执行证据不得伪造通过 | `tests/rc.test.mjs` / `npm test` |

测试设计是契约；真实运行与宿主联调结果应单独提供，不得以文档代替。
