---
doc: design
level: file
target: src/lib/session-links.mjs
status: frozen
landed: true
updated: 2026-11-14
---

# src/lib/session-links.mjs — 子会话持久关系库

## 职责边界

原子保存 child→parent 关系；拒绝跨项目路径、符号链接、重绑定。仅保存会话 ID，不保存提示词。

## 输入与输出

`linkChildSession/readParentLink`。只读取或写入授权的数据位置，不承诺外部 SDK 的隐式行为。

## 错误处理与验收

拒绝格式异常、路径越界和没有证据的通过结果；跨模块行为由 `tests/integration202.test.mjs` 检查，保留原有回归测试。
