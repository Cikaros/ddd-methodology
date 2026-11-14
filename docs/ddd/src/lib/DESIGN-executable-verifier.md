---
doc: design
level: file
target: src/lib/executable-verifier.mjs
status: frozen
landed: true
covers: [verifyExecutable, fingerprint]
updated: 2026-11-14
---

# 文件设计：src/lib/executable-verifier.mjs — 发布时真实可执行验证

## 定位与边界

显式 --release 时执行项目存在的 typecheck/lint/test，记录退出码、失败原因与源文件指纹。

## 可执行行为契约

不从模型钩子自动执行任意项目脚本；无 npm test = unverified；脚本导致源码变化则 fail；不得把 G5 静态格式等同于编译成功。

## 对外暴露接口

`verifyExecutable, fingerprint`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

V2: 无测试不通过、真实失败、成功及测试中途篡改源码。

## 2.0.0 收尾契约（2026-11-14）

**多语言显式验证器**：只在用户发起 release/verify 时运行测试；Node、Python、Go、Rust、Maven、Gradle 使用固定参数入口；不认识的框架 unverified；前后源码指纹变化会失败。
