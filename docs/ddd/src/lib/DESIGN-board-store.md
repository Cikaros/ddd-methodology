---
doc: design
level: file
target: src/lib/board-store.mjs
status: frozen
landed: true
covers: [readBoardRows, withBoardLock, appendBoardRow, writeBoardView]
updated: 2026-11-14
---

# 文件设计：src/lib/board-store.mjs — 看板读写事务边界

## 定位与边界

统一 JSONL 严格读取、历史回放、跨进程锁、原子派生视图。

## 可执行行为契约

读-校验-追加-重放须在锁内；既有事件只能追加；不允许路径跟随符号链接。

## 对外暴露接口

`readBoardRows, withBoardLock, appendBoardRow, writeBoardView`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

V2: 并发 7 写入无丢失、符号链接拒绝、replay --check 不改文档。
