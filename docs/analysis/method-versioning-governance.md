# 方法版本控制与结构治理改造设计

本文是方法论自身的改造设计，主题为引入契约指纹与结构治理义务，并以 pi 扩展作为硬门禁。它不描述被开发项目的产物，只描述本方法论仓库自身的规范与工具如何改动。

## 1. 问题

执行者倾向于持续堆叠代码与文档，不为存量结构做治理。表现有三：

1. 新增能力时按最小改动落位，已超粒度阈值的文件继续增长。
2. 契约被顺手修改，不留下任何需要解释的痕迹。
3. DESIGN 只增不改，父级文档积累子场景细节而不拆解。

## 2. 根因诊断

结论：这不是意愿不足，是规范给出的激励结构所致。三处证据。

### 2.1 治理条款全是防御性的

现有五条治理条款的语义都是"不要制造新的坏结构"。

| 条款 | 出处 | 性质 |
|---|---|---|
| 遵守粒度预判，接近阈值时停止并报告 | agents/ddd-implementer.md:29 | 准入禁令 |
| 不得合并已拆解文件，不得创建未规划超大单文件 | agents/ddd-implementer.md:29 | 准入禁令 |
| 禁止无用声明 | agents/ddd-implementer.md:33 | 准入禁令 |
| 清理义务，限于连续注释代码与兼容层标记 | agents/ddd-implementer.md:39 | 存量清理，被动 |
| 粒度与独立性约束 | agents/ddd-implementer.md:3 | 准入禁令 |

没有任何一条要求主动改善已经存在的坏结构。而存量重构只出现在 spec §11 的 L1 至 L5 阶梯，其触发者写为根会话，依据审计报告在 G6 后派发。L1 的规范定义为"实现者自行完成并记变更记录"，但这条 L1 只存在于 spec §11，未写入任何代理定义，执行者看不到自己的这份义务。

结果是责任真空：执行者把问题上报而不治理，根会话没有用户驱动就不会主动发起改造。

### 2.2 重构没有安全网

初版 ddd-tester 定义全篇为执行与定级路由，不涉及"本次改动是否改变了行为"。结构改动若无意中改了行为，规范内无人负责发现。执行者面对的成本收益是：重构收益归未来，成本归当下，风险无人兜底，理性选择即堆叠。

### 2.3 治理规则与执行者不在同一视窗

本方法论靠上下文分治压缩子代理负担，代理只加载本阶段所需。治理规则集中在 spec §4、§11、§12，而执行者的输入是就近 DESIGN 与横切规范。规范越写越全，执行者越看不到。因此新规则必须内联进代理定义，不能只放在 spec。

## 3. 核心转译

方法级版本控制的原意是让新旧实现共存，而本方法论消费方无状态，共存无收益。可用的部分是它的副产品：版本化把"改变"变成必须声明的事件，而堆叠的本质正是隐式改变。

由此得到贯穿本改造的公式：

```
结构自由，契约受控
重构     = 契约指纹不变 + 行为用例全绿 + 结构度量改善
行为变更 = 契约指纹变化 → 必须递增契约版本 → 走 B 级路由并同步 AC
```

契约指纹取契约表内容的哈希，版本号由指纹前八位派生。指纹承担三个角色：重构许可、堆叠探测器、等价性判据。

选择哈希而非手写版本号，理由是手写版本号依赖人递增，必漏；哈希可机械复算，且能覆盖"改了却未申报"这一最典型的堆叠手法。

## 4. 落点清单

### 4.1 契约指纹锚点

| 落点 | 改动 |
|---|---|
| references/templates.md DESIGN 节 | 契约段增契约指纹行，新增变更记录节字段定义 |
| references/templates.md 门禁检查单节 | G4.5 与 G5 记录附指纹 |
| agents/ddd-decomposer.md | 产出契约时计算并写入指纹 |
| agents/ddd-interface-reviewer.md | 判据补缺指纹判 conditional |
| references/spec.md §5 | 明确冻结产物是契约指纹快照 |
| scripts/trace-check.js | 增加指纹一致性校验，作为 G4 与 G5 机械证据 |

### 4.2 触碰即治理

治理义务绑定到执行者必经的路径，即它必然会触碰文件，因此不存在漏网之鱼，且成本与改动量成正比。

| 落点 | 改动 |
|---|---|
| agents/ddd-implementer.md 硬约束 | 清理义务扩展为结构治理义务 |
| agents/ddd-implementer.md 职责 | 接近或超阈值且本轮已触碰时先按 DESIGN 粒度预判拆解，无法拆解才上报 |
| agents/ddd-implementer.md 输出契约 | 完成报告由三节扩为四节，增结构治理回执，空节不得声明完成 |
| agents/ddd-fixer.md 硬约束 | 同步该义务 |
| references/spec.md §11 | 明确 L1 的默认执行者是触碰该文件的写入者，L2 及以上仍由根会话派发 |

防护：拆解不得超出 DESIGN 的粒度预判，超出即属设计偏离，走 B 级。L2 及以上沿用 §11 的"一次迭代只做一个级别"。

### 4.3 重构等价性验证

| 落点 | 改动 |
|---|---|
| agents/ddd-tester.md 输入与职责 | 增加变更性质判定：指纹不变即重构，须验证用例集合未减少且全绿；指纹变化即行为变更，须核对版本递增与 AC 同步，未同步判 B 级 |
| agents/ddd-tester.md 输出契约 | 报告增重构等价性节 |
| agents/ddd-auditor.md 审计范围 | 增契约指纹与变更类型声明的一致性核验 |
| scripts/code-health.js | 输出增被触碰文件规模变化与超阈值文件趋势 |

判据要点：测试用例集合的变动方向本身是行为变更信号。声称重构却减少用例或改断言，即堆叠。

## 5. 硬门禁：声明式门禁为主，运行时守卫为辅

前四节均为提示词级约束，遵守率依赖模型自觉。机械约束才是不偏离的可靠途径，而 pi 提供两条路径，覆盖范围不同，选型前必须明确。

### 5.1 覆盖矩阵

| 路径 | 载体 | 根会话 | 前台子代理 | 后台子代理 |
|---|---|---|---|---|
| 声明式门禁 | 代理 frontmatter 与派发 options 的 acceptance、gate、outputSchema、permission | 不适用 | 生效 | 生效 |
| 运行时守卫 | `<agent-dir>/extensions/` 的 tool_call 等钩子 | 生效 | 不加载 | 默认加载 |

前台子代理从不加载 ambient 扩展，后台子代理默认加载，依据为 pi-subagents 的加载判定与 agents 文档的 extensions 字段说明。若代理 frontmatter 写了 extensions 字段，则 ambient 加载关闭。因此机械约束以声明式门禁为主，守卫只补充声明式覆盖不到的过程拦截。

### 5.2 声明式门禁

| 机制 | 语义 | 本方法论的用途 |
|---|---|---|
| acceptanceRole | read-only 或 writer，决定自动推断的验收级别 | 写入类代理标 writer，审计与评审类标 read-only |
| acceptance.evidence | 必需证据种类 | 强制完成报告含实现文件清单、自测结果与约定遵循等节 |
| acceptance.review | 独立评审门，评审报 blockers 即 rejected | 审计与接口评审 |
| acceptance.report | 要求子代理产出结构化验收报告，缺失重试一次后判失败 | 完成报告缺节不得声明完成 |
| gate | 宿主执行单条命令作为验收 | 跑 trace-check 与 governance-check |
| typed gate | gate 加 output json 与 schema | 校验 verdict 字段 |
| permission | write 与 edit 的 allow、ask、deny | 收紧写入面 |

bash 类规则被拒绝且 bash 恒放行，故命令级约束不可用 permission 实现。

落点：六个代理增 acceptanceRole，写入类四个增 acceptance 证据声明；新增 scripts/governance-check.js 作为门槛校验，由根会话按需派发，或在命令路径可确定时经 acceptance.verify 挂载。workflow 加速档不接入，理由见 §9。

governance-check 校验三项可机械判定事项：各 DESIGN 的契约指纹齐备且与契约表内容一致；docs/health.json 最新一条相对上一条超阈值文件数未增加；变更记录节已填写变更类型。

### 5.3 运行时守卫

新增 extensions/ddd-governance.ts，只在项目含 docs/design 或 docs/gates 时激活，对非 DDD 项目静默。

| 编号 | 触发点 | 判定 | 动作 |
|---|---|---|---|
| H-1 | tool_call 的 write 或 edit | 写入后越过 500 行粒度阈值，且文件内未显式声明运行时例外 | block，附就近 DESIGN 路径与拆解要求 |
| H-2 | tool_call 的 bash | 阶段为 G5-INT 且命令为全量测试 | block，指明全量测试唯一主体为 ddd-tester |

H-1 与 H-2 直接对应结构治理与测试分离两条规则。C 级修复阶段的 lastStage 与测试执行相同，无法机械区分，故 H-2 只覆盖 G5-INT，修复阶段的全量测试约束由 ddd-fixer 职责承接。守卫任何异常一律放行并记警告，不得阻断正常工具。

原设 H-3 收尾守卫，实机验证发现 agent_before_settle 的事件仅含 type、outcome、entries、continue、context，不含回复文本，无法机械判定报告是否缺节，故移除；结构治理回执的强制改由八个写入类代理的输出契约与声明式门禁承接。

## 6. 挂门设计

spec §2 元规则规定未挂门的条款属指导性条款，不得作为验收依据。因此本改造每一条都必须挂门，否则写完即死。

| 门 | 新增退出条件 | 证据源 |
|---|---|---|
| G4 | 契约指纹已记录且可机械复算 | trace-check 脚本，可作为 typed gate 挂载 |
| G4.5 | 契约指纹齐备，变更类型已声明 | 指名 ddd-interface-reviewer 加声明式门禁 |
| G5 | 契约指纹变化时用例集合未逆向缩减 | trace-check 脚本，可作为 typed gate 挂载 |
| G5-INT | 被触碰的超限文件已完成治理或给出拒绝理由，结构治理回执齐备 | code-health 与 governance-check 加指名 ddd-fixer |
| G6 | 契约指纹与变更类型声明一致，测试用例集合未逆向缩减 | 指名 ddd-auditor 加 acceptance review |

G5-INT 那条是本改造的受力点，它使"重构"从呼吁变为过门条件，且证据源是脚本度量而非自我声明。

## 7. 风险与边界

| 风险 | 评估与防护 |
|---|---|
| 为重构而重构，做无意义拆分 | 拆解须在 DESIGN 粒度预判内，超出走 B 级；interface-reviewer 已有粒度合规检查承接 |
| 门禁误伤，方法论不可用 | 只拦机械可判定项；其余为提醒；守卫仅在 DDD 项目激活；覆盖矩阵见 5.1，前台子代理只靠声明式门禁 |
| 扩展在前台子代理不生效 | 已由覆盖矩阵承接，机械约束以声明式门禁为主，不依赖扩展加载 |
| 扩展抛错阻断正常工具 | tool_call 抛错即阻断，属 fail-safe，故扩展必须全量 try 包裹，任何异常一律放行并记警告 |
| token 成本上升 | 成本绑定被触碰文件，与改动量成正比；结构恶化是复利支出，早治更省 |
| 契约指纹成为无消费方声明 | 消费方为 trace-check 校验与 auditor 核验，满足 §12 铁律 |
| L1 义务与一轮一级冲突 | 条款须写明 L1 不受一轮一级约束，该约束只针对 L2 及以上 |
| 文档侧同样堆叠 | 同轮补齐 DESIGN 粒度拆解的执行者与触发点，写入 spec §11 |

## 8. 实施顺序

1. 规范侧：references/spec.md 补 §5 指纹、§11 L1 执行者、新增 §16 结构治理；references/templates.md 补契约指纹行、变更记录字段、架构改造表列与门禁记录项。
2. 代理侧：按第 4 节逐条修订六个代理定义，补 acceptanceRole，写入类四个补 acceptance 声明。
3. 工具侧：scripts/trace-check.js 增指纹校验，scripts/code-health.js 增趋势项，新增 scripts/governance-check.js 作为 typed gate 命令。
4. 门禁侧：新增 extensions/ddd-governance.ts，安装与卸载脚本纳入该文件。workflow 传 gate 属未实现落点。
5. 入口与记录：SKILL.md 与 README.md 同步，CHANGELOG.md 登记。
6. 验证：ddd-doc-sync 巡检跨文件一致性，ddd-auditor 审计新增声明是否均有消费方与门禁承接。

## 9. 已确认事实与待确认项

已确认事实，均来自实机验证：

1. **声明式门禁端到端生效**。frontmatter 的 acceptance 被注入子代理提示词，子代理产出合规的 acceptance-report；后台子代理确实加载 ambient 扩展。
2. **acceptanceRole 为 writer 会触发异步评审推断**，需在 acceptance 里显式设 review.required 为 false 才能关闭，实测提示词由 Review gate: required 变为 optional。
3. **gate 与 frontmatter acceptance 不冲突**，gate 优先且宿主执行命令并将 evidenceStatus 置为 verified；但 gate 归一化会覆盖 frontmatter 的 review 设置，导致评审要求被加回。
4. **宿主执行的 verify 命令不经 shell**，`~` 不展开，引号亦不可依赖；实测子代理在 shell 中运行同一命令成功，而宿主验收失败并置为 rejected。故 workflow 不接入 gate 与 verify，该证据由 ddd-fixer 的职责自查与 G5-INT 记录要求承接。
5. **agent_before_settle 的事件不含回复文本**，键仅为 type、outcome、entries、continue、context，无法机械判定报告是否缺节，H-3 因此移除。

待确认项：

1. typed gate 要求命令 stdout 输出单个 JSON 文档且不超过 12000 字符，governance-check 已按 UTF-8 字节收缩，待实机确认消费端口径。
2. 扩展以仓库内文件形式随安装脚本复制，还是改为 pi package 分发。前者与现有安装机制一致，后者可复用版本管理但需引入 package.json。
