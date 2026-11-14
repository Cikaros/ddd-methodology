---
doc: design
level: file
target: src/lib/workflow-controller.ts
status: frozen
landed: true
covers: [WorkflowController, sessionOfEvent]
updated: 2026-11-14
---

# 文件设计：src/lib/workflow-controller.ts — 事件到工作流状态桥接

## 定位与边界

宿主的 execution.started/succeeded/failed/interrupted 只决定执行状态。成功终态必须进入 awaiting_verification；只有显式测试才可 verified。子代理事件映射至父会话，不重放 prompt。

## 输入输出与约束

公开能力：`WorkflowController, sessionOfEvent`。错误必须可见；不得把不存在的测试、模型结果或过期证据当作通过。保留 Hermess 文档先行约束和原命令入口。

## 验证要点

宿主事件时序竞态、子代理归属、测试通过与失败和回执验证。详见 `tests/rc.test.mjs` 与原有自测；真实宿主联调另列为发布前置条件。

## 2.0.2 全局集成约束

子 Agent 会话归属写入持久化关系存储；重启后工具、宿主事件与验收仍关联父任务。
