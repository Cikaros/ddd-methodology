---
doc: test-design
level: file
target: tests/refactor.test.mjs
status: frozen
landed: true
updated: 2026-11-14
---

# 单元测试设计：tests/refactor.test.mjs

| 用例 ID | 输入/动作 | 验收判据 |
|---|---|---|
| UT-refactor.test-001 | 读取正常项目/模型输入 | 机械结果与输入一致，不可伪造通过 |
| UT-refactor.test-002 | 传入空文件、损坏或异常输入 | 显式拒绝或受控降级，不得静默通过 |
| UT-refactor.test-003 | 运行原版自测和重构反例 | `npm test` 成功，且不改动权威件 |
