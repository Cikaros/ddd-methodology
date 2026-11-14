---
doc: design
level: file
target: src/lib/intent-store.mjs
status: frozen
landed: true
covers: [saveIntentDraft]
updated: 2026-11-14
---

# 文件设计：src/lib/intent-store.mjs — 四问输入草稿持久化

## 定位与边界

将 TUI 四问与场景写入 .ddd/state/intent-draft.json，明确它不是被冻结的需求。

## 可执行行为契约

RPC 输入在服务端再校验；限制长度、仅允许枚举场景、原子写文件；不得擅自更新 REQUIREMENTS.md。

## 对外暴露接口

`saveIntentDraft`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

V2: 草稿存档、字段长度与枚举拒绝、原需求文件不变。
