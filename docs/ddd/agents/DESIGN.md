---
doc: design
level: module
target: agents
status: frozen
landed: false
updated: 2026-11-11
---

# 模块设计：agents（随包子代理角色）

## 定位与边界

- **职责**：定义开发流程各节点的**子代理角色**，供宿主 `subagent` 工具按 `mode: subagent` 触发；实现「命令背后可替换」（M4）与「上下文隔离防漂移」。
- **边界内**：角色清单（单一权威）、统一契约模板、各角色输入面/输出/约束。
- **边界外**：编排调度（交宿主）；业务提示词。

## 与 OpenCode 的关系（澄清：不冲突）

宿主原生支持子代理：`subagent` 工具（前台/后台）、`agents/*.md` 的 `mode: subagent`、`ctx.agent.transform`、`experimental.subagent_depth`（默认 1）、`permission` 的 `subagent` action。**本模块只是提供角色定义，不重造机制。**

## 角色清单（单一权威）

| 代理 | 角色 | 触发（命令） | 输入面 | 输出 |
|---|---|---|---|---|
| `ddd-intent-clarifier` | 需求澄清（结构化提问，阻塞确认） | `/ddd-intent` | 需求草案、场景标记 | 冻结需求 + 裁决记录 |
| `ddd-architect` | 技术与架构（含选型论证稿） | `/ddd-arch` | 冻结需求、环境探查 | `ARCHITECTURE.md` + 目录规划 |
| `ddd-designer` | 逐层设计树 | `/ddd-design`（`--from-code` 同源反推） | 需求、架构 | 四级设计件 |
| `ddd-design-reviewer` | 冻结前独立交叉评审契约 | `/ddd-review` | 设计树、实物 | 评审结论（落 `docs/audits/`） |
| `ddd-test-designer` | 四级测试用例树 | `/ddd-test-design` | 设计树 | 设计树测试件 |
| `ddd-implementer` | 按冻结契约实现 | `/ddd-implement` | 冻结设计件 | 代码 + 单元测试 |
| `ddd-tester` | 四级测试执行与缺陷路由 | `/ddd-test` | 测试树、实现 | 测试报告 + 缺陷路由 |
| `ddd-auditor` | 独立对账/反漂移审计 | `/ddd-validate`、评审 | 全仓 | 审计件（`docs/audits/`） |
| `ddd-consolidator` | 冻结即归并（按模块/目录隔离） | `/ddd-consolidate` | 该块产物+变更流切片+冻结契约 | 该块终稿 |
| `ddd-curator` | 记忆/坑点归纳（可选） | 会话结束/记忆闭环 | 会话轨迹 | `memory.jsonl` 条目 |

> **命令为稳定接口、代理为实现**：命令 handler 以子会话派发对应角色（上下文隔离）；角色可替换而不改命令名（M4）。

## 统一契约（模板）

每个角色文件遵循同一 frontmatter/正文契约，见 `docs/ddd/agents/DESIGN-AGENT-TEMPLATE.md`。**角色是模板的同构实例**：新增角色＝在清单加一行 + 生成实例，不改模板。

## 关键约束（通用）

- 一律 `mode: subagent`（仅子代理态）。
- **输入面受限**：只读该任务必需件；**不得**带入无关历史（防上下文污染）。
- **不改契约语义**（归并/评审/测试均只读或只改表述形态）。
- 破坏性动作走守卫层（`guard`/权限），不在代理正文自律。

## 依赖方向

只依赖 `docs/GLOSSARY.md` 术语与方法论纪律；不依赖 `src/**`。

## 状态

`frozen`。