---
doc: design
level: file
target: src/lib/skill-plan.ts
status: frozen
landed: true
updated: 2026-11-14
---

# src/lib/skill-plan.ts — Skills 任务/项目选择器

## 职责边界

prompt 阶段仅保存任务命中 ID；context 阶段基于实时文件与依赖清单重算项目推荐；类目限额与总量限制，保留原有注册表。

## 输入与输出

`promptSkillHints/selectCurrentSkills`。只读取或写入授权的数据位置，不承诺外部 SDK 的隐式行为。

## 错误处理与验收

拒绝格式异常、路径越界和没有证据的通过结果；跨模块行为由 `tests/integration202.test.mjs` 检查，保留原有回归测试。
