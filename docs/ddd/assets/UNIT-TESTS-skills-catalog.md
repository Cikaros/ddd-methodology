---
doc: unit-tests
level: file
target: assets/skills-catalog.json
status: frozen
landed: true
depends: [assets/DESIGN-skills-catalog.md]
updated: 2026-11-14
---

# assets/skills-catalog.json 的测试设计

| 用例 | 输入/条件 | 期望 |
|---|---|---|
| UT-SK201-skills-catalog-01 | 正常目录和配置 | 输出稳定、可重跑、与目录一致 |
| UT-SK201-skills-catalog-02 | 重复、错误或缺失的信号/文件 | 明确拒绝或不给出匹配，不误判成功 |
| UT-SK201-skills-catalog-03 | 迁移兼容场景 | 原有技能 ID、命令和文档结构保持可用 |

自动测试执行件：`tests/skills201.test.mjs`；静态契约：`npm run skill-check`。真实 OpenCode 的技能 tool 调用仍须实机检查。
