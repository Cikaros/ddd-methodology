---
name: ddd-methodology
description: 分治式设计驱动开发方法论。当用户要求按"ddd方法论""分治式设计驱动""DDD-Methodology"开发新项目或二次开发项目时使用。通过 8 个固定职责子代理（需求采集/验收标准/架构师/分解设计/接口评审/实现/测试规划/测试执行）与目录同构的分布式小设计文档，降低子代理上下文负担，防止实现偏离设计。
---

# 分治式设计驱动开发（DDD-Methodology）

## 知识加载规则（硬规则：禁止整卷加载 references）

知识通过**绑定到流程节点**自动注入，不依赖本文件的记忆：

- **子代理侧（机制保证）**：各代理提示词自包含其阶段必需知识；共享知识切片（`knowledge/defect-routing.md`）经代理 frontmatter `skills: ddd-defect-routing` 在派发时自动注入（test-planner/implementer/interface-reviewer/arbiter 已挂载）。根会话派发时只需传递项目特异信息（路径/接口清单/权限边界）。
- **根会话侧（流程内联标注）**：仅在下方核心流程各步骤标注的时机加载对应切片，禁止提前通读全部。

## 根会话常驻上下文（最小完备集）

仅 `references/spec.md`（调度决策的最小完备集，~90 行）+ 本文件。其余 references/templates.md、process-details.md、defect-routing.md 按下方步骤标注切片加载。

## 核心流程（各步骤内联加载标注）

1. **代理1 需求采集（ddd-requirements）**：派发采集细化需求并与用户确认对齐，产出 `REQUIREMENTS.md`（含项目类型判定）。未对齐前禁止进入下一步。
   > 本步加载：无需切片（代理自包含）。产出后校验参考 `references/templates.md` 的 REQUIREMENTS 节（仅此节）。
2. **代理0 验收标准（ddd-acceptance）**：将需求转为可执行 AC（G/W/T），产出项目根 `AC.md`。
   > 本步加载：`references/templates.md` 的 AC 节（仅此节）。
3. **代理2 架构师（ddd-architect）**：新建项目→定技术环境与目录规划；二次开发且缺规范文档→先现状分析（格式见 `references/process-details.md` 主题D，仅此节）。产出 `ARCHITECTURE.md`。
   > 本步加载：templates 的 ARCHITECTURE 节；二次开发时加读主题D。
4. **代理3 分解设计（ddd-decomposer）**：为每个有实现内容的目录产出同构 `DESIGN.md`（含签名级接口契约），分发模块级 AC。
   > 本步加载：templates 的 DESIGN 节；派发前过 G4 门参考 `references/process-details.md` 主题E（仅 G4 行）。
5. **接口冻结门 G4.5**：派发 ddd-interface-reviewer 独立交叉审查（VERDICT 机读结论），复核后冻结接口。
   > 本步加载：process-details 主题E-G4.5 段（仅此段）；评审缺陷路由知识已内嵌于该代理。
6. **代理4 实现者 ∥ 代理5 测试规划**：实现者逐字匹配冻结接口；测试规划者基于总 AC+模块 AC+冻结接口产出测试计划树（含契约测试）。
   > 本步加载：process-details **主题B**（互斥接缝）+ **主题F**（测试分级，仅此两节）；templates 的 TEST_PLAN 节。
7. **代理6 测试执行（ddd-tester）**：按计划执行测试。路由知识已内嵌该代理（自动定级），争议才升级。
   > 本步加载：无需切片；**仅当发生定级争议时**重读 `references/defect-routing.md`（全量，权威源）或派发 ddd-arbiter（路由知识经 skills 挂载自动注入）。
8. **门禁复核（G1–G6 各门）**：过门时填检查单（templates 的门禁检查单节）。
   > 本步加载：process-details **主题E**（仅此节）+ trace-check.js 输出作为 G2/G4/G5 证据。

## 根会话职责（你自己的职责）

- 仅调度与验证，不直接实现代码；依据总 `AC.md` 验证交付。
- 缺陷定级争议：优先派发 ddd-arbiter（路由知识自动注入，零上下文成本）；你仅做最终裁决/升级用户，裁决前重读 `references/defect-routing.md`。
- 同一缺陷轮回修复超过 2 轮仍未解决 → 强制升级用户，禁止继续循环。

## 缺陷四级路由

规则唯一权威源 `references/defect-routing.md`；代理侧自包含切片 `knowledge/defect-routing.md`（经 skills 自动注入，修改路由规则必须双改）。一句话摘要：默认最低层（D/C）判定，自检通过仍失败才上移；仅 B 级及以上回设计层；同一缺陷修复超 2 轮强制升级用户。

## Workflow 加速档（可选）

当用户明确要求"一键跑完全链"且需求已充分明确时，可使用 workflow 脚本自动推进固定阶段：

```
subagent({ workflow: "<skill目录>/workflows/ddd-workflow.js", args: { root: "<项目根绝对路径>" } })
```

安装后脚本位于 `~/.pi/agent/skills/ddd-methodology/workflows/ddd-workflow.js`；若本机未安装（仅在仓库内开发调试），则使用仓库内 `workflows/ddd-workflow.js` 相对路径。

**前置条件**：8 个 `ddd-*` 代理必须已安装，否则运行时校验失败。脚本通过 `args.root` 接收项目根绝对路径（沙箱中无 process 全局，args 是唯一数据通道）。

脚本会依次执行 需求采集→AC→架构→分解设计（含签名级接口契约）→接口契约独立评审（G4.5，VERDICT 非 pass 中断）→（实现∥测试规划）→G5-INT 集成收口→测试执行；C/D 级缺陷自动派发修复并重测（最多 2 轮），A/B 级缺陷中断脚本返回本会话仲裁。

**限制**：A/B 级缺陷定级仲裁（派 ddd-arbiter）、超 2 轮未解的缺陷、以及需求变更受理必须回到本会话处理。默认仍优先使用手工逐段调度。

## 质量门禁（阶段门）

G1需求→G2验收→G3架构→G4分解设计→G4.5接口冻结→G5实现/测试规划→G5-INT集成→G6交付，详见 process-details 主题E（过门时按步骤8加载）。未过门禁一律退回上一代理；并行实现时各接缝需过子门才可集成收口。

## 需求变更（开发中途）

用户变更需求 → 登记变更单 → 代理1/0 版本化修订 → 代理3 圈定受影响 DESIGN.md → 仅对受影响接缝重设计/重实现/回归。
> 本步加载：process-details **主题C**（仅此节）；涉及冻结接口时 = B 级变更走正式路由。

## 实现与测试严格分离（硬规则）

**原则：规划可并行，执行必隔离。**
- 代理5 测试**规划**（纯文档产出）可与代理4 实现**并行**；
- 代理6 测试**执行**必须在实现并行段全部完成、过 G5 收口门之后**单独串行启动**；执行期间禁止任何实现类 writer 运行；
- **代理6 与代理4 永不同段**，严禁二者共用同一 writer 进程/会话；
- 高风险用例必须桩化或移入手动测试清单，禁止直接自动执行（规则权威：process-details 主题F，代理侧已内嵌于 test-planner/tester 提示词）。

## Workflow 状态文件与断点续跑

workflow 加速档每完成一个阶段即写入 `<项目根>/docs/.ddd-state.json`；已完成阶段自动跳过，从断点续跑。**字段 schema 唯一权威定义见 references/process-details.md 主题H**。

## 子代理调度要求

- 每次派发必须在任务描述中给出：目标、仓库/cwd、权限边界（可改哪些文件）、相关文档的**具体路径**（就近加载）、验收标准、期望输出报告格式、停止条件。
- 实现者任务必须列明其负责目录的 `DESIGN.md` 路径，禁止要求整卷加载所有设计文档。
- 多模块实现可并行派发（按互斥接缝划分，一个接缝一个 writer，通过冻结接口耦合；集成由根会话统一收口后触发集成测试，规则见 process-details 主题B）。
