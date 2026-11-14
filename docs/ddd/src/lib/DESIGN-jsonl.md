---
doc: design
level: file
target: src/lib/jsonl.mjs
status: frozen
landed: true
covers: [readJsonlStrict, EvidenceError]
updated: 2026-11-14
---

# 文件设计：src/lib/jsonl.mjs — 严格 JSONL 单点读取

## 定位与边界

统一 evidence、board、memory 的对象形态校验、行限额和缺失行为。

## 可执行行为契约

错误记录必须包含文件与行号；损坏文件不可回退成空列表。

## 对外暴露接口

`readJsonlStrict, EvidenceError`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

原版 JSONL 反例测试及看板历史校验。
