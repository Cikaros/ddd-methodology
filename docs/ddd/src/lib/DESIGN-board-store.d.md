---
doc: design
level: file
target: src/lib/board-store.d.mts
status: frozen
landed: true
covers: [readBoardRows, withBoardLock]
updated: 2026-11-14
---

# 文件设计：src/lib/board-store.d.mts — 看板事务类型契约

## 定位与边界

为 board-store.mjs 提供受严格 BoardRow 类型约束的声明。

## 可执行行为契约

只声明、不重复实现判据。

## 对外暴露接口

`readBoardRows, withBoardLock`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

tsc --noEmit。
