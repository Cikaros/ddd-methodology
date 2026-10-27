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
│   └── audits/                  # 审计报告归档，作为下次修剪清单回验的输入
├── skill/ddd-methodology/        # pi Skill，规范唯一权威源为 references/spec.md
│   ├── SKILL.md                  # 调度流程入口
│   ├── references/
│   │   ├── spec.md               # 规范唯一权威源
│   │   └── templates.md          # 产物模板库
├── global/
│   └── APPEND_SYSTEM.md         # 全局规则权威版本，安装时按标记区块合并入用户全局文件
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
└── scripts/
    ├── install.bat               # Windows 安装/更新（幂等）
    ├── install.sh                # Linux/macOS/Git Bash 安装/更新
    ├── uninstall.bat             # Windows 卸载（固定文件清单，防误删）
    ├── uninstall.sh              # Linux/macOS/Git Bash 卸载
    ├── trace-check.js            # 追溯一致性校验脚本，G4/G5 门禁证据
    ├── code-health.js            # 代码结构健康检查脚本，G5-INT 与 G6 门禁证据
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
./scripts/install.sh             # 安装/覆盖更新
./scripts/install.sh --check     # 检查安装状态
./scripts/uninstall.sh           # 卸载
```

安装内容：
- Skill，含 workflows 加速档脚本与 trace-check 校验脚本，安装到 `~/.pi/agent/skills/ddd-methodology/`
  - workflow 脚本位于 `~/.pi/agent/skills/ddd-methodology/workflows/ddd-workflow.js`，供根会话以 `subagent({ workflow: ... , args: { root: "<项目根>" } })` 调用
  - trace-check 脚本位于 `~/.pi/agent/skills/ddd-methodology/scripts/trace-check.js`，作为 G4/G5 门禁证据
  - code-health 脚本位于 `~/.pi/agent/skills/ddd-methodology/scripts/code-health.js`，作为 G5-INT/G6 门禁证据，度量写入项目内 docs/health.json
- 全局规则区块，按标记合并入 `~/.pi/agent/APPEND_SYSTEM.md`：只替换标记区块，区块外用户自定义内容原样保留，卸载时移除该区块；首次安装前自动备份为 `APPEND_SYSTEM.md.ddd-bak`，卸载时若仅剩标记区块则优先从该备份恢复并删除备份文件
- 12 个 agent 定义，按固定文件名清单，安装到 `~/.pi/agent/agents/ddd-*.md`

脚本按固定文件名清单安装/卸载，不会影响 `~/.pi/agent/agents/` 下用户自定义的其他代理文件。

## 使用

安装后在任意 pi 会话中使用。

```
/skill:ddd-methodology 按此方法论开发一个 <项目描述>
```

或直接说"**按 ddd 方法论开发……**"触发。根会话将按流程依次派发：需求采集，ddd-requirements，→ 验收标准，ddd-acceptance，→ 架构设计，ddd-architect，→ 分解设计，ddd-decomposer，→ 接口冻结门 G4.5，ddd-interface-reviewer，→ 实现 ddd-implementer 与测试规划 ddd-test-planner 并行，→ 集成收口 G5-INT，ddd-fixer，→ 测试执行与缺陷路由，ddd-tester，→ 声明面审计，ddd-auditor。

## 版本管理

本仓库使用 git tag 管理版本。规范修订流程：修改文档 → commit → 打递增版本 tag，例如 `v1.2`、`v1.3`。
