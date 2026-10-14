# DDD-Methodology：分治式设计驱动开发

基于 pi（pi.dev）与 pi-subagents 实现的方法论工具包。
核心：将大设计文档拆解为与目录结构同构的分布式小设计文档，通过 7 个固定职责子代理与缺陷四级路由，降低子代理上下文负担，防止实现偏离设计。

## 仓库结构

```
ddd-methodology/
├── docs/
│   └── 方法论规范-v1.0.md        # 方法论最终版规范（git tag: v1.0）
├── skill/ddd-methodology/        # pi Skill（安装后由根会话加载调度）
│   ├── SKILL.md                  # 调度流程入口
│   └── references/
│       ├── spec.md               # 规范（随 skill 分发）
│       ├── templates.md          # 文档模板库
│       └── defect-routing.md     # 缺陷四级路由细则
├── workflows/
│   └── ddd-workflow.js           # 可选加速档：固定阶段自动编排脚本（args.root 传项目根）
├── agents/                       # 7 个子代理定义（pi-subagents 格式）
│   ├── ddd-requirements.md       # 代理1 需求采集者
│   ├── ddd-acceptance.md         # 代理0 验收标准制定者
│   ├── ddd-architect.md          # 代理2 架构师
│   ├── ddd-decomposer.md         # 代理3 分解设计者
│   ├── ddd-implementer.md        # 代理4 实现者
│   ├── ddd-test-planner.md       # 代理5 测试规划者
│   └── ddd-tester.md             # 代理6 测试执行者
└── scripts/
    ├── install.bat               # Windows 安装/更新（幂等）
    ├── install.sh                # Linux/macOS/Git Bash 安装/更新
    ├── uninstall.bat             # Windows 卸载（固定文件清单，防误删）
    └── uninstall.sh              # Linux/macOS/Git Bash 卸载
```

## 安装 / 卸载（全局）

**Windows（cmd）：**
```bat
scripts\install.bat              rem 安装/覆盖更新
scripts\install.bat --check     rem 检查安装状态
scripts\uninstall.bat           rem 卸载
```

**Linux / macOS / Git Bash：**
```bash
chmod +x scripts/*.sh
./scripts/install.sh             # 安装/覆盖更新
./scripts/install.sh --check     # 检查安装状态
./scripts/uninstall.sh           # 卸载
```

安装内容：
- Skill（含 workflows 加速档脚本）→ `~/.pi/agent/skills/ddd-methodology/`
  - 其中 workflow 脚本位于 `~/.pi/agent/skills/ddd-methodology/workflows/ddd-workflow.js`，供根会话以 `subagent({ workflow: ... , args: { root: "<项目根>" } })` 调用
- 7 个 agent 定义（按固定文件名清单）→ `~/.pi/agent/agents/ddd-*.md`

脚本按固定文件名清单安装/卸载，不会影响 `~/.pi/agent/agents/` 下用户自定义的其他代理文件。

## 使用

安装后在任意 pi 会话中：

```
/skill:ddd-methodology 按此方法论开发一个 <项目描述>
```

或直接说"**按 ddd 方法论开发……**"触发。根会话将按流程依次派发：
需求采集（代理1）→ 验收标准（代理0）→ 架构设计（代理2）→ 分解设计（代理3）→ 实现（代理4）∥ 测试规划（代理5）→ 测试执行与缺陷路由（代理6）。

## 版本管理

本仓库使用 git tag 管理版本。规范修订流程：修改文档 → commit → 打递增版本 tag（`v1.2`、`v1.3`…）。
