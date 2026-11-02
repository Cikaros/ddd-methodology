# 仓库结构与安装内容

本文件承载本仓库的完整目录结构与安装内容明细，是 `README.md` 的延伸。

## 仓库结构

仓库结构如下。

```
ddd-methodology/
├── README.md                     # 仓库定位与入口
├── STRUCTURE.md                  # 仓库结构与安装内容明细，本文件
├── CHANGELOG.md                  # 变更记录（v1.0 起）
├── docs/                         # 项目侧证据与归档
│   ├── health.json              # 结构健康度量历史，入版本管理，上限 50 条
│   ├── metrics.json             # 绩效度量聚合产物，由 metrics-report.js 生成
│   ├── debts.json               # 存量债务登记簿，超期与未清上限由 debt-check.js 校验
│   ├── debt-history.json        # 债务历史快照，由 debt-check.js 按版本维护，上限 50 条
│   ├── check-coverage.json      # 根因到已建立校验项的映射，由 ref-check 的 C15 校验
│   └── refactor/                # 本轮改造设计的冻结契约
├── skill/ddd-methodology/        # pi Skill，规范权威源为 references/ 下的规范文件集
│   ├── SKILL.md                  # 调度流程入口
│   ├── references/
│   │   ├── spec.md               # 规范索引入口
│   │   ├── spec-role.md          # 角色与交接
│   │   ├── spec-gate.md          # 质量门禁、缺陷四级路由
│   │   ├── spec-design.md        # 粒度与独立性、接口先行与冻结、并行实现与集成、实现与测试分离、测试阻塞防护
│   │   ├── spec-change.md        # 需求变更、二次开发、渐进式改造
│   │   ├── spec-declare.md       # 声明面可验证与修剪、结构与注释的机械证据
│   │   ├── spec-govern.md        # 本仓库适用边界、状态文件、结构与契约的演进治理
│   │   ├── spec-rebuild.md       # 存量重建
│   │   ├── spec-metrics.md       # 绩效度量
│   │   ├── templates.md          # 产物模板库
│   │   ├── templates-debts.md    # 存量债务登记簿模板
│   │   └── templates-rebuild.md  # 存量重建与定向重构产物模板
├── skill/ddd-rebuild/            # 存量重建 skill，仅由用户显式调用
│   └── SKILL.md                  # 存量重建流程入口
├── skill/ddd-refactor/           # 定向重构 skill，仅由用户显式调用
│   └── SKILL.md                  # 定向重构流程入口
├── global/
│   └── APPEND_SYSTEM.md         # 全局规则权威版本，安装时按标记区块合并入用户全局文件
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
│   └── ddd-governance.ts         # 运行时守卫，仅 DDD 项目激活，拦截越阈值写入与全量测试误跑
└── scripts/
    ├── install.bat               # Windows 安装/更新（幂等）
    ├── install.sh                # Linux/macOS/Git Bash 安装/更新
    ├── uninstall.bat             # Windows 卸载（固定文件清单，防误删）
    ├── uninstall.sh              # Linux/macOS/Git Bash 卸载
    ├── trace-check.js            # 追溯一致性校验脚本，G4 与 G5 门禁证据
    ├── apply-models.js           # 按代理模型配比的应用与可用性冒烟
    ├── code-health.js            # 结构健康度量脚本，仅报告不作门禁，写入项目内 docs/health.json
    ├── governance-check.js       # 契约指纹与结构趋势门槛校验，输出 verdict 作为 G5-INT 门槛证据
    ├── fingerprint.js            # 契约指纹唯一实现，供 trace-check 与 governance-check 共用
    ├── design-root.js            # 设计树根路径解析唯一实现，供同上两者共用
    ├── merge-append-system.js    # 全局规则区块合并，供安装与卸载脚本调用
    ├── decision-tables.js        # 判定表默认分支校验库，供 ref-check 调用
    ├── ref-check.js              # 跨文档引用、常量与枚举一致性校验，本仓库文档同步链证据
    ├── roster-check.js           # 代理与 skill 清单一致性校验，供 ref-check 的 C5、C11 调用
    ├── spec-index-check.js       # 规范索引表与规范标题一致性校验，供 ref-check 的 C12 调用
    ├── install-manifest-check.js # 安装与卸载脚本清单一致性校验，供 ref-check 的 C13 调用
    ├── debt-check.js             # 存量债务登记簿超期与上限校验脚本，末行 pass 或 overdue
    ├── metrics-report.js         # 绩效度量聚合脚本，读 health.json、debts.json、gates/ 与 reports/，写 docs/metrics.json，末行 RESULT: report
    └── lib/                      # 脚本共享层，供上述脚本复用
        ├── text.js               # 安全读文件、按行编号与漂移项构造三项纯函数
        ├── walk.js               # 目录深度优先遍历，统一各脚本的排除集
        ├── spec-doc.js           # 规范读取面：规范文件枚举、节标题索引与节定位
        ├── ref-refs.js           # 引用形态域校验：C1 语义化节引用、C2 裸章节号、C7 脚本名
        ├── ref-constants.js      # 常量枚举域校验：C3 阈值、C6 门号、C9 守卫编号
        ├── ref-stages.js         # 阶段键域校验：C4 与 --fix 的注册表生成
        ├── ref-phrases.js        # 冻结短语域校验：C8 与锚点清单
        ├── ref-debt-fields.js    # 登记簿字段集合一致性校验：C14
        ├── ref-coverage.js       # 校验项映射一致性校验：C15
        ├── ref-line-endings.js   # 工作区行尾一致性校验：C16
        ├── debt-history.js       # 债务历史快照与根因复发检测
        ├── version.js            # 版本标识工具：v主.次 的解析、比较、加跨度与格式化
        ├── metrics-sources.js    # 度量来源读取面：健康与登记簿读取、目录取文件、机读行与表格解析、缺省数值归一
        ├── metrics-structure.js  # 结构与债务类度量：超阈值文件数趋势、债务未清数与超期率、同一根因复发次数
        └── metrics-delivery.js   # 交付质量与声明面类度量：门禁一次通过率与过门轮次、返工轮次分布、缺陷四级分布与密度、无消费方声明占比、机械证据覆盖率
```

## 安装内容

安装内容如下，按随装件与安装路径逐条给出。

- Skill，含 workflows 加速档脚本与门禁证据脚本，安装到 `~/.pi/agent/skills/ddd-methodology/`
  - workflow 脚本位于 `~/.pi/agent/skills/ddd-methodology/workflows/ddd-workflow.js`，供根会话以 `subagent({ workflow: ... , args: { root: "<项目根>" } })` 调用
  - trace-check 脚本位于 `~/.pi/agent/skills/ddd-methodology/scripts/trace-check.js`，作为 G4 与 G5 门禁证据
  - code-health 脚本位于 `~/.pi/agent/skills/ddd-methodology/scripts/code-health.js`，度量结构健康并写入项目内 docs/health.json，仅报告不作门禁
  - governance-check 脚本位于 `~/.pi/agent/skills/ddd-methodology/scripts/governance-check.js`，校验契约指纹与结构趋势，输出 verdict 作为 G5-INT 门槛证据
  - ref-check 脚本位于 `~/.pi/agent/skills/ddd-methodology/scripts/ref-check.js`，校验跨文档引用、常量与枚举集合一致性，供文档同步链使用
  - 共享层与各域校验模块位于 `scripts/lib/`（`text.js`、`walk.js`、`spec-doc.js`、`ref-refs.js`、`ref-constants.js`、`ref-stages.js`、`ref-phrases.js`、`ref-debt-fields.js`、`ref-coverage.js`、`ref-line-endings.js`、`debt-history.js`、`version.js`、`metrics-sources.js`、`metrics-structure.js`、`metrics-delivery.js`），供 `ref-check`、`debt-check` 与 `metrics-report` 复用，随 Skill 装到 `~/.pi/agent/skills/ddd-methodology/scripts/lib/`，卸载时随固定清单一并移除
  - install-manifest-check 脚本位于 `~/.pi/agent/skills/ddd-methodology/scripts/install-manifest-check.js`，校验安装与卸载脚本的清单一致性，作为 ref-check 的 C13
- 存量重建 skill `ddd-rebuild` 与定向重构 skill `ddd-refactor`，分别安装到 `~/.pi/agent/skills/ddd-rebuild/` 与 `~/.pi/agent/skills/ddd-refactor/`。三者同属一份固定清单，安装时一并复制、卸载时一并移除，随装随卸；卸载只删清单内目录，不影响用户自有 skill
- 运行时守卫扩展 `~/.pi/agent/extensions/ddd-governance.ts`，仅在含 docs/design 或 docs/gates 的项目内激活，对其他项目静默
- 模型配比记录文件 `~/.pi/agent/.ddd-model-overrides.json`，记录本方法论写入的代理、配比名与写入前原值，供精确回退
- 全局规则区块，按标记合并入 `~/.pi/agent/APPEND_SYSTEM.md`：只替换标记区块，区块外用户自定义内容原样保留，卸载时移除该区块；首次安装前自动备份为 `APPEND_SYSTEM.md.ddd-bak`，卸载时若仅剩标记区块则优先从该备份恢复并删除备份文件
- 12 个 agent 定义，按固定文件名清单，安装到 `~/.pi/agent/agents/ddd-*.md`

脚本按固定文件名清单安装/卸载，不会影响 `~/.pi/agent/agents/` 下用户自定义的其他代理文件。
