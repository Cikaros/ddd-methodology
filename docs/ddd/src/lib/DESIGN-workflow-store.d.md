---
doc: design
level: file
target: src/lib/workflow-store.d.mts
status: frozen
landed: true
covers: [WorkflowReceipt, WorkflowCheckpoint]
updated: 2026-11-14
---

# 文件设计：src/lib/workflow-store.d.mts — 派发检查点类型契约

## 定位与边界

为 workflow-store.mjs 导出函数及结构声明。

## 可执行行为契约

声明接口必须与实现同步；不含运行时行为。

## 对外暴露接口

`WorkflowReceipt, WorkflowCheckpoint`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

tsc --noEmit。

## 2.0.0 收尾契约（2026-11-14）

**持久事件与证据类型契约**：Workspace checkpoint 声明状态、阶段、proof、历史事件 schema；与 mjs 实现同构。
