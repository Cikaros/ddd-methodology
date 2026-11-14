---
doc: design
level: file
target: tests/v2.test.mjs
status: frozen
landed: true
covers: [node --test tests/v2.test.mjs]
updated: 2026-11-14
---

# 文件设计：tests/v2.test.mjs — 2.0 关键反例测试

## 定位与边界

Node test 基于临时项目，覆盖事务看板、真实脚本验证、检查点、草稿、上下文和诊断。

## 可执行行为契约

不得更改仓库原始权威文档；临时文件测试后必须清理。

## 对外暴露接口

`node --test tests/v2.test.mjs`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

全部子测通过，故障反例必须明确拒绝。
