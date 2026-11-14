---
doc: design
level: file
target: src/lib/workflow-store.mjs
status: frozen
landed: true
covers: [checkpointPath, readCheckpoint, recordDispatch, resumeHint]
updated: 2026-11-14
---

# 文件设计：src/lib/workflow-store.mjs — 可恢复任务派发检查点

## 定位与边界

按 session 哈希命名持久文件，记录 prepared/dispatched/failed 与最近 32 条事件。

## 可执行行为契约

原子 JSON 更新+进程文件锁；禁止跳过准备直接标记 dispatched；只证明交给 OpenCode，绝不自称执行/测试完成；拒绝符号链接路径。

## 对外暴露接口

`checkpointPath, readCheckpoint, recordDispatch, resumeHint`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

V2: 重启恢复、失效状态拒绝、提示词只存哈希。

## 2.0.0 收尾契约（2026-11-14）

**持久工作流事件与严格状态机**：状态：prepared → dispatched → running → awaiting_verification → verified/failed；准备新任务会显式把未完成旧任务标为 superseded；通过验证必须绑定真实命令退出码和源指纹。事务性写锁与原子替换，并可读取 2.0 旧回执。
