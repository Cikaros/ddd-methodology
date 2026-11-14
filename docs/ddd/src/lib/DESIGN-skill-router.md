---
doc: design
level: file
target: src/lib/skill-router.ts
status: frozen
landed: true
covers: [assets-skills-catalog-json, src-lib-registry-ts, src-lib-context-service-ts]
updated: 2026-11-14
---

# src/lib/skill-router.ts 的设计（2.0.1）

## 职责与边界

- 有界扫描项目配置和源码文件名，跳过密钥文件、node_modules 和符号链接。
- 根据扩展名、项目标记、依赖及明确任务关键词计分。
- 按类别上限和总数上限返回 Skill ID，不加载全文。

## 数据来源与连接

`assets/skills-catalog.json`, `src/lib/registry.ts`, `src/lib/context-service.ts`；项目配置只是证据，不覆盖文档和安全策略。

## 验收边界

不把匹配视为执行、不把加载视为工具调用成功、不覆盖用户已有 Skill。无法在离线环境完成的 OpenCode 联调不得报告为通过。
