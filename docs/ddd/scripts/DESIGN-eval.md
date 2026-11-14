---
doc: design
level: file
target: scripts/eval.mjs
status: frozen
landed: true
covers: [--baseline/--candidate]
updated: 2026-11-14
---

# 文件设计：scripts/eval.mjs — 成对实验结果聚合

## 定位与边界

读取两组真实模型执行追踪 JSONL，按相同 taskId/model 配对统计成功率、工具失败、耗时、Token、人工干预。

## 可执行行为契约

不主动调用模型、不捏造 accepted；不同任务/模型不允许直接比较。

## 对外暴露接口

`--baseline/--candidate`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

V2: 不同模型和任务数据应拒绝比较。
