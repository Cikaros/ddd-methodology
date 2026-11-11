# 子代理设计：检查与优化记录（供二次审计）

> 对象：`docs/ddd/agents/**`（6 份件）。状态：**全部 `draft`，待二次审计**；其余设计树仍 `frozen`。

## 一、本次检查发现的问题

| # | 问题 | 处置 |
|---|---|---|
| A1 | 子代理件在变更后仍为 `frozen` | 已全部置回 `draft`（待审计后再冻结） |
| A2 | 「命令→子代理」表述不准确：插件命令 `CommandDefinition` 无 `agent`/`subagent` 字段 | 改为两条准确路径：静态 md 命令用 frontmatter `agent:`+`subagent:true`；插件命令 handler 用 `ctx.session.create`→`switchAgent`→`prompt` |
| A3 | 未区分角色权限，只读角色可能被授写权 | 增「权限最小暴露」：reviewer/auditor 只读；写角色限目标件；破坏性动作走守卫 |
| A4 | `ddd-consolidator` 与模板关系不明 | 标注为模板的**实例＋额外约束**，`depends` 指向模板 |
| A5 | 模块测试只覆盖通用两项，未覆盖角色清单/派发/权限/深度 | 扩为 6 条（MT-agents-01…06） |
| A6 | 归并测试未覆盖其不变量 | 补 4 条（不改语义、不删变更流） |
| A7 | 模板测试未覆盖权限原则 | 补第 5 条 |

## 二、当前角色清单（单一权威，见 `agents/DESIGN.md`）

intent-clarifier／architect／designer／design-reviewer／test-designer／implementer／tester／auditor／consolidator／curator。

## 三、与 OpenCode 的关系（非冲突）

宿主原生：`subagent` 工具、`mode: subagent`、`ctx.agent.transform`、`experimental.subagent_depth`（默认 1）、`permission` 的 `subagent` action。

## 四、留给二次审计的裁量项

| # | 裁量项 | 现状 |
|---|---|---|
| Q1 | 角色是否需要**逐角色文件设计件**，还是「清单＋模板」同构覆盖即可 | 现取后者（避免 10 份同构冗余，M10） |
| Q2 | `ddd-curator` 是否纳入本版范围 | 现标「可选」 |
| Q3 | 命令派发是否统一为「md 命令优先、插件命令仅动态」 | 现两路径并存，按命令形态选 |
| Q4 | 只读角色的强制方式：仅 `permissions` 声明，还是同时由 `guard` 机械兜底 | 现：声明 + 建议走守卫 |

## 五、读数

- 子代理件：6（设计 3 + 测试 3），全部 `draft`。
- 全局用例编号：105 条，0 重复。