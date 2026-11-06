# 仓库结构与安装内容

本文件承载本仓库的完整结构与安装内容明细，是 `README.md` 的延伸。结构树与随装脚本集合由 `skills/ddd-methodology/scripts/ref-check.js` 的 C17 双向核对，故须与实物逐条一致；资源声明字段的依据见设计分册 DESIGN-structure.md。

## 仓库结构

结构依 pi 官方包规范：官方资源用约定目录名并在 `package.json` 声明，非资源内容内收至技能目录，代理目录由 pi-subagents 生态声明。树中目录若已列出子项即逐项展开，未列子项者为未展开目录。

```
ddd-methodology/
├── AGENTS.md  # 项目级指令文件，五节，逐字注入子代理常驻上下文
├── CHANGELOG.md  # 变更记录，按发布版本续写
├── GLOSSARY.md  # 术语表，本仓库术语唯一权威处
├── LICENSE  # 许可协议，MIT
├── package-lock.json  # npm 依赖锁定文件
├── package.json  # pi 清单：extensions、skills、prompts 与 pi-subagents.agents
├── README.md  # 仓库定位与入口
├── STRUCTURE.md  # 结构与安装内容明细，本文件
├── agents/  # pi-subagents 生态：十个固定代理定义
│   ├── ddd-acceptance.md  # 验收标准制定者
│   ├── ddd-architect.md  # 架构设计者
│   ├── ddd-decomposer.md  # 设计分解者
│   ├── ddd-detail-designer.md  # 详细设计者
│   ├── ddd-fixer.md  # 缺陷修复者
│   ├── ddd-implementer.md  # 实现者
│   ├── ddd-interface-reviewer.md  # 接口契约评审者
│   ├── ddd-requirements.md  # 需求采集者
│   ├── ddd-test-designer.md  # 单元测试制定者
│   └── ddd-tester.md  # 测试执行者
├── docs/  # 仓库文档，非 pi 资源
│   ├── COMPATIBILITY.md  # 宿主与插件版本范围声明
│   ├── README.md  # 文档分层说明
│   └── internal/  # 维护者内部档案，随 .gitignore 排除，不随公开仓库发布
├── extensions/  # 官方资源，声明于 pi.extensions
│   ├── lib/  # 扩展共享纯函数与其单元测试，非扩展入口
│   ├── rules/  # 全局规则本体，扩展读取后注入，非扩展入口
│   │   └── global-rules.md  # 全局规则正文
│   ├── ddd-context.ts  # 全局规则注入、前置依赖探测、版本比对与任务引导
│   ├── ddd-governance.ts  # 运行时守卫 H-1 至 H-7 与未完成项注入
│   ├── ddd-resources.ts  # 按注入矩阵裁剪可得技能集与技能路径供给
│   └── ddd-tools.ts  # 机械证据工具与交叉检查工具的注册
├── skills/  # 官方资源，声明于 pi.skills，递归发现含 SKILL.md 的目录
├── skills/ddd-methodology/  # 主技能：调度流程、门禁规则、技能元规范
│   ├── assets/  # 模板、注入矩阵与配置基线
│   │   ├── agent-templates/  # 两份项目级代理模板
│   │   │   ├── ddd-auditor.md  # 声明面审计者模板
│   │   │   └── ddd-doc-sync.md  # 文档同步者模板
│   │   ├── project-templates/  # 两份项目级规范文档模板
│   │   │   ├── AGENTS.md  # 项目级指令文件模板
│   │   │   └── GLOSSARY.md  # 项目术语表模板
│   │   ├── check-items.json  # 交叉检查的检查项清单
│   │   └── injection-matrix.json  # 三维注入矩阵
│   ├── references/  # 流程与治理规范正文
│   │   ├── spec-change.md  # 需求变更、二次开发与渐进式改造
│   │   ├── spec-declare.md  # 声明面可验证与修剪、结构与注释的机械证据
│   │   ├── spec-design.md  # 内敛次序、接口冻结、并行实现与测试分离
│   │   ├── spec-gate.md  # 门禁记录、放行判据与四级路由细则
│   │   ├── spec-govern.md  # 适用边界、状态文件与演进治理
│   │   ├── spec-language.md  # 表述与术语
│   │   ├── spec-metrics.md  # 绩效度量与交付门槛
│   │   ├── spec-rebuild.md  # 存量重建
│   │   ├── spec-role.md  # 角色、派发判定与交接链
│   │   ├── spec.md  # 总索引与设计原则
│   │   ├── templates-debts.md  # 存量债务登记簿模板
│   │   ├── templates-gates.md  # 门禁检查单与缺陷路由单模板
│   │   ├── templates-project.md  # 项目级指令文件与术语表模板
│   │   ├── templates-rebuild.md  # 存量重建与定向重构产物模板
│   │   └── templates.md  # 产物模板库
│   ├── scripts/  # 机械证据脚本与编排脚本
│   │   ├── lib/  # 脚本共享层与各域校验模块
│   │   ├── check-code.js  # 实现交出后的导出符号与用例覆盖校验
│   │   ├── check-consistency.js  # 测试执行交出后的命名、计数与引用校验
│   │   ├── check-design.js  # 分解设计交出后的契约表与设计树校验
│   │   ├── check-file-design.js  # 文件级设计交出后的清单与契约一致性校验
│   │   ├── check-scope.js  # 架构交出后的集合同一与顺序一致校验
│   │   ├── code-health.js  # 结构健康度量，仅报告
│   │   ├── coverage-check.js  # 覆盖率统一解析，读 Cobertura XML 判阈
│   │   ├── ddd-hotfix.js  # B 快速修复编排脚本
│   │   ├── ddd-workflow.js  # A 主链编排脚本
│   │   ├── debt-check.js  # 债务登记簿的结构、上限与时效校验
│   │   ├── decision-tables.js  # 判定表默认分支校验库
│   │   ├── design-root.js  # 设计树根路径解析唯一实现
│   │   ├── env-command.js  # 命令组装入口，读环境记录与语言命令模板出可执行命令
│   │   ├── env-probe.js  # 环境探测入口，写 docs/.ddd-env.json
│   │   ├── governance-check.js  # G5-INT 的接口节定向 diff 与结构趋势门槛
│   │   ├── install-manifest-check.js  # 随包脚本集合枚举
│   │   ├── install-parser.js  # 解析器按需安装入口，命令 /ddd-parser-install
│   │   ├── matrix-check.js  # 注入矩阵与技能清单的一致性校验
│   │   ├── metrics-report.js  # 五类度量的聚合报告
│   │   ├── ref-check.js  # 本仓库文档同步链的一致性校验
│   │   ├── roster-check.js  # 代理清单与 skill 清单的一致性校验库
│   │   ├── span-check.js  # G5-INT 的签名级符合性证据
│   │   ├── spec-index-check.js  # 规范索引表与实际标题的一致性校验库
│   │   ├── toolchain-selftest.js  # 脚本族的可加载性与退出码自证
│   │   └── trace-check.js  # G4 与 G5 的追溯一致性证据
│   └── SKILL.md  # 唯一常驻入口
├── skills/governance-code/  # 治理类：结构、粒度、独立性与触碰即治理
│   ├── references/
│   │   └── code-governance.md
│   └── SKILL.md
├── skills/governance-comment/  # 治理类：注释纪律与死代码清理
│   ├── references/
│   │   └── comment-rules.md
│   └── SKILL.md
├── skills/governance-declaration/  # 治理类：声明面可验证与修剪
│   ├── references/
│   │   └── declaration-rules.md
│   └── SKILL.md
├── skills/governance-document/  # 治理类：文档粒度与结构约定
│   ├── references/
│   │   └── document-rules.md
│   └── SKILL.md
├── skills/lang-java/  # 语言类：Java
│   ├── assets/
│   │   ├── checkstyle.xml
│   │   ├── commands.json  # 测试与覆盖率命令模板，候选集形式
│   │   └── jacoco-rules.xml  # JaCoCo 覆盖率阈值规则片段
│   └── SKILL.md
├── skills/lang-javascript/  # 语言类：JavaScript
│   ├── assets/
│   │   ├── commands.json  # 测试与覆盖率命令模板，候选集形式
│   │   ├── coverage.config.mjs  # 覆盖率启用、Cobertura 报告与阈值
│   │   └── eslint.config.mjs
│   └── SKILL.md
├── skills/lang-md/  # 语言类：Markdown 写作约束
│   ├── assets/
│   │   └── markdownlint.json
│   └── SKILL.md
├── skills/lang-powershell/  # 语言类：PowerShell
│   ├── assets/
│   │   ├── commands.json  # 测试与覆盖率命令模板，候选集形式
│   │   ├── PesterConfig.ps1  # Pester 覆盖率配置片段
│   │   └── PSScriptAnalyzerSettings.psd1
│   └── SKILL.md
├── skills/lang-python/  # 语言类：Python 语义约束与配置资产
│   ├── assets/
│   │   ├── commands.json  # 测试与覆盖率命令模板，候选集形式
│   │   ├── coveragerc  # coverage.py 阈值与 Cobertura 输出
│   │   ├── mypy.ini
│   │   └── ruff.toml
│   └── SKILL.md
├── skills/lang-shell/  # 语言类：Shell
│   ├── assets/
│   │   ├── commands.json  # 测试与覆盖率命令模板，候选集形式
│   │   ├── coverage-README.md  # kcov 无门禁与统一解析接入说明
│   │   └── shellcheckrc
│   └── SKILL.md
├── skills/lang-typescript/  # 语言类：TypeScript
│   ├── assets/
│   │   ├── commands.json  # 测试与覆盖率命令模板，候选集形式
│   │   ├── coverage.config.mjs  # 覆盖率启用、Cobertura 报告与阈值
│   │   ├── eslint.config.mjs
│   │   └── tsconfig.strict.json
│   └── SKILL.md
├── skills/spec-acceptance/  # 规范类：AC 可判定性与三类路径覆盖
│   └── SKILL.md
├── skills/spec-architecture/  # 规范类：结构规划、横切规范与能力清单
│   └── SKILL.md
├── skills/spec-contract/  # 规范类：契约表、文件级清单与冻结规则
│   └── SKILL.md
├── skills/spec-defect-routing/  # 规范类：四级定级与轮回上限
│   └── SKILL.md
├── skills/spec-diagnosis/  # 规范类：缺陷根因定位纪律
│   ├── references/
│   │   └── loop-methods.md
│   └── SKILL.md
├── skills/spec-requirements/  # 规范类：需求表述与澄清记录
│   └── SKILL.md
├── skills/spec-test-case/  # 规范类：用例设计与覆盖
│   └── SKILL.md
├── skills/tool-bash/  # 工具类：宿主 bash 易错用法与脚本调用约定
│   └── SKILL.md
├── prompts/  # 官方资源，声明于 pi.prompts，一文件一命令
├── prompts/ddd-init.md  # 初始化入口，命令 /ddd-init
├── prompts/ddd-parser-install.md  # 解析器安装入口，命令 /ddd-parser-install
├── prompts/ddd-rebuild.md  # 存量重建入口，命令 /ddd-rebuild
├── prompts/ddd-refactor.md  # 定向重构入口，命令 /ddd-refactor
└── .pi/  # 项目本地配置
    └── agents/  # 项目级代理定义，初始化落盘后归项目所有
        ├── ddd-auditor.md  # 声明面审计者
        └── ddd-doc-sync.md  # 文档同步者
```

## 安装内容

本包为 pi package，资源由整仓提供，以 `pi install git:github.com/Cikaros/ddd-methodology` 安装，默认跟随默认分支。`package.json` 是资源声明的唯一来源，声明 `pi.extensions`、`pi.skills`、`pi.prompts` 与 `pi-subagents.agents` 四组路径，宿主据此发现资源。随装内容如下。

- 扩展四模块，位于 `extensions/`：`ddd-context.ts` 注入全局规则 section、探测 pi-subagents 前置依赖、比对宿主版本并在代理启动时注入任务引导；`ddd-governance.ts` 仅在含 `docs/gates` 或声明了设计树根的项目内激活，承担 H-1 至 H-7 七项守卫与未完成项注入，对普通项目静默；`ddd-tools.ts` 把机械证据脚本与五个交叉检查脚本注册为 `ddd_*` 工具，并以命令入口转交解析器安装；`ddd-resources.ts` 按注入矩阵裁剪可得技能集并向宿主供给技能目录路径。四者共用纯函数集中在 `extensions/lib/`，纯函数单元测试与扩展入口、工具面的静态不变量回归（`entry-consistency.test.ts`）同目录；全局规则本体在 `extensions/rules/global-rules.md`，由 `ddd-context.ts` 读取后注入，不改写用户全局文件。
- 主技能 `skills/ddd-methodology/`，目录内只含 `SKILL.md` 与 `references/`、`scripts/`、`assets/` 三子目录；随包脚本在 `scripts/`，模板与配置基线在 `assets/`。
- 随包脚本位于 `skills/ddd-methodology/scripts/`。五个交叉检查脚本在对应节点交出后立即机械校对：`check-scope.js` 对架构、`check-design.js` 对分解设计、`check-file-design.js` 对文件级设计、`check-code.js` 对实现与测试规划、`check-consistency.js` 对测试执行。机械证据入口七个：`trace-check.js` 作 G4 与 G5 的追溯一致性证据；`span-check.js` 比对契约签名与代码导出符号，输出一致、不一致与无法判定三态；`governance-check.js` 校验接口节定向 diff 与结构趋势并输出 verdict；`code-health.js` 度量结构健康，仅报告；`debt-check.js` 校验债务登记簿；`metrics-report.js` 聚合五类度量；`coverage-check.js` 读 Cobertura XML 判覆盖率阈值，作 G6 子项。本仓库维护入口四个：`ref-check.js` 校验跨文档一致性，供文档同步链使用；`toolchain-selftest.js` 断言脚本族语法可加载、入口可运行、退出码符合基线；`matrix-check.js` 校验注入矩阵与技能清单一致；`env-probe.js` 探测本机环境并写 `docs/.ddd-env.json`，供命令组装读取。命令组装入口一份：`env-command.js` 读环境记录与本包该语言的命令模板，组装测试与覆盖率命令，供实现者与测试执行者调用。编排脚本两份，与状态文件 schema 共用阶段键集，只做编排不做机械校验：`ddd-workflow.js` 走 A 主链，`ddd-hotfix.js` 走 B 快速修复。
- 校验模块与共享层位于 `skills/ddd-methodology/scripts/lib/`：`text.js`、`walk.js`、`paths.js`、`spec-doc.js`、`cross-check.js`、`matrix.js`、`matrix.test.js`、`obligations.js`、`debt-history.js`、`version.js`、`version.test.js`、`metrics-sources.js`、`metrics-structure.js`、`metrics-delivery.js`、`truncate.js`、`repo-scope.js`、`ref-refs.js`、`ref-constants.js`、`ref-stages.js`、`ref-phrases.js`、`ref-debt-fields.js`、`ref-coverage.js`、`ref-line-endings.js`、`ref-structure.js`、`ref-inventory.js`、`ref-convergence.js`、`ref-obligations.js`、`ref-external.js`、`ref-registry.js`、`ref-registry.test.js`、`span-parser.js`、`span-ast.js`、`span-langs.js`、`span-langs-convention.js`、`span-extract.js`、`span-compare.js`、`freeze.js`、`freeze.test.js`、`env-probe.js`、`env-command.js`、`env-resolve.js`、`env-probe.test.js`、`env-command.test.js`、`env-resolve.test.js`、`coverage-parse.js`、`coverage-parse.test.js`、`ref-env.js`、`ref-env.test.js`、`ref-agent.js`、`ref-agent.test.js`，以及两份基线 `convergence-baseline.json` 与 `toolchain-baseline.json`。其余供 `ref-check.js` 调用的库文件 `roster-check.js`、`spec-index-check.js`、`decision-tables.js`、`design-root.js`、`install-manifest-check.js`，与部署辅助入口 `install-parser.js`，位于 `scripts/` 根目录而非 `lib/` 子目录。
- 技能十九份，加主技能一份，位于 `skills/`：治理类四份为 `governance-code`、`governance-comment`、`governance-declaration`、`governance-document`；规范类七份为 `spec-requirements`、`spec-acceptance`、`spec-architecture`、`spec-contract`、`spec-defect-routing`、`spec-diagnosis`、`spec-test-case`；语言类七份为 `lang-python`、`lang-java`、`lang-javascript`、`lang-typescript`、`lang-shell`、`lang-powershell`、`lang-md`；工具类一份为 `tool-bash`。
- 提示模板四份，位于 `prompts/`：`prompts/ddd-init.md` 对应命令 `/ddd-init`，`prompts/ddd-parser-install.md` 对应 `/ddd-parser-install`，`prompts/ddd-rebuild.md` 对应 `/ddd-rebuild`，`prompts/ddd-refactor.md` 对应 `/ddd-refactor`。模板只写入口与指针，流程规则正文归主技能。
- 十个固定代理位于 `agents/ddd-*.md`，由 pi-subagents 消费；两份项目级代理模板位于 `skills/ddd-methodology/assets/agent-templates/`，项目初始化后落 `<项目根>/.pi/agents/`。
- 项目级规范文档模板两份，位于 `skills/ddd-methodology/assets/project-templates/`，即 `AGENTS.md` 与 `GLOSSARY.md`，初始化后落项目根。
