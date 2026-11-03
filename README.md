# DDD-Methodology 分治式设计驱动开发

基于 pi，即 pi.dev，与 pi-subagents 实现的方法论工具包。
核心：将大设计文档拆解为与目录结构同构的分布式小设计文档，通过 12 个固定职责子代理与缺陷四级路由，降低子代理上下文负担，防止实现偏离设计。

## 仓库结构

仓库的完整目录结构与安装内容明细见 [STRUCTURE.md](STRUCTURE.md)。本文件只保留定位与入口。

## 安装与卸载

本方法论本体为 pi package，全局安装与移除：

```
pi install git:github.com/Cikaros/ddd-methodology@v0.1.0
pi remove ddd-methodology
```

skill、agent 与扩展的安装与移除均由 pi package 机制承担，不再由脚本复制。已按旧方式安装的用户可运行 `node scripts/migrate-to-package.js` 清理用户作用域的残留，加 `--dry-run` 只列计划不落盘；该脚本保留 `settings.json` 的 `subagents.agentOverrides`。

模型配比为部署政策，由仓库内的脚本应用与撤回，按平台执行。

| 操作 | Windows | Linux、macOS 与 Git Bash |
|---|---|---|
| 应用模型配比 | `scripts\install.bat --models <配比>` | `./scripts/install.sh --models <配比>` |
| 检查模型配比状态 | `scripts\install.bat --check` | `./scripts/install.sh --check` |
| 撤回模型配比 | `scripts\uninstall.bat` | `./scripts/uninstall.sh` |

Linux、macOS 与 Git Bash 首次使用前执行 `chmod +x scripts/*.sh`。

安装参数如下，Windows 与 Linux 通用。

| 参数 | 取值 | 说明 |
|---|---|---|
| `--models` | `balanced`、`quality` | 按 `profiles/models.json` 的配比配置各代理模型 |
| `--models none` | 固定值 | 显式跳过模型配比，不读取配比文件 |
| `--set` | `ddd-<代理名>=<模型名>` | 在配比基础上改单个代理，可重复 |
| `--skip-verify` | 无 | 跳过可用性冒烟，仅在已确认模型可用时使用 |
| `--provider` | provider 名 | 指定模型 provider，默认取配比文件值 |
| `--check` | 无 | 只检查模型配比状态，不写入 |
| `--repo` | 仓库根路径 | 指定仓库位置，供 `apply-models.js` 定位 `profiles/models.json` |

省略 `--models` 时不触碰模型设置，`--models none` 为显式跳过。撤回会移除本方法论写入的模型配置，`settings.json` 的 `subagents.agentOverrides` 保留。

安装内容明细，即各随装件与其安装路径，见 [STRUCTURE.md](STRUCTURE.md)。

## 使用

安装后在任意 pi 会话中使用。

```
/skill:ddd-methodology 按此方法论开发一个 <项目描述>
```

或直接说"**按 ddd 方法论开发……**"触发。根会话按规范「角色与交接」节的交接链与 `SKILL.md` 的流程表依次派发。

存量重建与定向重构两个 skill 由用户显式调用，模型不会自动选中，须在会话中直接给出：

```
/skill:ddd-rebuild     存量重建
/skill:ddd-refactor    定向重构
```

流水线之外的任务同样按此判据派发。派发前先判任务性质。第一问是这个任务是只读的吗。目的只是获取信息、无专属产出物的探查型只读任务，派 scout，不再查表。产出接口评审报告、仲裁裁决单、巡检报告或审计报告等专属产物的职责型只读任务，按产出物查「角色与交接」节的派发表，派对应只读代理。非只读任务同样查表。承接者收到不符合自身职责的任务时停止并报告派发类型不匹配。

只读的探查、调研、方案比选、环境勘察、资料检索，一律派 scout，不派给任何具备写权限的 ddd-* 代理。

被开发项目会在项目根产出并持续维护项目级指令文件 `AGENTS.md`：架构设计期出初版，迭代收尾由根会话做适应性更新，随能力、目录与约定演进持续对齐。其内容边界与整篇重写的判据见规范「项目级指令文件的维护」节，此处只作指针，不重复定义。

## 版本管理

版本以 `package.json` 的 `version` 为准，采用三段式语义化版本，tag 与之一致，例如 `v0.1.0`。用户可用 `pi install git:github.com/Cikaros/ddd-methodology@v0.1.0` 固定版本。规范修订后运行 `node scripts/ref-check.js .` 校验跨文档一致性，作为提交前检查。代理与 skill 清单的一致性判据由 `scripts/roster-check.js` 提供，`ref-check` 的 C5 代理清单校验与 C11 skill 清单校验均调用它。

`ref-check` 默认只读，不写盘；加 `--fix` 时由规范「状态文件」节的键清单生成 `workflows/ddd-workflow.js` 的 stageRegistry，并校验 `extensions/ddd-governance.ts` 的 `G5_INT_STAGE` 单键属于该集合，写盘范围限于 stageRegistry 数组块，改完须复跑默认模式确认无漂移。

被开发项目的接口契约以契约指纹作冻结锚点，算法与变更判定见规范「结构与契约的演进治理」节。

## 按代理的模型配比

模型名属部署政策，不写入 agent 定义，只由 `profiles/models.json` 经 `scripts/apply-models.js` 应用到用户设置，因此可随时更换配比而不改动代理。

| 配比 | 定位 |
|---|---|
| balanced | 推荐。契约与编码角色用契约忠实度满分的一档，其余用同族更大输出上限的一档 |
| quality | 质量优先，少量高风险角色换异构模型以降低同族共同盲区 |

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

前置条件：`node` 必须可用，配比应用依赖它；未安装 node 时脚本降级为警告并跳过。

**配比应用与撤回都在仓库内运行**：`profiles/` 与 `scripts/apply-models.js` 属仓库内部专用脚本，不随包分发的运行流程；更换配比或撤回模型配置请在仓库内运行，在仓库外直接调用 `apply-models.js` 时可用 `--repo` 指向仓库根。

`profiles/models.json` 内记录了配比的实测证据与理由，含可用性、延迟、审计召回、编码契约忠实度与成本结构。证据为单轮对照，样本量有限，使用中出现反例应更新该表。
