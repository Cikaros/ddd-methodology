---
doc: design
level: file
target: src/lib/evidence-retrieval.d.mts
status: frozen
landed: true
covers: [selectEvidence, EvidenceSnippet]
updated: 2026-11-14
---

# 文件设计：src/lib/evidence-retrieval.d.mts — 检索模块类型契约

## 定位与边界

接口与 .mjs 实现严格一致；不增添运行时能力。

## 输入输出与约束

公开能力：`selectEvidence, EvidenceSnippet`。错误必须可见；不得把不存在的测试、模型结果或过期证据当作通过。保留 Hermess 文档先行约束和原命令入口。

## 验证要点

tsc --noEmit 及回归集成。详见 `tests/rc.test.mjs` 与原有自测；真实宿主联调另列为发布前置条件。
