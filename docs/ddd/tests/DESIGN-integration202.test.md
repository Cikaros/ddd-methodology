---
doc: design
level: file
target: tests/integration202.test.mjs
status: frozen
landed: true
updated: 2026-11-14
---

# tests/integration202.test.mjs — 跨模块集成回归测试

## 职责边界

覆盖 Agents↔状态↔上下文↔Skills、RPC 概览、Memory 修订、安装预检和安全边界；基于可复现的离线模拟，不宣称模型联调。

## 输入与输出

`node --test tests/integration202.test.mjs`。只读取或写入授权的数据位置，不承诺外部 SDK 的隐式行为。

## 错误处理与验收

拒绝格式异常、路径越界和没有证据的通过结果；跨模块行为由 `tests/integration202.test.mjs` 检查，保留原有回归测试。
