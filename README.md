# DDD-Methodology 分治式设计驱动开发

基于 pi，即 pi.dev，与 pi-subagents 实现的方法论工具包。
核心：将大设计文档拆解为与目录结构同构的分布式小设计文档，通过 12 个固定职责子代理与缺陷四级路由，降低子代理上下文负担，防止实现偏离设计。

## 仓库结构

仓库结构如下。

```
ddd-methodology/
├── CHANGELOG.md                  # 变更记录（v1.0 起）
├── docs/                         # 项目侧证据与归档
│   ├── health.json              # 结构健康度量历史，入版本管理，上限 50 条
│   ├── audits/                  # 审计报告归档，作为下次修剪清单回验的输入
│   └── analysis/                # 方法论自身的改造设计文档
├── skill/ddd-methodology/        # pi Skill，规范唯一权威源为 references/spec.md
│   ├── SKILL.md                  # 调度流程入口
│   ├── references/
│   │   ├── spec.md               # 规范唯一权威源
│   │   └── templates.md          # 产物模板库
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
    ├── trace-check.js            # 追溯一致性校验脚本，G4/G5 门禁证据
    ├── apply-models.js           # 按代理模型配比的应用与可用性冒烟
    ├── code-health.js            # 代码结构健康检查脚本，G5-INT 与 G6 门禁证据
    ├── governance-check.js       # 契约指纹与结构趋势门槛校验，G5-INT 的 typed gate 证据
    ├── fingerprint.js            # 契约指纹唯一实现，供 trace-check 与 governance-check 共用
    ├── design-root.js            # 设计树根路径解析唯一实现，供同上两者共用
    └── merge-append-system.js    # 全局规则区块合并，供安装与卸载脚本调用
```

## 安装与卸载

安装卸载均为全局操作。

**Windows，cmd 环境**
```bat
scripts\install.bat              rem 安装/覆盖更新
scripts\install.bat --check     rem 检查安装状态
scripts\uninstall.bat           rem 卸载
```

**Linux、macOS 与 Git Bash**
```bash
chmod +x scripts/*.sh
./scripts/install.sh                              # 安装或覆盖更新，不触碰模型设置
./scripts/install.sh --models balanced            # 安装并按配比配置各代理模型
./scripts/install.sh --models balanced --set ddd-arbiter=GLM-5.3-Flash
./scripts/install.sh --models balanced --skip-verify      # 跳过冒烟，仅在确认模型可用时使用
./scripts/install.sh --models none                # 显式跳过模型配比
./scripts/install.sh --check                     # 检查安装状态
./scripts/uninstall.sh                           # 卸载，并移除本方法论写入的模型配置
```

安装内容：
- Skill，含 workflows 加速档脚本与 trace-check 校验脚本，安装到 `~/.pi/agent/skills/ddd-methodology/`
  - workflow 脚本位于 `~/.pi/agent/skills/ddd-methodology/workflows/ddd-workflow.js`，供根会话以 `subagent({ workflow: ... , args: { root: "<项目根>" } })` 调用
  - trace-check 脚本位于 `~/.pi/agent/skills/ddd-methodology/scripts/trace-check.js`，作为 G4/G5 门禁证据
  - code-health 脚本位于 `~/.pi/agent/skills/ddd-methodology/scripts/code-health.js`，作为 G5-INT/G6 门禁证据，度量写入项目内 docs/health.json
  - governance-check 脚本位于 `~/.pi/agent/skills/ddd-methodology/scripts/governance-check.js`，校验契约指纹与结构趋势，输出 verdict 供 typed gate 使用
- 运行时守卫扩展 `~/.pi/agent/extensions/ddd-governance.ts`，仅在含 docs/design 或 docs/gates 的项目内激活，对其他项目静默
- 模型配比记录文件 `~/.pi/agent/.ddd-model-overrides.json`，记录本方法论写入的代理、配比名与写入前原值，供精确回退
- 全局规则区块，按标记合并入 `~/.pi/agent/APPEND_SYSTEM.md`：只替换标记区块，区块外用户自定义内容原样保留，卸载时移除该区块；首次安装前自动备份为 `APPEND_SYSTEM.md.ddd-bak`，卸载时若仅剩标记区块则优先从该备份恢复并删除备份文件
- 12 个 agent 定义，按固定文件名清单，安装到 `~/.pi/agent/agents/ddd-*.md`

脚本按固定文件名清单安装/卸载，不会影响 `~/.pi/agent/agents/` 下用户自定义的其他代理文件。

## 使用

安装后在任意 pi 会话中使用。

```
/skill:ddd-methodology 按此方法论开发一个 <项目描述>
```

或直接说"**按 ddd 方法论开发……**"触发。根会话将按流程依次派发：需求采集，ddd-requirements，→ 验收标准，ddd-acceptance，→ 架构设计，ddd-architect，→ 分解设计，ddd-decomposer，→ 接口冻结门 G4.5，ddd-interface-reviewer，→ 实现 ddd-implementer 与测试规划 ddd-test-planner 并行，→ 集成收口 G5-INT，ddd-fixer，→ 测试执行与缺陷路由，ddd-tester，→ 声明面审计，ddd-auditor。

流水线之外的任务也按类型派发，判定表见规范 §1：只读探查、调研、方案比选与环境勘察派 scout，代码评审派 reviewer。调研属只读活动，不派给 ddd-implementer 与 ddd-fixer 等具备写权限的代理；承接者收到不匹配任务时会停止并报告派发类型不匹配，由根会话改派。

## 版本管理

本仓库使用 git tag 管理版本。规范修订流程：修改文档 → commit → 打递增版本 tag，例如 `v1.2`、`v1.3`。

被开发项目的接口契约以契约指纹作冻结锚点，算法与变更判定见 `skill/ddd-methodology/references/spec.md` §16。

## 按代理的模型配比

模型名属部署政策，不写入 agent 定义，只由 `profiles/models.json` 经 `scripts/apply-models.js` 应用到用户设置，因此可随时更换配比而不改动代理。

| 配比 | 定位 |
|---|---|
| balanced | 推荐。契约与编码角色用契约忠实度满分的一档，其余用同族更大输出上限的一档 |
| quality | 质量优先，少量高风险角色换异构模型以降低同族共同盲区 |
| economy | 成本优先，仅取消输出上限升档 |

应用流程默认有两道校验，任一不通过的模型会被跳过并告警，不写入无法验证的声明。第二道可用 `--skip-verify` 跳过，仅在已确认模型可用时使用，跳过即等于放弃该道验证：

1. **注册表校验**：模型须已在 pi 中注册。
2. **可用性冒烟**：以最小请求实测首字延迟与推理开销，空内容即视为不可用。

单独执行冒烟与查看状态的命令：

```bash
node scripts/apply-models.js list                                    # 列出全部配比与注册表比对
node scripts/apply-models.js verify balanced                        # 仅冒烟
node scripts/apply-models.js status                                 # 查看当前已应用的配置
node scripts/apply-models.js clear                                  # 移除本方法论写入的配置
```

前置条件：`node` 必须可用，配比应用与全局规则合并均依赖它；未安装 node 时脚本降级为警告并跳过这两项。

**配比应用与卸载都依赖仓库在场**：`profiles/`、`scripts/apply-models.js` 与 `scripts/merge-append-system.js` 均不随安装复制到 skill 目录，故更换配比与执行卸载需在仓库内运行，或用 `--repo` 指向仓库根。

`profiles/models.json` 内记录了配比的实测证据与理由，含可用性、延迟、审计召回、编码契约忠实度与成本结构。证据为单轮对照，样本量有限，使用中出现反例应更新该表。
