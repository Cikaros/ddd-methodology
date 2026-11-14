---
doc: design
level: file
target: src/lib/command-dispatcher.ts
status: frozen
landed: true
covers: [makeHandler(name,ctx,slices)]
updated: 2026-11-14
---

# 文件设计：src/lib/command-dispatcher.ts — 命令派发与派发凭证

## 定位与边界

以 registry 单点命令元数据建立指令，保留附件，优先同会话，独立评审按 isolated 派发。

## 可执行行为契约

先 blocking assert 再准备派发；checkpoints 仅表示准备/派发，不表示模型任务完成；子会话失败仅在发送前可回退，绝不能重复发送同一 prompt。

## 对外暴露接口

`makeHandler(name,ctx,slices)`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

隔离任务的派发只发生一次；阶段恢复凭证；原版 selftest 角色、权限断言。

## 2.0.0 收尾契约（2026-11-14）

**命令/交接派发**：15 条原命令统一注册与角色归属；命令先记录 prepared，再选择 same/isolated 派发；不重复提交可能成功的请求；子会话映射执行事件。

## 2.0.2 全局集成约束

isolated 角色会话归属需等待持久化关系写入后才下发 prompt；失败不得在父会话重复执行。
