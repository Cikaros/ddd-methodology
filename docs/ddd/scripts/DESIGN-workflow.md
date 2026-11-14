---
doc: design
level: file
target: scripts/workflow.mjs
status: frozen
landed: true
covers: [status, verify, reconcile, close, metrics, intervention]
updated: 2026-11-14
---

# 文件设计：scripts/workflow.mjs — 显式工作流操作 CLI

## 定位与边界

status 只读；reconcile 必须确认宿主完成；verify 必须 --ack-run-tests；close 必须说明原因。自动重放已派发请求禁止。

## 输入输出与约束

公开能力：`status, verify, reconcile, close, metrics, intervention`。错误必须可见；不得把不存在的测试、模型结果或过期证据当作通过。保留 Hermess 文档先行约束和原命令入口。

## 验证要点

未确认拒绝运行、不完整结果不能验收。详见 `tests/rc.test.mjs` 与原有自测；真实宿主联调另列为发布前置条件。
