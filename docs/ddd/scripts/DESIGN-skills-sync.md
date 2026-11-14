---
doc: design
level: file
target: scripts/skills-sync.mjs
status: frozen
landed: true
covers: [assets-skills-catalog-json, assets-languages-json, skills---]
updated: 2026-11-14
---

# scripts/skills-sync.mjs 的设计（2.0.1）

## 职责与边界

- 验证目录 ID、frontmatter 与引用、发现孤儿技能。
- 从目录生成 languages.json 兼容投影。
- --check 只读检验，非同步状态拒绝通过。

## 数据来源与连接

`assets/skills-catalog.json`, `assets/languages.json`, `skills/**`；项目配置只是证据，不覆盖文档和安全策略。

## 验收边界

不把匹配视为执行、不把加载视为工具调用成功、不覆盖用户已有 Skill。无法在离线环境完成的 OpenCode 联调不得报告为通过。
