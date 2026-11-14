---
doc: unit-tests
level: file
target: scripts/materialize.mjs
status: frozen
landed: true
depends: [scripts/DESIGN-materialize.md]
updated: 2026-11-11
---

# 单元测试设计：scripts/materialize.mjs

## 执行件与前置

- 执行件：已实现（`scripts/materialize.mjs`）。
- 前置：`scripts/DESIGN-materialize.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-materialize-01 | 物化 agents | `agents/*.md` → `<root>/.opencode/agents/*.md`，数量一致 | 已落地 |
| UT-scripts-materialize-02 | 幂等 | 二次运行不重复写、内容一致则跳过 | 已落地 |
| UT-scripts-materialize-03 | 包根/项目根分离 | 源取包根、写取项目根（不混用） | 已落地 |
| UT-scripts-materialize-04 | 失败语义 | 包根缺 `agents/` → 退出 1，不静默 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。

## 2.0.1 补充用例

检查 33 项 Skill 可发现、引用文件保留、二次物化不写入、用户同名 Skill 冲突前置拦截、符号链接目录拒绝访问。
