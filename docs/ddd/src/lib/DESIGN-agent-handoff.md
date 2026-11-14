---
doc: design
level: file
target: src/lib/agent-handoff.ts
status: frozen
landed: true
covers: [buildHandoff]
updated: 2026-11-14
---

# 文件设计：src/lib/agent-handoff.ts — 结构化子代理交接

## 定位与边界

从唯一命令角色/阶段权威生成任务契约；明确来源件、交付内容、不得以实施者描述代替独立审查。

## 输入输出与约束

公开能力：`buildHandoff`。错误必须可见；不得把不存在的测试、模型结果或过期证据当作通过。保留 Hermess 文档先行约束和原命令入口。

## 验证要点

角色/文档引用去重、交接不伪造验收。详见 `tests/rc.test.mjs` 与原有自测；真实宿主联调另列为发布前置条件。
