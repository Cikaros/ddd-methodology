# DDD-Methodology 分治式设计驱动开发

基于 pi，即 pi.dev，与 pi-subagents 实现的方法论工具包。核心：将大设计文档拆解为与目录结构同构的分布式小设计文档，通过固定职责子代理与缺陷四级路由，降低子代理上下文负担，防止实现偏离设计。

## 仓库结构

仓库的完整目录结构与安装内容明细见 [STRUCTURE.md](STRUCTURE.md)。本文件只保留定位、入口与资源清单。

## 安装与卸载

本方法论本体为 pi package，全局安装与移除：

```
pi install git:github.com/Cikaros/ddd-methodology
pi remove ddd-methodology
```

**网络提示**：pi 经 **HTTPS** clone `github.com` 安装 git 来源包，该通道不通会让 `pi install` 失败，这属传输通道问题而非包本身问题。确因该通道不通时，可自行把 git 的该地址重写为 SSH。持久写法：

```bash
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

一次性写法，只对当次命令生效：

```bash
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0='url.git@github.com:.insteadOf' GIT_CONFIG_VALUE_0='https://github.com/' pi install git:github.com/Cikaros/ddd-methodology
```

skill、agent、扩展与提示模板的安装与移除均由 pi package 机制承担，不再由脚本复制。包内资源由 `package.json` 声明，随装件明细见 [STRUCTURE.md](STRUCTURE.md)。

## 使用

在项目根运行 `/ddd-init` 落项目级骨架，其后按方法论开发：

```
/skill:ddd-methodology 按此方法论开发一个 <项目描述>
```

或直接说「按 ddd 方法论开发……」触发。四个提示模板由用户显式调用，模型不会自动选中：

| 命令 | 用途 |
|---|---|
| `/ddd-init` | 初始化项目级骨架，落 `AGENTS.md`、`GLOSSARY.md` 与两份项目级代理定义 |
| `/ddd-parser-install` | 安装签名级符合性校验所需的解析器，先打印计划再执行 |
| `/ddd-rebuild` | 存量重建，整体替换既有实现与文档 |
| `/ddd-refactor` | 定向重构，范围限于用户指定的模块或问题 |

提示模板只写入口与指针，调度流程与门禁规则见主技能 `skills/ddd-methodology/SKILL.md` 及其 `references/` 下规范正文。

被开发项目会在项目根产出并持续维护项目级指令文件 `AGENTS.md` 与术语表 `GLOSSARY.md`：架构设计期出初版，迭代收尾由根会话核验更新。术语的唯一权威处只有 `GLOSSARY.md` 一处。

## 资源清单

- 技能二十份，位于 `skills/`：主技能 `ddd-methodology`；治理类四份 `governance-code`、`governance-comment`、`governance-declaration`、`governance-document`；规范类七份 `spec-requirements`、`spec-acceptance`、`spec-architecture`、`spec-contract`、`spec-test-case`、`spec-defect-routing`、`spec-diagnosis`；语言类七份 `lang-python`、`lang-java`、`lang-javascript`、`lang-typescript`、`lang-shell`、`lang-powershell`、`lang-md`；工具类一份 `tool-bash`。
- 固定代理十个，位于 `agents/`：需求采集者、架构设计者、验收标准制定者、设计分解者、详细设计者、接口契约评审者、实现者、单元测试制定者、测试执行者与缺陷修复者。
- 项目级代理模板两份与项目级规范文档模板两份，位于 `skills/ddd-methodology/assets/`，经 `/ddd-init` 落项目。
- 扩展四模块，位于 `extensions/`：`ddd-context.ts` 注入全局规则与任务引导，`ddd-governance.ts` 承担运行时守卫，`ddd-tools.ts` 注册机械证据工具，`ddd-resources.ts` 按注入矩阵裁剪可得技能集。
- 提示模板四份，位于 `prompts/`，一文件一命令。

## 脚本清单

命令入口共 16 个，位于 `scripts/`，另有编排脚本与库文件同目录。状态取三值：在役为随包服务被开发项目，仓库专用为仅本仓库维护用，部署辅助为用户部署时执行。该表为命令入口的唯一清单，由 `ref-check` 的 C21 与仓库实际入口双向比对。

| 脚本 | 状态 | 消费方 | 门禁地位 |
|---|---|---|---|
| `scripts/check-scope.js` | 在役 | 交叉检查工具 | 架构交出后的集合同一与顺序一致检查 |
| `scripts/check-design.js` | 在役 | 交叉检查工具 | 分解设计交出后的契约表与设计树检查 |
| `scripts/check-file-design.js` | 在役 | 交叉检查工具 | 文件级设计交出后的清单与契约一致性检查 |
| `scripts/check-code.js` | 在役 | 交叉检查工具 | 实现与测试规划交出后的导出符号与覆盖检查 |
| `scripts/check-consistency.js` | 在役 | 交叉检查工具 | 测试执行交出后的命名、计数与引用检查 |
| `scripts/trace-check.js` | 在役 | `ddd_trace_check` 工具 | G2、G4 与 G5 门禁 |
| `scripts/span-check.js` | 在役 | `ddd_span_check` 工具 | G5-INT 接口签名一致性证据 |
| `scripts/governance-check.js` | 在役 | `ddd_governance_check` 工具 | G5-INT 门槛 |
| `scripts/code-health.js` | 在役 | `ddd_code_health` 工具 | 仅报告，不作门禁 |
| `scripts/debt-check.js` | 在役 | `ddd_debt_check` 工具 | 交付门前置校验 |
| `scripts/metrics-report.js` | 在役 | `ddd_metrics_report` 工具 | 仅报告，不作门禁 |
| `scripts/env-command.js` | 在役 | 实现者与测试执行者 | 命令组装，非门禁证据 |
| `scripts/install-parser.js` | 部署辅助 | `/ddd-parser-install` 命令 | 不构成门证据 |
| `scripts/ref-check.js` | 仓库专用 | 人工与文档同步链 | 本仓库自身一致性 |
| `scripts/toolchain-selftest.js` | 仓库专用 | 人工 | 脚本族可用的自证 |
| `scripts/matrix-check.js` | 仓库专用 | 人工 | 注入矩阵与技能清单一致性 |

编排脚本两份，由根会话以 `subagent({ workflow, args: { root } })` 调用，按通道取各自阶段键序，只做编排不做机械校验：`ddd-workflow.js` 走 A 主链，`ddd-hotfix.js` 走 B 快速修复。接口冻结锚点的读写与「对外接口与约定」节的定向 diff 由共享层 `freeze.js` 承担，其单元测试 `freeze.test.js` 同目录。入口的命令行调用方式为 `node <脚本绝对路径> <项目根绝对路径>`。

## pi 版本要求

本包在若干 pi 版本上已实测通过，逐版本的对应关系、实测日期与结论见 [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)。本包在 `package.json` 的 `pi.dddSupportedPiVersion` 声明已实测覆盖的 pi 版本范围，会话启动时若探测到宿主版本落在该范围之外，会在交互界面提示一次，无界面模式写入 stderr。若你使用的 pi 版本超出已实测范围，或看到该提示，请参考对应表选择合适的动作：优先把本包升级到覆盖该 pi 版本的较新行，或把 pi 调整到表中已实测的版本；对应表是本项信息的唯一权威。

## 版本管理

版本以 `package.json` 的 `version` 为准，采用三段式语义化版本，tag 与之一致。安装命令默认跟随默认分支；需要固定版本时，把所需 tag 以 `@vX.Y.Z` 的形式拼进安装命令，即 `pi install git:github.com/Cikaros/ddd-methodology@vX.Y.Z`，并将 `vX.Y.Z` 换成具体 tag。示例不写具体版本号，以免每次发版后陈旧。

规范修订后运行 `node skills/ddd-methodology/scripts/ref-check.js .` 校验跨文档一致性，作为提交前检查。代理与 skill 清单的一致性判据由 `scripts/roster-check.js` 提供，`ref-check` 的 C5 代理清单校验与 C11 skill 清单校验均调用它。`ref-check` 只读，不写盘。

## 参考来源

本项目的设计与实现参考了以下上游项目。

- [earendil-works/pi](https://github.com/earendil-works/pi)：宿主平台。本包以其扩展接口、技能机制与提示模板机制为承载，全局规则以 section 注入而不改写用户全局文件。
- [nicobailon/pi-subagents](https://github.com/nicobailon/pi-subagents)：子代理与脚本化工作流机制。本包的代理定义格式、编排脚本与声明式验收均以其为准。
- [mattpocock/skills](https://github.com/mattpocock/skills)：部分工程实践思想的来源。本项目按自身体系选择性借鉴，未整体引入，具体为缺陷诊断的六阶段骨架与反馈回路纪律、代码坏味道清单、接口深度判据与七个词汇、用例反模式与主动扫描方式五处，只取本体系未有者，且不改变既有判据与流程。
