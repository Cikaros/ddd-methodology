---
doc: design
level: file
target: src/lib/executable-verifier.d.mts
status: frozen
landed: true
covers: [verifyExecutable, fingerprint]
updated: 2026-11-14
---

# 文件设计：src/lib/executable-verifier.d.mts — 可执行验证类型声明

## 定位与边界

为可执行验证结果与指纹提供类型定义。

## 可执行行为契约

声明只用于类型检查。

## 对外暴露接口

`verifyExecutable, fingerprint`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

tsc --noEmit。

## 2.0.0 收尾契约（2026-11-14）

**执行器类型契约**：暴露确定的验证器状态和可用测试适配；禁止把无检测结果当 passed。
