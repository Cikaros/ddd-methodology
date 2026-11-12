---
doc: design
level: module
target: agents
status: frozen
landed: true
updated: 2026-11-11
---

# 模块设计：agents（随包子代理角色）

## 定位与边界

- **职责**：定义开发流程各节点的**子代理角色**，供宿主以 `mode: subagent` 派发；实现「命令背后可替换」（M4）与「上下文隔离防漂移」。
- **边界内**：角色清单（单一权威）、统一契约模板、各角色的输入面/输出/权限原则。
- **边界外**：子代理的**运行时机制**（`subagent` 工具、子会话、嵌套深度）由宿主提供；**命令名**是稳定接口。

## 与 OpenCode 的关系（澄清：不冲突）

宿主原生支持子代理：`subagent` 工具（前台等待 / `background:true` 返回 `sessionID` 可续）、`agents/*.md` 的 `mode: subagent`、`ctx.agent.transform`、`experimental.subagent_depth`（默认 1）、`permission` 的 `subagent` action（resource＝agent ID）。本模块只提供角色定义，**不重造机制**。

## 角色清单（单一权威）

| 代理 | 角色 | 触发（命令） | 输入面（受限） | 输出 | 权限倾向 |
|---|---|---|---|---|---|
| `ddd-intent-clarifier` | 需求澄清（结构化提问，阻塞确认） | `/ddd-intent` | 需求草案、场景标记 | 冻结需求 + 裁决记录 | 只读 + 提问 |
| `ddd-architect` | 技术与架构（含选型论证稿） | `/ddd-arch` | 冻结需求、环境探查 | `ARCHITECTURE.md` + 目录规划 | 只读 + 写架构件 |
| `ddd-designer` | 逐层设计树 | `/ddd-design`（`--from-code` 同源反推） | 需求、架构 | 四级设计件 | 写设计树 |
| `ddd-design-reviewer` | 冻结前独立交叉评审契约 | `/ddd-review` | 设计树、实物 | 评审结论（`docs/audits/`） | **只读** |
| `ddd-test-designer` | 四级测试用例树 | `/ddd-test-design` | 设计树 | 设计树测试件 | 写测试树 |
| `ddd-implementer` | 按冻结契约实现 | `/ddd-implement` | 冻结设计件 | 代码 + 单元测试 | 写代码（受守卫） |
| `ddd-tester` | 四级测试执行与缺陷路由 | `/ddd-test` | 测试树、实现 | 测试报告 + 缺陷路由 | 执行测试 |
| `ddd-auditor` | 独立对账/反漂移审计 | `/ddd-validate`、评审 | 全仓 | 审计件（`docs/audits/`） | **只读** |
| `ddd-consolidator` | 冻结即归并（按模块/目录隔离） | `/ddd-consolidate` | 该块产物+变更流切片+冻结契约 | 该块终稿 | 目标块写 |
| `ddd-curator` | 记忆/坑点归纳 | 记忆闭环（会话末/`/ddd-memo`） | 会话轨迹、既有记忆（只读） | `memory.jsonl` 条目（`record`/`occur`） | 追加写记忆 |
| `ddd-vision-reader` | **视觉设计稿读取**（多模态模型） | `/ddd-design`（前端）／`/ddd-review` | 设计稿图片 | 结构化视觉规格（项目件） | **只读** + 写规格件 |
| `ddd-ui-diff` | **设计稿↔实现对照**（低成本模型） | `/ddd-review`／`/ddd-test` | 视觉规格、实现代码 | 差异清单 | **只读** |

## 分发机制（命令 → 角色，准确落点）

命令是稳定接口，角色是其可替换实现（M4）。**默认同会话**：命令在**当前会话**内执行，以该角色的纪律工作（不新建会话）。**仅隔离例外走子会话**。

| 策略 | 命令 | 派发方式 |
|---|---|---|
| **same（默认）** | 其余 12 条 | 在当前会话内 `ctx.session.prompt` 注入该角色指令；**不建会话** |
| **isolated（例外）** | `ddd-review`／`ddd-validate`／`ddd-consolidate` | 经宿主 `subagent` 工具（或静态 md 命令 `agent:`＋`subagent:true`）派发子会话 |

- **策略单点权威**：`assets/commands.json` 的 `dispatch` 字段（`same`／`isolated`，M10）。
- **隔离例外的理由**：`ddd-review`／`ddd-validate` 需**独立**（不污染原会话）；`ddd-consolidate` 有 **R44 红线**——归并**禁止在原迭代会话就地完成**。
- **嵌套深度**：隔离例外受 `experimental.subagent_depth`（默认 1）约束；默认同会话路径不涉嵌套。
- **失败回退**：隔离派发不可用（如权限拒绝）时，命令在**本会话**执行，但须**在读数上可见**（不得静默降级）。

## 角色工具面强制（Q4：必强制、尽量在工具注册层）

- **宿主事实**：agent 定义**无 `tools` 白名单字段**（字段仅 `model`/`system`/`mode`/`hidden`/`disabled`/`permissions`）。故"注册层直接限制"原生不可得。
- **求其次但仍是机械的三层**（都不依赖模型服从提示词）：
  1. **主：请求级工具裁剪** — `session.hook("context")` 按 `event.agent` 执行 `delete event.tools[<name>]`，使不在该角色白名单的工具**根本不出现在该次请求**；模型看不到即不能调。**注**：同会话命令不切 `agent`，故默认路径下本层按**当前 agent** 生效；隔离路径下按**角色 agent** 生效。
  2. **次：角色 `permissions` 的 `deny`** — 在 agent 配置声明 `{action,resource,effect:"deny"}`，执行面直接拒绝。
  3. **兜底：`permission.hook("evaluate")`** — 运行时 `deny`（fail-safe），覆盖 1/2 漏网。
- **白名单单点权威**：`assets/role-tools.json`（角色→允许工具集）。`src/lib/guard.ts` 读它实现 1；角色 `permissions` 与 `evaluate` 由 `src/index.ts` 装配。
- **只读角色**（reviewer/auditor）在三个层次都不得写。

## 分发（Q3：默认同会话 + 隔离例外）

命令默认在**当前会话**执行（不新建会话）；仅 `ddd-review`／`ddd-validate`／`ddd-consolidate` 走子代理隔离。两路并存由 `assets/commands.json` 的 `dispatch` 决定，**不互相降级**。

## 统一契约与实例

- 每角色遵循同一 frontmatter/正文契约，见 `docs/ddd/agents/DESIGN-AGENT-TEMPLATE.md`。
- 角色是模板的**同构实例**：新增角色＝清单加一行 + 生成实例，不改模板。
- `ddd-consolidator` 有**额外约束**，单列文件设计件。

## 关键约束（通用）

- 一律 `mode: subagent`（仅子代理态）。
- **输入面受限**：只读该任务必需件；**不得**带入无关历史（防上下文污染）。
- **不改契约语义**（评审/测试/归并只读或只改表述形态）。
- **权限最小暴露**：只读角色（reviewer/auditor）不得写；破坏性动作走守卫层（`guard`/权限），不在正文自律。

## 依赖方向

只依赖 `docs/GLOSSARY.md` 术语与方法论纪律；不依赖 `src/**`。

## 状态

本件为 `frozen`；与上级设计件及实物对账一致。
