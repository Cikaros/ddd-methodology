---
name: ddd-methodology
description: 分治式设计驱动开发方法论的主技能，承载三通道调度流程、二十一节点序列、八道门禁与缺陷四级路由，并给出技能元规范。当用户要求按「ddd 方法论」「分治式设计驱动」「DDD-Methodology」开发或二次开发项目，或需要判定任务该走主链、快速修复还是自维护通道时读本技能。
---

# 分治式设计驱动开发

## 何时用

1. 用户要求按本方法论开发新项目或二次开发项目，需要确定通道与下一步节点时。
2. 需要判定任务性质，即在主链、快速修复与自维护三通道之间选路时。
3. 需要过门、写门禁记录、做缺陷定级路由、派发子代理或收口交付时。
4. 本技能是唯一常驻入口。治理判据的正文在 governance-* 四份技能，规范条款正文在 spec-* 七份技能，语言与工具约束按节点注入 lang-* 与 tool-* 技能；本技能只给指针，不复制其正文。

## 做什么

### 一 调度模型

调度模型是图而非链，三个入口、三条通道、三类回路。入口判据由根会话按需求性质判定，判定结果写入状态文件的 `channel` 字段，跨通道不得误续跑。

执行顺序为需求、架构、验收、分解设计、详细设计、接口评审、实现与测试规划并行、集成收口、测试执行、声明面审计；G3 先过、G2 后过。

快速通道的准入条件是接口节定向 diff 为空，即本轮不改变对外接口；diff 非空即须转入主链的分解设计节点。

| 通道 | 入口判据 | 阶段键 |
|---|---|---|
| A 主链 | 需求性质为主链开发或改造 | requirements、architect、check-scope、acceptance、decomposer、check-design、detail-design、check-file-design、interface-review、implement、test-plan、check-code、g5-int、test-execute、check-consistency、defect-fix、audit |
| B 快速修复 | 需求性质为已定位缺陷的快速修复 | probe、defect-fix、test-execute |
| C 自维护 | 改造对象为本仓库自身 | self-design、self-write、doc-sync、audit |

### 二 节点全集

二十一个节点，即十七个主链节点、一个快速通道独有节点、三个自维护节点。节点键为英文 kebab-case，与状态文件、注入矩阵、阶段键三处同名。

| 节点键 | 通道 | 承接方 | 产出 | 门 | 前置 |
|---|---|---|---|---|---|
| requirements | A | 需求采集者 | REQUIREMENTS.md | G1 | 无 |
| architect | A | 架构设计者 | ARCHITECTURE.md、AGENTS.md、GLOSSARY.md | G3 | requirements |
| check-scope | A | 交叉检查 | 检查结论 | 无 | architect |
| acceptance | A | 验收标准制定者 | AC.md | G2 | requirements、architect |
| decomposer | A | 设计分解者 | 目录级 DESIGN.md 树 | G4 | architect、acceptance |
| check-design | A | 交叉检查 | 检查结论 | 无 | decomposer |
| detail-design | A | 详细设计者 | 文件级 DESIGN-源文件名.md | 无 | architect、decomposer |
| check-file-design | A | 交叉检查 | 检查结论 | 无 | detail-design |
| interface-review | A | 接口契约评审者 | VERDICT | G4.5 | decomposer、detail-design |
| implement | A | 实现者 | 源码与单元测试 | G5 | interface-review |
| test-plan | A | 单元测试制定者 | 同目录 TEST.md | G5 | decomposer、detail-design |
| check-code | A | 交叉检查 | 检查结论 | 无 | implement、test-plan |
| g5-int | A | 缺陷修复者 | 集成收口结论 | G5-INT | implement |
| test-execute | A 与 B | 测试执行者 | 测试报告与缺陷路由单 | 无 | g5-int 或 defect-fix |
| check-consistency | A | 交叉检查 | 检查结论 | 无 | test-execute |
| defect-fix | A 与 B | 缺陷修复者 | 修复清单 | 无 | test-execute 或 probe |
| audit | A 与 C | 声明面审计者 | 审计报告与修剪清单 | G6 | test-execute |
| probe | B | 探查者，外部依赖 | 定位结论 | 无 | 入口判据命中通道 B |
| self-design | C | 根会话 | 改造设计文档树 | 无 | 无 |
| self-write | C | 分域写入代理 | 结构与内容改造 | 无 | self-design |
| doc-sync | C | 文档同步者 | 巡检报告 | 无 | self-write |

`implement` 与 `test-plan` 同层并行，是主链唯一并行点；`detail-design` 层内按文件并行，lane 与设计树同构。五个交叉检查节点不新立门号，其结论并入前驱所属门作子项。

### 三 边与回路

| 从 | 到 | 条件 |
|---|---|---|
| 入口 | requirements | 入口判据为主链 |
| 入口 | probe | 入口判据为快速修复 |
| probe | defect-fix | 根会话据定位结论定级并生成缺陷条目 |
| test-execute | defect-fix | C 级或 D 级，且未超轮次 |
| defect-fix | test-execute | 修复段收口，回测 |
| test-execute | decomposer | B 级，接口节 diff 将非空 |
| test-execute | requirements | A 级，须经用户确认 |
| test-execute | audit | 全绿，或未完项已登记债务与承接方 |
| audit | 收口 | G6 通过 |

| 回路 | 触发 | 回退目标 | 经用户 |
|---|---|---|---|
| 修复回路 | C 级或 D 级 | defect-fix，修完回 test-execute | 否，超限才升级 |
| 设计回路 | B 级 | decomposer，同步 AC | 否 |
| 需求回路 | A 级 | requirements | 是 |

三类回路共用两轮上限，仲裁计入轮回，超限强制升级用户。

### 四 门禁

八门，执行顺序为需求、架构、验收、分解设计、接口冻结、实现与测试规划、集成收口、测试与交付。门号只是标识，顺序以序列为唯一依据。

| 序 | 门号 | 节点 | 判据 | 证据类型 | 执行者 | 不通过处置 |
|---|---|---|---|---|---|---|
| 1 | G1 | requirements | 需求无待确认项，已与用户逐条对齐 | 判断 | 需求采集者自查 | 退回上一节点并记 `docs/gates/` |
| 2 | G3 | architect | 目录树完整、每目录有职责声明、横切规范集中定义、基础能力清单消费方非空、改造影响评估含债务承接列、设计文档树根路径已声明、AGENTS.md 与 GLOSSARY.md 初版已产出、含三行摘要 | 判断 | 架构设计者自查 | 同上 |
| 3 | G2 | acceptance | 每条 AC 可客观判定，与需求编号双向可追溯，正常边界异常三类路径均有覆盖 | 判断加机械 | 验收标准制定者自查，trace-check 由根会话运行 | 同上 |
| 4 | G4 | decomposer | 文档树覆盖全部实现目录，模块级 AC 之和覆盖总 AC，无悬空接口引用，契约表列头完整，文件级设计覆盖达标，义务条目可抽取且编号唯一 | 机械 | trace-check | 退回 |
| 5 | G4.5 | interface-review | VERDICT 为 pass，必须修复项为零 | 判断 | 接口契约评审者 | 非 pass 即阻断冻结 |
| 6 | G5 | implement、test-plan | 各接缝自测通过且失败项已按归属拆分，TEST.md 覆盖模块级 AC，高风险用例已桩化，语言编译与编码规范检查通过 | 机械 | trace-check 与 typed gate | 退回 |
| 7 | G5-INT | g5-int | 构建通过，文件粒度与设计预判一致，接口签名与契约表一致，被触碰的超限文件已治理，本阶段未执行全量测试，编码规范检查通过 | 机械 | code-health、governance-check、span-check | governance-check 判 blocked 或 span-check 判 drift 即阻断 |
| 8 | G6 | test-execute、audit | 测试全绿或未通过项已定级路由且未超轮次，声明面审计无待修剪项，审计报告已归档，冻结锚点与变更类型声明一致，结构健康恶化项逐项给出理由，AGENTS.md 与 GLOSSARY.md 已核验，债务无超期与超上限，交付门槛逐项核验 | 判断加机械 | 声明面审计者，debt-check 由根会话运行 | 未过不得交付 |

放行判据只以三类事实判定，即契约逐条被满足、边界与前置条件被遵守、异常路径被覆盖。产出者自陈不是证据。过门时按 `references/templates-gates.md` 的门禁检查单填写并写入 `<项目根>/docs/gates/`，记录须含 `GATE` 机读行；子项与记录细则见 `references/spec-gate.md`。

### 五 缺陷四级路由

| 级别 | 定义 | 去向 | 是否经用户 |
|---|---|---|---|
| D 测试级 | 计划漏场景、断言错或覆盖缺口 | 缺陷修复者改 TEST.md | 否 |
| C 实现级 | 实现偏离设计 | 缺陷修复者改代码，不改设计 | 否 |
| B 设计级 | 设计矛盾、边界不清、接口不可实现 | 回设计分解者并同步 AC | 否 |
| A 需求级 | 设计正确执行仍不满足总 AC | 回需求采集者 | 是 |

自检按固定顺序 D、C、B、A，命中即停；未命中任一级特征时取最低适用级别；同缺陷超两轮强制升级用户。仲裁并入根会话，裁决须引用具体规范条款与被批驳主张，裁决记录写入缺陷路由单的裁决节。细则见 `references/spec-gate.md`。

### 六 状态文件与编排脚本

全链状态文件为 `<项目根>/docs/.ddd-state.json`，在现行三字段上加 `channel` 与 `freezeAnchor`；损坏时中断续跑并交根会话，不得当作全新启动。字段 schema 见 `references/spec-govern.md`。

环境记录 `<项目根>/docs/.ddd-env.json` 由初始化 `node skills/ddd-methodology/scripts/env-probe.js <项目根绝对路径>` 探测生成，落四类工具的路径、版本与可用性，以及由工具推导出的各语言可用命令形态；测试与覆盖率命令由 `node skills/ddd-methodology/scripts/env-command.js <项目根绝对路径> <语言名> <test|coverage>` 读环境记录与本包该语言的命令模板组装，不得回落写死形态。该件另记测试框架事实与可选的所需版本声明；键名计数以 `skills/ddd-methodology/references/spec-govern.md` 的环境记录键集声明为准。该件随机器而异，同一仓库在不同机器上探测结果不同，纳入版本控制会互相覆盖并误导读命令组装者，故不纳入版本控制，由 `.gitignore` 排除。

编排脚本两份，置于 `scripts/`：`ddd-workflow.js` 走 A 主链，`ddd-hotfix.js` 走 B 快速修复；两者共用阶段键集与状态文件 schema，只按通道取各自键序。脚本只做编排不做机械校验，校验由根会话在编排返回后经 `ddd_*` 工具执行。卡死防护全由宿主承担，即运行级 `options.timeoutMs`、单工具 `options.toolTimeoutMs` 与间隔巡检看门狗，不自研计时器。

### 七 机械门禁

约束不得只靠提示词，派发须绑定机械证据。机械证据不受实现者自陈。

| 工具 | 用途 | 产出方 |
|---|---|---|
| `ddd_trace_check` | G4 与 G5 的证据 | 根会话 |
| `ddd_governance_check` | G5-INT 的门槛 verdict | 根会话，集成收口由缺陷修复者 |
| `ddd_span_check` | G5-INT 的签名一致性 | 根会话 |
| `ddd_code_health` | G5-INT 与审计输入 | 根会话，集成收口由缺陷修复者 |
| `ddd_debt_check` | G6 债务校验 | 根会话 |
| `ddd_metrics_report` | 迭代收尾汇总 | 根会话 |
| `ddd_coverage_check` | G6 覆盖率子项的达标判定 | 根会话 |

`root` 参数传被开发项目根的绝对路径。覆盖率以 Cobertura 兼容 XML 为唯一入参形态，由统一解析脚本判定，其达标归 G6 子项，不新立门号；报告缺失、报告不可解析与覆盖率未达阈三态均不得视为通过，阈值默认 80% 可由参数覆盖。G5-INT 与 C 级修复禁止执行全量测试套件，全量测试的唯一主体是 ddd-tester；该约束由运行时守卫在工具调用处机械拦截。脚本的输出形态、机读结论与退出码语义见 `references/spec-declare.md`。

### 八 技能元规范

1. frontmatter 至少含 `name` 与 `description`；`description` 须写清何时该读本技能，它是模型是否加载正文的唯一判据。
2. 正文按「何时用、做什么、不做什么」三段组织，不写背景叙述。
3. 单技能正文超二百行或十项契约即按注入等价类再拆；本技能触达阈值时拆出 `spec-flow`，本版不产出。
4. 技能名前缀五分：`ddd-` 标识本方法论自有对象，`governance-` 治理类，`spec-` 规范类，`lang-` 语言类，`tool-` 工具类。新增技能前须核对既有名，冲突时先发现者生效并告警。

## 不做什么

1. 不承载语言与工具规范，那些按节点注入 `lang-*` 与 `tool-*` 技能。
2. 不承载治理判据的正文：结构与粒度见 governance-code，注释与死代码见 governance-comment，文档粒度见 governance-document，声明面见 governance-declaration，只给指针。
3. 不承载产物骨架全文，骨架见 `references/templates.md`，其余模板见同目录各 `templates-*.md`。
4. 不代替判断型门禁的执行者：G1、G2、G3 与 G6 的判断型子项由指名代理自查或审计，根会话只运行机械工具并收口。
5. 不以本技能正文替代派发任务文本；关键规则须内联进派发任务或项目级指令文件。

## 条款与来源对照表

| 本技能条款 | 来源 |
|---|---|
| 三通道与入口判据、快速通道准入条件 | DESIGN-scheduling.md 第一节 |
| 二十一节点、并行点、交叉检查归并 | DESIGN-scheduling.md 第二节；DESIGN-crosscheck.md |
| 边、三类回路、两轮上限 | DESIGN-scheduling.md 第三节 |
| 阶段键、状态文件 schema | DESIGN-scheduling.md 第四节 |
| 按节点注入与注入矩阵 | DESIGN-scheduling.md 第五节 |
| 编排脚本与卡死防护 | DESIGN-scheduling.md 第六、七节 |
| 八门判据、子项与证据类型 | DESIGN-governance.md 第二节 |
| 缺陷四级路由与仲裁约束 | DESIGN-governance.md 第三节 |
| 债务与度量、触发点、证据产出方 | DESIGN-governance.md 第四、五、六节 |
| 技能元规范 | DESIGN-skills.md 第八节 |
| 技能清单与落点三分 | DESIGN-skills.md 第二、七节 |
| 派发判定与产出物对照 | spec-role.md |
| 本仓库适用边界、状态文件、演进治理 | spec-govern.md |
| 机械证据脚本消费契约 | spec-declare.md 第十四节 |
| 变更与改造分级 | spec-change.md |
| 存量重建 | spec-rebuild.md |
| 表述与术语 | spec-language.md |

## references 索引

| 文件 | 承载 |
|---|---|
| spec.md | 总索引、设计原则三条 |
| spec-role.md | 角色、派发判定与交接链 |
| spec-gate.md | 门禁记录、放行判据、四级路由细则 |
| spec-govern.md | 本仓库适用边界、状态文件 schema、结构与契约的演进治理 |
| spec-change.md | 需求变更、二次开发、渐进式改造 |
| spec-metrics.md | 绩效度量与交付门槛 |
| spec-rebuild.md | 存量重建 |
| spec-language.md | 表述与术语 |
| spec-declare.md | 结构与注释的机械证据 |
| templates-gates.md | 门禁检查单与缺陷路由单模板 |
| templates-debts.md | 债务登记簿骨架 |
| templates-project.md | 项目级指令文件与术语表模板 |
| templates-rebuild.md | 存量重建模板 |
