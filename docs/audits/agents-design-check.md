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

## 四、裁定结果（用户已裁）

| # | 裁定 | 落点 |
|---|---|---|
| Q1 | **清单＋模板同构覆盖**（不逐角色另立完整设计树） | `agents/DESIGN.md` 角色清单 + `DESIGN-AGENT-TEMPLATE.md` |
| Q2 | **纳入** `ddd-curator`；**M6 内存闭环做详细设计，需二次评审** | `src/lib/DESIGN-memory.md`（新增，含生命周期/置信度/衰减/晋升/注入/待核 V-20…22） |
| Q3 | **两路并行**（md 命令 与 插件命令 均为一等） | `agents/DESIGN.md`「分发（Q3）」 |
| Q4 | 宿主**无 agent 级 `tools` 白名单**；采用「`context` hook 按 `event.agent` 请求级裁剪工具 ＋ 角色 `permissions` deny ＋ `evaluate` 兜底」 | `agents/DESIGN.md`「角色工具面强制」＋ `assets/role-tools.json` |

## 五、Q4 澄清：什么是「guard 机械兜底」

- 不是另造引擎，而是**组合宿主三个强制面**（均不依赖模型服从提示词）：
  1. `session.hook("context")` 按 `event.agent` `delete event.tools[x]`（请求级工具裁剪，最接近"注册层限制"）；
  2. 角色 `permissions` 的 `deny`（执行面拒绝）；
  3. `permission.hook("evaluate")` 运行时 `deny`（fail-safe）。
- 白名单单一权威：`assets/role-tools.json`。

## 六、读数

- 设计 46 / 测试 46；全局用例编号 **115**，0 重复；覆盖率 0 缺口。
- **待二次评审（`draft`）13 份**：`agents/**`（6）、`src/lib/DESIGN-memory.md`+`UNIT-TESTS-memory.md`、`assets/DESIGN-role-tools.md`+`UNIT-TESTS-role-tools.md`、以及引用了内存/角色工具的 `src/lib/DESIGN.md`、`src/DESIGN-index.md`、`assets/DESIGN.md`。
- 其余设计树保持 `frozen`。