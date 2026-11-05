# 仓库结构与安装内容

本文件承载本仓库的完整目录结构与安装内容明细，是 `README.md` 的延伸。

## 仓库结构

仓库结构如下。

```
ddd-methodology/
├── README.md                     # 仓库定位与入口
├── STRUCTURE.md                  # 仓库结构与安装内容明细，本文件
├── CHANGELOG.md                  # 包变更记录（v0.1.0 起）
├── GLOSSARY.md                   # 项目术语表，术语唯一权威处，字段判据见规范「表述与术语」节
├── LICENSE                       # 许可协议（MIT）
├── package.json                  # pi package 清单：扩展、skill 与子代理入口
├── package-lock.json             # npm 依赖锁定文件
├── docs/                         # 面向读者的公开文档与维护者内部归档
│   ├── README.md                # 文档索引
│   ├── COMPATIBILITY.md         # 本包与宿主 pi 版本对应关系权威表
│   ├── guide/                   # 方法论白皮书正文
│   │   ├── ddd-methodology-whitepaper.docx
│   │   └── ddd-methodology-whitepaper.pdf
│   └── internal/                # 维护者内部档案，由 .gitignore 排除，不随公开仓库发布
├── skill/ddd-methodology/        # pi Skill，规范权威源为 references/ 下的规范文件集
│   ├── SKILL.md                  # 调度流程入口
│   ├── references/
│   │   ├── spec.md               # 规范索引入口
│   │   ├── spec-role.md          # 角色与交接
│   │   ├── spec-gate.md          # 质量门禁、缺陷四级路由
│   │   ├── spec-design.md        # 内敛次序、粒度与独立性、接口先行与冻结、并行实现与集成、实现与测试分离、测试阻塞防护
│   │   ├── spec-change.md        # 需求变更、二次开发、渐进式改造
│   │   ├── spec-declare.md       # 声明面可验证与修剪、结构与注释的机械证据
│   │   ├── spec-govern.md        # 本仓库适用边界、状态文件、结构与契约的演进治理
│   │   ├── spec-rebuild.md       # 存量重建
│   │   ├── spec-metrics.md       # 绩效度量
│   │   ├── spec-language.md      # 表述与术语
│   │   ├── templates.md          # 产物模板库
│   │   ├── templates-project.md  # 项目级指令文件与术语表模板
│   │   ├── templates-debts.md    # 存量债务登记簿模板
│   │   ├── templates-gates.md    # 门禁检查单与缺陷路由单模板
│   │   └── templates-rebuild.md  # 存量重建与定向重构产物模板
├── skill/ddd-rebuild/            # 存量重建 skill，仅由用户显式调用
│   └── SKILL.md                  # 存量重建流程入口
├── skill/ddd-refactor/           # 定向重构 skill，仅由用户显式调用
│   └── SKILL.md                  # 定向重构流程入口
├── global/
│   └── APPEND_SYSTEM.md         # 全局规则权威版本，由 extensions/ddd-context.ts 以 sections.ddd_global_rules 注入，不再改写用户全局文件
├── profiles/
│   └── models.json              # 按代理的模型配比，含实测证据与理由，不写入 agent 定义
├── workflows/
│   └── ddd-workflow.js           # 可选加速档：固定阶段自动编排脚本（args.root 传项目根）
├── agents/                       # 子代理定义（pi-subagents 格式）
│   ├── ddd-requirements.md       # 需求采集者
│   ├── ddd-acceptance.md         # 验收标准制定者
│   ├── ddd-architect.md          # 架构师
│   ├── ddd-decomposer.md         # 分解设计者
│   ├── ddd-interface-reviewer.md # 接口契约评审者（G4.5 接口冻结门）
│   ├── ddd-implementer.md        # 实现者
│   ├── ddd-test-planner.md       # 测试规划者
│   ├── ddd-tester.md             # 测试执行者
│   ├── ddd-fixer.md              # 缺陷修复者（C/D级修复循环，与实现者隔离）
│   ├── ddd-arbiter.md            # 仲裁者（缺陷定级争议，路由知识内嵌）
│   ├── ddd-doc-sync.md           # 文档同步守护者（方法论自身文档巡检）
│   └── ddd-auditor.md            # 声明面审计者（可验证性与无用代码修剪）
├── extensions/
│   ├── ddd-context.ts            # 会话上下文：注入全局规则 section，探测 subagent 前置依赖
│   ├── ddd-tools.ts              # 机械校验工具化：把甲类校验脚本注册为 ddd_* 工具
│   ├── ddd-governance.ts         # 运行时守卫，仅 DDD 项目激活，拦截越阈值写入、全量测试误跑、义务未覆盖的源码写入与未闭合义务下的门禁记录写入
│   ├── ddd-models.ts             # 模型配比命令：以 slash 命令提供用户触发入口，复用 scripts/apply-models.js
│   └── lib/
│       ├── shared.ts             # 扩展共享小工具：包根解析、执行超时、退出码归一、错误描述与安全读文本
│       ├── notify.ts             # 用户提示的单一实现：有真实 UI 走宿主通知，否则写 stderr
│       ├── notify.test.ts        # 用户提示分支选择的单元测试，node --test 运行
│       ├── version-range.ts      # pi 版本与声明范围的纯比对：版本解析、版本比较、范围满足判定
│       └── version-range.test.ts # 版本范围比对的单元测试，node --test 运行
└── scripts/
    ├── trace-check.js            # 追溯一致性校验脚本，G4 与 G5 门禁证据
    ├── apply-models.js           # 按代理模型配比的应用与可用性冒烟，仓库内部专用
    ├── migrate-to-package.js     # 旧安装迁移到 pi package：清理用户作用域的残留，仓库内部专用
    ├── code-health.js            # 结构健康度量脚本，仅报告不作门禁，写入项目内 docs/health.json
    ├── governance-check.js       # 契约指纹与结构趋势门槛校验，输出 verdict 作为 G5-INT 门槛证据
    ├── fingerprint.js            # 契约指纹唯一实现，供 trace-check 与 governance-check 共用
    ├── design-root.js            # 设计树根路径解析唯一实现，供同上两者共用
    ├── decision-tables.js        # 判定表默认分支校验库，供 ref-check 调用
    ├── ref-check.js              # 跨文档引用、常量与枚举一致性校验，本仓库文档同步链证据
    ├── span-check.js             # 签名级符合性校验：提取代码侧导出符号与 DESIGN 契约签名三态比对
    ├── install-parser.js         # 解析器按需安装入口：把锁定版本的解析器与 grammar 装到用户固定位置
    ├── roster-check.js           # 代理与 skill 清单一致性校验，供 ref-check 的 C5、C11 调用
    ├── spec-index-check.js       # 规范索引表与规范标题一致性校验，供 ref-check 的 C12 调用
    ├── install-manifest-check.js # 随包脚本集合枚举，供 ref-check 的 C17 比对安装内容明细
    ├── debt-check.js             # 存量债务登记簿超期与上限校验脚本，末行 pass 或 overdue
    ├── metrics-report.js         # 绩效度量聚合脚本，读 health.json、debts.json、gates/ 与 reports/，写 docs/metrics.json，末行 RESULT: report
    ├── toolchain-selftest.js     # 工具链自测：脚本族语法可加载、入口可运行、退出码符合基线
    └── lib/                      # 脚本共享层，供上述脚本复用
        ├── text.js               # 安全读文件、按行编号与漂移项构造三项纯函数
        ├── paths.js              # 产物路径与变更记录排除名的单一常量，供各消费脚本引用
        ├── walk.js               # 目录深度优先遍历，统一各脚本的排除集
        ├── spec-doc.js           # 规范读取面：规范文件枚举、节标题索引与节定位
        ├── ref-refs.js           # 引用形态域校验：C1 语义化节引用、C2 裸章节号、C7 脚本名
        ├── ref-constants.js      # 常量枚举域校验：C3 阈值、C6 门号、C9 守卫编号
        ├── ref-stages.js         # 阶段键域校验：C4 与 --fix 的注册表生成
        ├── ref-phrases.js        # 冻结短语域校验：C8 与锚点清单
        ├── ref-debt-fields.js    # 登记簿字段集合一致性校验：C14
        ├── ref-coverage.js       # 校验项映射一致性校验：C15
        ├── ref-line-endings.js   # 工作区行尾一致性校验：C16
        ├── ref-structure.js      # 结构树与安装内容明细一致性校验：C17
        ├── ref-convergence.js    # 收敛度校验：C19
        ├── repo-scope.js         # 方法论仓库自身判定：不适用语义的共享实现，供 trace-check 与 span-check 复用
        ├── debt-history.js       # 债务历史快照与根因复发检测
        ├── version.js            # 版本标识工具：v主.次 的解析、比较、加跨度与格式化
        ├── metrics-sources.js    # 度量来源读取面：健康与登记簿读取、目录取文件、机读行与表格解析、缺省数值归一
        ├── metrics-structure.js  # 结构与债务类度量：超阈值文件数趋势、债务未清数与超期率、同一根因复发次数
        ├── metrics-delivery.js   # 交付质量与声明面类度量：门禁一次通过率与过门轮次、返工轮次分布、缺陷四级分布与密度、无消费方声明占比、机械证据覆盖率
        ├── obligations.js        # 义务核销：设计侧条目抽取、节点表解析与差集和状态断言，供 trace-check 复用
        ├── ref-obligations.js    # 义务取值域一致性校验：C20，比对规范、模板与抽取器常量三处
        ├── truncate.js           # 输出上限回撤与装配：七个入口脚本共用的字节上限收敛
        ├── span-ast.js           # 各语言判据共享的 AST 遍历与取值工具
        ├── span-parser.js        # 解析器按需供给：固定位置解析、grammar 加载与缺失信号
        ├── span-langs.js         # 显式导出标记语言与装配：TypeScript、JavaScript、Java、Rust 的判据与分派
        ├── span-langs-convention.js # 约定式导出语言：Python 的 __all__ 与 _ 前缀、Go 的首字母大写
        ├── span-extract.js       # 提取驱动：文件与签名片段走同一提取器的规范化
        ├── span-compare.js       # 契约表读取、语言推导与三态比对
        ├── convergence-baseline.json # 收敛度基线：仓库文件数与目录数、各活文档标题数、已复核的跨文件重复
        └── toolchain-baseline.json   # 工具链自测基线：各入口脚本在本仓库的预期退出码
```

## 安装内容

本包为 pi package，资源由整仓提供，以 `pi install git:github.com/Cikaros/ddd-methodology` 安装（默认跟随默认分支），`package.json` 声明 `pi.extensions`、`pi.skills` 与 `pi-subagents.agents` 供宿主发现；随包内容如下，按随装件与其在包内的位置逐条给出。

- Skill `ddd-methodology`，目录内只含 `SKILL.md` 与 `references/`；随包脚本在 `scripts/`，加速档在 `workflows/`
  - workflow 脚本位于 `workflows/ddd-workflow.js`，供根会话以 `subagent({ workflow: ... , args: { root: "<项目根>" } })` 调用
  - trace-check 脚本位于 `scripts/trace-check.js`，作为 G4 与 G5 门禁证据
  - code-health 脚本位于 `scripts/code-health.js`，度量结构健康并写入项目内 docs/health.json，仅报告不作门禁
  - governance-check 脚本位于 `scripts/governance-check.js`，校验契约指纹与结构趋势，输出 verdict 作为 G5-INT 门槛证据
  - ref-check 脚本位于 `scripts/ref-check.js`，校验跨文档引用、常量与枚举集合一致性，供文档同步链使用
  - span-check 脚本位于 `scripts/span-check.js`，比对 DESIGN 契约签名与代码侧导出符号，输出一致、不一致、无法判定三态，仅不一致计入缺口
  - install-parser 脚本位于 `scripts/install-parser.js`，把签名级校验所需的解析器与 grammar 装到用户固定位置，仅由 `/ddd-parser-install` 命令触发
  - toolchain-selftest 脚本位于 `scripts/toolchain-selftest.js`，独立入口，断言脚本族语法可加载、入口可运行、退出码符合基线，不并入 ref-check
  - 共享层与各域校验模块位于 `scripts/lib/`（`text.js`、`walk.js`、`paths.js`、`spec-doc.js`、`ref-refs.js`、`ref-constants.js`、`ref-stages.js`、`ref-phrases.js`、`ref-debt-fields.js`、`ref-coverage.js`、`ref-line-endings.js`、`ref-structure.js`、`ref-convergence.js`、`repo-scope.js`、`debt-history.js`、`version.js`、`metrics-sources.js`、`metrics-structure.js`、`metrics-delivery.js`、`obligations.js`、`ref-obligations.js`、`truncate.js`、`span-parser.js`、`span-ast.js`、`span-langs.js`、`span-langs-convention.js`、`span-extract.js`、`span-compare.js`），供本仓库各门禁、校验与度量脚本复用
  - install-manifest-check 脚本位于 `scripts/install-manifest-check.js`，枚举仓库随包脚本集合，供 ref-check 的 C17 与安装内容明细双向比对
  - 其余门禁脚本 `fingerprint.js`、`design-root.js`、`decision-tables.js`、`roster-check.js`、`spec-index-check.js`、`debt-check.js` 与 `metrics-report.js` 同属该脚本清单，位于 `scripts/`
- 存量重建 skill `ddd-rebuild` 与定向重构 skill `ddd-refactor`，分别位于 `skill/ddd-rebuild/` 与 `skill/ddd-refactor/`，两者与主 skill 同属一份清单，仅由用户显式调用
- 运行时扩展位于 `extensions/`：`ddd-context.ts` 在会话开始时注入全局规则 section 并探测 subagent 前置依赖；`ddd-tools.ts` 把甲类机械校验脚本注册为 `ddd_*` 工具，并以 `/ddd-parser-install` 命令提供解析器供给的用户触发入口；`ddd-governance.ts` 仅在含 docs/design 或 docs/gates 的项目内激活，对其他项目静默，激活后承担 H-1 至 H-4 四项拦截与启动时未闭合义务节点注入；`ddd-models.ts` 以 slash 命令 `/ddd-models` 提供模型配比的用户触发入口，转交仓库内部专用脚本 apply-models.js，不注册为工具；四者共用的纯工具（包根解析、执行超时、退出码归一、错误描述与安全读文本）集中在 `extensions/lib/shared.ts`，pi 版本与声明范围的纯比对集中在 `extensions/lib/version-range.ts` 并配套单元测试 `extensions/lib/version-range.test.ts`，四处宿主提示的单一实现集中在 `extensions/lib/notify.ts` 并配套单元测试 `extensions/lib/notify.test.ts`，该子目录无 index.ts，不作为扩展入口加载
- 全局规则由 `extensions/ddd-context.ts` 以 sections 注入，不再改写用户全局文件
- 模型配比记录文件 `~/.pi/agent/.ddd-model-overrides.json`，记录本方法论写入的代理、配比名与写入前原值，供精确回退；模型配比经扩展的 `/ddd-models` 命令转交仓库内部专用脚本 apply-models.js 应用或撤回
- 12 个 agent 定义，位于 `agents/ddd-*.md`
