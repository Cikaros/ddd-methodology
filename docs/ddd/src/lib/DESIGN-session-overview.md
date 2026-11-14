---
doc: design
level: file
target: src/lib/session-overview.ts
status: frozen
landed: true
updated: 2026-11-14
---

# src/lib/session-overview.ts — DDD 会话统一只读视图

## 职责边界

从权威工作流、门禁、看板和技能路由读取实时状态；RPC 与 TUI 共用，不修改任务状态，也不以模型陈述冒充验收。

## 输入与输出

`readSessionOverview`。只读取或写入授权的数据位置，不承诺外部 SDK 的隐式行为。

## 错误处理与验收

拒绝格式异常、路径越界和没有证据的通过结果；跨模块行为由 `tests/integration202.test.mjs` 检查，保留原有回归测试。
