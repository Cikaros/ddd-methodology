---
doc: unit-tests
level: file
target: src/lib/evidence-retrieval.mjs
status: frozen
landed: true
updated: 2026-11-14
---

# 测试设计：src/lib/evidence-retrieval.mjs

| 用例 ID | 预期行为 | 执行位置 |
|---|---|---|
| UT-evidence-retrieval-rc-001 | 按阶段检索、预算上界、越界文件与 symlink 拒绝 | `tests/rc.test.mjs` |
| UT-evidence-retrieval-rc-002 | 异常输入拒绝，未有可执行证据不得伪造通过 | `tests/rc.test.mjs` / `npm test` |

测试设计是契约；真实运行与宿主联调结果应单独提供，不得以文档代替。
