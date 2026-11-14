---
doc: design
level: file
target: src/lib/session-links.d.mts
status: frozen
landed: true
updated: 2026-11-14
---

# src/lib/session-links.d.mts — 子会话关系类型声明

## 职责边界

公开 session-links.mjs 的读写类型，保证 TypeScript 接入边界可检查。

## 输入与输出

`linkChildSession/readParentLink declarations`。只读取或写入授权的数据位置，不承诺外部 SDK 的隐式行为。

## 错误处理与验收

拒绝格式异常、路径越界和没有证据的通过结果；跨模块行为由 `tests/integration202.test.mjs` 检查，保留原有回归测试。
