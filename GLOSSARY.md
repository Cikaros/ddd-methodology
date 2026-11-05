# 术语表

本仓库术语的唯一权威处，供使用者与维护者对齐用词。字段与必填项判据见规范「表述与术语」节。类别取领域标准词、项目术语、自造词三值；自造词附例子与落地锚点。

| 术语 | 类别 | 指什么 | 不指什么 | 落地锚点 | 白话解释 |
|---|---|---|---|---|---|
| 分治式设计驱动开发 | 自造词 | 把单份巨型设计文档按目录拆成同构小文档，并由固定职责子代理分工推进的开发方式 | 不指领域驱动设计 | `skills/ddd-methodology/SKILL.md` | 设计文档跟着代码目录走，一份目录一份文档，例如 `docs/design/core/http/` 对应 `core/http/` 代码目录 |
| 三通道 | 项目术语 | 调度模型的三条入口路线，即主链、快速修复与自维护，入口判据决定去向 | 不指阶段键或门号 | `skills/ddd-methodology/SKILL.md` | 同一套方法论按任务性质走的三条不同路线 |
| 注入矩阵 | 项目术语 | 以节点为键，按约束、语言、工具三维给出该节点可得技能集与读取时机的矩阵 | 不指技能正文本身 | `skills/ddd-methodology/assets/injection-matrix.json` | 哪个节点该看到哪些技能的一张对照表 |
| 交叉检查 | 项目术语 | 五个节点交出后立即执行的机械校对，结论并入前驱所属门作子项 | 不指事后评审 | `skills/ddd-methodology/scripts/lib/cross-check.js` | 交出产物后当场机器核对，不等到事后评审 |
| 设计文档树 | 项目术语 | `docs/design/` 下与代码目录严格同构的 DESIGN.md 集合 | 不指 `docs/` 下的内部归档 | `skills/ddd-methodology/scripts/design-root.js` | 设计文档的目录结构与代码目录一一对应 |
| 冻结锚点 | 项目术语 | 冻结时刻的 git commit 引用，记于设计文档树的冻结清单 `docs/design/FREEZE.json`，作为变更判定的比对基线 | 不指对接口节取哈希所得的契约指纹，该机制已废弃 | `skills/ddd-methodology/scripts/lib/freeze.js` | 接口冻结时记下的 git 定位点，用它与「对外接口与约定」节的定向 diff 判断接口有没有被改动 |
| 声明面 | 项目术语 | 接口契约、公开导出、能力清单、规则条款、配置项、模板字段与依赖项的总称 | 不指运行时产生的数据 | `skills/ddd-methodology/assets/agent-templates/ddd-auditor.md` | 项目对外作出的全部承诺 |
| 机械证据 | 项目术语 | 可由脚本或工具复现的门禁证据 | 不指代理的文字自查 | `extensions/ddd-tools.ts` | 机器跑出来的结论，不接受口头自陈 |
| 判断型证据 | 项目术语 | 由指名代理按判据给出的门禁证据 | 不指脚本输出 | `skills/ddd-methodology/references/spec-gate.md` | 由指定角色判断后给出的结论 |
| 内敛次序 | 自造词 | 准确、规则内敛、设计内敛、文件内敛、测试内敛、token 内敛的固定次序 | 不指代码风格偏好 | `skills/ddd-methodology/references/spec-design.md` | 先保证准确，再让规则与结构不随迭代发散，例如同一规则在两处并列定义即违反第二层 |
| 接缝 | 项目术语 | 并行实现时按依赖约束图划分出的互斥工作边界 | 不指代码里的函数拆分 | `skills/ddd-methodology/references/spec-design.md` | 并行开发时各人负责的互不重叠的部分 |
| 粒度阈值 | 项目术语 | 代码文件 500 行、基础或核心模块 300 行、文档 200 行或 10 项契约 | 不指可自由调整的建议值 | `skills/ddd-methodology/scripts/code-health.js` | 单个文件与文档的规模上限 |
| 收敛度 | 自造词 | 仓库文件数、文档标题数与跨文件规则重复不随迭代增长的度量 | 不指运行时性能 | `skills/ddd-methodology/scripts/lib/ref-convergence.js` | 项目规模不随迭代膨胀，例如新增文件须在结构树与收敛基线中登记 |
| 缺陷四级路由 | 项目术语 | A、B、C、D 四级缺陷的定级与去向 | 不指缺陷严重度排序 | `skills/ddd-methodology/references/spec-gate.md` | 按缺陷性质决定谁来修 |
| 不适用语义 | 项目术语 | 判定对象不存在时报告不适用而非缺口的口径 | 不指校验被跳过 | `skills/ddd-methodology/scripts/lib/repo-scope.js` | 没有可检查的对象时明确说没有，不假装通过 |
| 术语表 | 项目术语 | 项目根 `GLOSSARY.md`，本项目术语的唯一权威处 | 不指本仓库的规范正文 | `GLOSSARY.md` | 定义本项目用词的唯一位置 |
| 任务树 | 项目术语 | 按设计文档树同构的树形看板，含里程碑、模块、义务与执行四类节点，是周期内的中间态产物 | 不指长期档案 | `skills/ddd-methodology/scripts/lib/obligations.js` | 任务推进过程中的树形清单，周期结束即丢弃 |
| 义务核销 | 项目术语 | 设计侧可执行义务逐条编号并在节点上勾销，已核销为终态 | 不指缺陷定级与路由 | `skills/ddd-methodology/scripts/lib/obligations.js` | 设计里写了什么，就必须逐条做了或登记未做 |
| 交付门槛 | 项目术语 | 交付前须逐项满足的量化判据，含用例覆盖完备率、三类路径覆盖、回归拦截完备率、缺陷密度不恶化与义务核销完备率 | 不指仅作趋势记录的度量 | `skills/ddd-methodology/scripts/metrics-report.js` | 交付前必须达标的几条硬指标 |
| 可观测性契约 | 项目术语 | DESIGN 声明的关键路径可观测性锚点，含日志标识、trace 上下文传播、metric 名称与单位、失败可观测性 | 不指宿主 pi 的 worktree、control 与 frontmatter 类声明 | `agents/ddd-interface-reviewer.md` | 接口上线后能否被定位与观测的承诺 |
| 提示模板 | 项目术语 | `prompts/` 下的流程入口模板，一个文件一个命令，正文只写入口与指针 | 不指流程规则正文 | `prompts/ddd-init.md` | 一个斜杠命令对应一份短提示 |
| 项目级代理 | 项目术语 | 审计者与文档同步者两份定义，落被开发项目 `.pi/agents/`，插件只供模板 | 不指随包固定代理 | `skills/ddd-methodology/assets/agent-templates/ddd-auditor.md` | 初始化后归项目自己维护的两个代理 |
