# 变更记录（CHANGELOG）

## v1.9.1（2026-10-15）可靠/效率/准确性优化（无新功能）

### 可靠性（reviewer/scout 双重排查）
- **P0 断点检查失败静默失效修复**：readResumeState 增加 __failed 检查并抛错，resume-check 失败不再被 String(obj) 吞成空数组静默当全新启动。
- **P1 G4.5 门被加速档绕过修复**：接口评审报告新增机读行契约 `VERDICT: pass|conditional|fail`；workflow 解析结论，非 pass（含无机读行）一律中断返回根会话复核，不再直接进实现。
- **P1 stateNote 作用域收敛**：只读代理（interface-reviewer）不再被注入写状态指令（原指示其写状态但无写工具，状态键永不落盘致每次续跑重复评审）。
- **状态键漂移统一**：process-details 主题E 的 interface-frozen 修正为与脚本一致的 interface-review。
- **状态 schema 正式化**：新增 process-details 主题H（.ddd-state.json 字段表+写入规则），SKILL.md/workflow 注释只留指针。

### 一致性（scout 双源清单清理）
- 代理计数 8 处口径统一为 8（SKILL description/前置条件/workflow 注释/4 个脚本注释/spec §2）。
- spec.md §2 职责链补入接口评审代理与 G4.5 门；§3 编辑残留重复段删除。
- SKILL.md 加速档阶段流补接口评审与 G5-INT 段；workflow 头注释同步。
- defect-routing.md 路由矩阵登记 G4.5 接口评审缺陷来源。
- decomposer 停止条件去除下游门纠缠；需求变更路径补冻结接口约束；implementer 补无静态类型语言的可操作口径与契约测试失败定级（C 自修/不可实现 B 上报）。
- stageOrder 死变量改为阶段注册表 stageRegistry。

### 准确性
- extractDefects 否定白名单扩展（0 failed/0 defects 等通过性表述不再误报中断）。
- trace-check 章节锚定正则放宽（标题允许后缀），templates.md 顶部加锚定保护注释。
- interface-reviewer 结论分级补可操作判据（结构性问题→fail，仅瑕疵→conditional）。

### 验证
workflow 模拟沙箱 10 场景回归全绿（含 VERDICT 三态拦截/断点跳过/resume 失败抛错/白名单/C+D/B/超限）；trace-check 带后缀标题回归通过。

## v1.9（2026-10-15）
- **接口先行规划（用户构思落地）**：
  - 分解设计（代理3）新增职责：将 DESIGN.md"对外接口/约定"升格为**签名级契约**（签名/参数/返回/错误语义/调用示例）。
  - **新增第 8 个子代理 ddd-interface-reviewer（接口契约评审者，只读）**：G4.5 冻结门前独立交叉审查（能力覆盖/模块间重复/缺口/依赖方向/契约质量），根会话复核后冻结。
  - **G4.5 接口冻结门**：冻结接口为硬约束，实现者逐字匹配签名；修改接口 = B 级设计变更走正式路由；测试规划者可基于冻结接口直接产出契约测试；workflow 加速档插入接口评审阶段（状态键 interface-review）。
  - DESIGN.md 模板接口章节升级为签名级表格；安装/卸载脚本清单扩为 8 个代理。

## v1.8.1（2026-10-15）可靠性与架构优化（无新功能）

### 可靠性修复（reviewer 排查）
- **P0 断点契约断裂修复**：resume-check 任务明确要求逐行输出 `DONE: <stageKey>` 机读行，状态文件损坏时输出 `STATE_CORRUPT` 并拦截（不再当全新启动静默重跑）。
- **阶段失败结构化返回**：新增 runStage 包装，任一阶段/修复任务失败不再裸抛，返回 `{__failed, failedStage, round, stateFile, error, hint}`，根会话可断点接管。
- **并行段状态竞写防护**：并行段仅实现者写状态文件（writer 唯一），测试规划者不写；test-execute 首轮补写状态。
- **测试报告机读强校验**：报告缺 `DEFECTS:{...}` 机读行、JSON 损坏、计数全 0 但散文含失败语义词（白名单除外）→ 一律按格式缺陷中断交根会话，不再猜测。
- **ddd-tester 遗留矛盾清理**：删除 v1.6"实现者与测试者同进程运行时"残留条目（与硬分离规则冲突）。

### 门禁证据可信度（P1-6）
- trace-check 锚定章节提取（DESIGN.md 的"模块级验收要点"、TEST_PLAN 的"用例清单"），变更记录等散文提及 AC 编号不再造成假通过；无章节时降级全文提取并告警。
- AC 编号格式变体（AC-1/ac-001）检测告警；目录不可读容错跳过。

### 架构优化（scout 排查）
- **权威源单一化**：缺陷四级路由唯一权威源 = defect-routing.md；修复轮次上限唯一权威源 = spec.md §4；超时建议值唯一权威源 = process-details 主题F；SKILL.md/spec.md 中重复定义改为摘要+指针。
- **主从契约**：spec.md 为唯一完整规范，process-details.md 仅展开 §7 索引表标注的专项（B/C/D/E/F），禁止引入 spec 未提及的新规则。
- **双源消除**：docs/方法论规范-v1.0.md 声明为历史定稿快照，唯一演进版为 skill references/spec.md。

## v1.8（2026-10-14）
- **设计文档树根路径声明**：ARCHITECTURE.md 模板新增硬约定章节，代理2 必须显式声明（默认 docs/design/，禁止两可措辞）；代理3 以声明为准，未声明即停止报告；G3 门新增退出条件。
- **加速档补 G5-INT 集成门**：workflow 并行段后插入集成收口检查（构建+全量单测+集成问题修复），与手工档门禁标准一致；发现接口不匹配报告 B 级缺陷。
- **门禁检查单模板**：新增 docs/gates/Gx-记录.md 模板（checkbox+证据路径+结论）；G2/G4/G5 必须附 trace-check 输出作为证据；workflow 中断时根会话读取状态文件中最近已过门记录。

## v1.7（2026-10-14）
- **实现/测试严格分离（硬规则）**：规划可并行，执行必隔离——代理5 测试规划可与实现并行（纯产出）；代理6 测试执行必须在实现全部完成过 G5 收口门后单独串行启动；代理6 与代理4 永不同段、不共用进程。SKILL/spec/workflow 注释/ddd-tester 提示词四处统一。
- **测试执行命令机读化**：TEST_PLAN 模板每用例增加"执行命令（含超时）"字段，代理6 只照抄执行禁止裸跑；缺少该字段报告 D 级缺陷。
- **workflow 状态文件+断点续跑**：每阶段写 docs/.ddd-state.json；启动时断点检查，已完成阶段自动跳过；测试报告增加机读行 DEFECTS:{...}，正则仅兜底；C/D 混合缺陷同时并行派发两类修复。
- **追溯一致性脚本**：新增 scripts/trace-check.js（随安装复制），校验 总AC↔模块AC↔TEST_PLAN 双向覆盖与悬空引用，作为 G2/G4/G5 门禁证据；复用于需求变更影响圈定。

## v1.6（2026-10-14）
- 新增主题 F 测试阻塞防护（实战反馈：实现/测试同进程切换时长耗时测试卡死进程）：
  - 代理5：测试用例分级（常规/高风险），高风险用例必须桩化或移入手动测试清单；TEST_PLAN.md 增加桩化说明与手动清单。
  - 代理6：测试命令强制带超时（单用例 60s/全量 10min 建议）；连续 2 次超时强制转手动；分批执行避免长任务独占进程；报告区分 自动通过/自动失败/手动待反馈/手动失败 四类。
  - G5 阶段门补充：计划无分级与手动清单不得过门。

## v1.5（2026-10-14）
- 规范：核心文件（SKILL.md、references、agent 定义）移除所有"版本/增补"类元信息表述，运行时内容保持纯净；变更记录统一收敛至本文件。
- 功能：实现主题 A——workflow 加速档支持缺陷自动路由轮次：测试执行后发现 C/D 级缺陷自动派发修复并重测（最多 2 轮，超限抛出交由根会话升级用户）；A/B 级缺陷始终中断 workflow 返回根会话仲裁。
- 安装脚本无变化。

## v1.4（2026-10-14）
- 增补 process-details.md：B 多模块并行实现策略（互斥接缝/一接缝一writer/集成收口）、C 需求变更流程（变更单/版本化追加/AC 双向追溯圈定影响）、D 二次开发细则强化（现状分析报告格式+对齐检查清单）、E 质量门禁（G1–G6 阶段门）。
- SKILL.md 新增门禁与需求变更章节；ddd-architect、ddd-decomposer 职责同步。

## v1.3（2026-10-14）
- 修复 workflow 脚本：沙箱无 process，改用 args.root 传项目根并加守卫；runs.run 改为 key,params 签名。
- 修复 SKILL.md 加速档调用路径（改为 <skill目录>/workflows/ddd-workflow.js）。
- 新增独立卸载脚本 uninstall.sh/uninstall.bat；安装/卸载改为固定 7 文件名清单防误删；install 支持 --check；幂等覆盖更新；bat 加 chcp 65001。
- install.sh 重写时丢失 workflows 复制步骤的回归缺陷已修复（sh/bat 均补回）。

## v1.2（2026-10-14）
- 补充 workflow 加速档：workflows/ddd-workflow.js 固定阶段自动编排；纳入安装脚本与 README。

## v1.1（2026-10-14）
- 首次实现：pi Skill（SKILL.md + references 三件套）+ 7 个子代理定义 + 文档模板库 + 缺陷四级路由细则 + 安装/卸载脚本（bat/sh）。

## v1.0（2026-10-14）
- 方法论规范最终版：决策点 1–9 全部确认（代理0 验收标准制定者、缺陷四级路由、DESIGN.md 模板字段、就近加载+上溯、横切规范集中、2 轮终止条件、实现形式为 Skill+agents+可选 workflow、DESIGN.md 粒度、二次开发现状分析仅限缺文档项目）。
