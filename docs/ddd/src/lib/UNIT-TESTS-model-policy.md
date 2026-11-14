---
doc: test-design
level: file
target: src/lib/model-policy.ts
status: frozen
landed: true
updated: 2026-11-14
---

# 单元测试设计：src/lib/model-policy.ts

| 用例 ID | 输入/动作 | 验收判据 |
|---|---|---|
| UT-model-policy-001 | 读取正常项目/模型输入 | 机械结果与输入一致，不可伪造通过 |
| UT-model-policy-002 | 传入空文件、损坏或异常输入 | 显式拒绝或受控降级，不得静默通过 |
| UT-model-policy-003 | 运行原版自测和重构反例 | `npm test` 成功，且不改动权威件 |
