---
doc: design
level: file
target: tests/skills201.test.mjs
status: frozen
landed: true
covers: [src-lib-skill-router-ts, scripts-materialize-mjs, scripts-skills-sync-mjs]
updated: 2026-11-14
---

# tests/skills201.test.mjs 的设计（2.0.1）

## 职责与边界

- 检测必须/建议覆盖及既有技能兼容。
- 检测 project marker/manifest/extension/任务与误触发。
- 验证物化幂等、冲突前置检查、符号链接保护和 Flash 简短提示。

## 数据来源与连接

`src/lib/skill-router.ts`, `scripts/materialize.mjs`, `scripts/skills-sync.mjs`；项目配置只是证据，不覆盖文档和安全策略。

## 验收边界

不把匹配视为执行、不把加载视为工具调用成功、不覆盖用户已有 Skill。无法在离线环境完成的 OpenCode 联调不得报告为通过。
