---
doc: design
level: file
target: src/lib/diagnostics.ts
status: frozen
landed: true
covers: [Diagnostics, diagnosticMessage]
updated: 2026-11-14
---

# 文件设计：src/lib/diagnostics.ts — 诊断汇聚

## 定位与边界

对非关键宿主钩子提供有限容量、去重、敏感信息脱敏的错误日志。

## 可执行行为契约

不得静默掩盖门禁或验证结果；日志不可包含完整原始 prompt/密钥；关键权限检查仍应 fail-safe。

## 对外暴露接口

`Diagnostics, diagnosticMessage`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

V2: 容量、去重、秘密遮蔽和异常消息长度。
