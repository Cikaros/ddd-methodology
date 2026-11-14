---
doc: design
level: file
target: src/lib/gate-evaluator.ts
status: frozen
landed: true
covers: [evaluateProject]
updated: 2026-11-14
---

# 文件设计：src/lib/gate-evaluator.ts — CLI/RPC 统一门禁决策

## 定位与边界

从实时文件采集 ProjectState，调用 G1-G6 纯函数，按 G# 将证据错误归属对应门禁。

## 可执行行为契约

错误不能统一归到 G6；G6 物理状态通过但 G1-G5 不过时只能 visible；绝不信任旧报告。

## 对外暴露接口

`evaluateProject`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

V2 G1 错误归属，旧版 G1-G6 完整证据回归。
