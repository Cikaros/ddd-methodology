---
doc: design
level: file
target: assets/skills-catalog.json
status: frozen
landed: true
covers: [assets-skills-catalog-json, src-lib-registry-ts, scripts-skills-sync-mjs]
updated: 2026-11-14
---

# assets/skills-catalog.json 的设计（2.0.1）

## 职责与边界

- 33 技能唯一权威。
- 原有 15 项 + 必须 6 + 建议 12。
- ID/路径/信号合法、不可越界、不得重复。

## 数据来源与连接

`assets/skills-catalog.json`, `src/lib/registry.ts`, `scripts/skills-sync.mjs`；项目配置只是证据，不覆盖文档和安全策略。

## 验收边界

不把匹配视为执行、不把加载视为工具调用成功、不覆盖用户已有 Skill。无法在离线环境完成的 OpenCode 联调不得报告为通过。
