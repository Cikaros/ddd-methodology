---
doc: unit-tests
level: file
target: src/lib/executable-verifier.d.mts
status: frozen
landed: true
updated: 2026-11-14
---

# 用例设计：src/lib/executable-verifier.d.mts

| 用例 ID | 期望行为 | 验证位置 |
|---|---|---|
| UT-executable-verifier-d-001 | 核心路径与接口符合文件设计，不损坏既有行为 | `npm test` |
| UT-executable-verifier-d-002 | 异常输入与边界条件拒绝假通过 | `tests/v2.test.mjs` / `scripts/selftest.mjs` |

本文件中的用例是测试设计；实际自动化覆盖以测试运行记录为准，未在测试中实现的项不能声称已经自动执行。
