---
doc: design
level: file
target: src/lib/jsonl.d.mts
status: frozen
landed: true
covers: [readJsonlStrict, EvidenceError]
updated: 2026-11-14
---

# 文件设计：src/lib/jsonl.d.mts — JSONL 类型声明

## 定位与边界

为 Node 原生模块导出解析签名与异常类型。

## 可执行行为契约

只用于 TypeScript 消费侧，不复制实现。

## 对外暴露接口

`readJsonlStrict, EvidenceError`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

tsc --noEmit。
