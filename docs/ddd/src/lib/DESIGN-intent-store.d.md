---
doc: design
level: file
target: src/lib/intent-store.d.mts
status: frozen
landed: true
covers: [saveIntentDraft]
updated: 2026-11-14
---

# 文件设计：src/lib/intent-store.d.mts — 四问输入类型声明

## 定位与边界

为 RPC service 使用的保存方法提供声明。

## 可执行行为契约

字段完整性与返回值一致。

## 对外暴露接口

`saveIntentDraft`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

tsc --noEmit。
