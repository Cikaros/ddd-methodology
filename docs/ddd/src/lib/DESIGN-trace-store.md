---
doc: design
level: file
target: src/lib/trace-store.mjs
status: frozen
landed: true
covers: [recordTrace, readTrace, exportEval]
updated: 2026-11-14
---

# 文件设计：src/lib/trace-store.mjs — 可信运行观测

## 定位与边界

只保存摘要化会话 ID、工具成功失败计数、真实宿主模型标识/Token、显式验证结果；缺失保持 null，禁止伪造成功和读取输出内容。

## 输入输出与约束

公开能力：`recordTrace, readTrace, exportEval`。错误必须可见；不得把不存在的测试、模型结果或过期证据当作通过。保留 Hermess 文档先行约束和原命令入口。

## 验证要点

缺失用量拒绝评测、原始提示词不落盘、工具计数。详见 `tests/rc.test.mjs` 与原有自测；真实宿主联调另列为发布前置条件。
