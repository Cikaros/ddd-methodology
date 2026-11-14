---
doc: design
level: file
target: src/lib/trace-store.d.mts
status: frozen
landed: true
covers: [SessionTrace, recordTrace, exportEval]
updated: 2026-11-14
---

# 文件设计：src/lib/trace-store.d.mts — 观测模块类型契约

## 定位与边界

声明有效事件与只读的完整评测记录形态，不保存 runtime 数据。

## 输入输出与约束

公开能力：`SessionTrace, recordTrace, exportEval`。错误必须可见；不得把不存在的测试、模型结果或过期证据当作通过。保留 Hermess 文档先行约束和原命令入口。

## 验证要点

tsc --noEmit；与实际 .mjs 互操作。详见 `tests/rc.test.mjs` 与原有自测；真实宿主联调另列为发布前置条件。
