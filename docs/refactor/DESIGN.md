# 定向重构设计

状态：本轮实际执行的设计契约，变更类型为重构。

本轮为定向重构，范围限于三项结构性根因。范围外文件不得改动，发现问题只登记为存量债务。

## 1. 范围与锚点

### 1.1 范围

| 项 | 内容 | 涉及面 |
|---|---|---|
| P1 | 代理名副本面扩展校验，并把可派生的副本改为派生 | `scripts/roster-check.js`、`scripts/apply-models.js`、`profiles/models.json`、`workflows/ddd-workflow.js` |
| P2 | 抽出脚本共享层，消除跨脚本逐字重复 | 新增 `scripts/lib/`，改造六个脚本 |
| P3 | 规范按域拆分并纳入文档阈值度量面 | `skill/ddd-methodology/references/`、引用方、`scripts/code-health.js`、`scripts/ref-check.js` |

### 1.2 范围外

P4 至 P10 登记为存量债务，本轮不顺带处理：工具与归档占比失衡、代理骨架四处偏离、frontmatter 声明口径、阈值逼近双文件、README 结构树不符、health.json schema 不齐、路径约定两套。

### 1.3 锚点

沿用总览冻结锚点清单的 A 类对外契约九项与相关 B 类能力。本轮不改动任何对外契约：三个 skill 名与调用形式、12 个代理名与职责、门禁号与序号、九阶段键、脚本路径与调用形式、CLI 输出契约与退出码、安装参数与卸载白名单、项目内文件契约与机读行。

## 2. P1 代理名副本面

现状为至少 11 份副本，机械校验只覆盖 6 份。分两类处置。

### 2.1 可派生者改为派生

| 位置 | 处置 |
|---|---|
| `scripts/apply-models.js` 的 `KNOWN_AGENTS` | 改为从 `agents/` 目录读取 `ddd-*.md`，消除硬编码 |
| `profiles/models.json` 的角色名 | 保留为配比定义，但由校验保证其集合与 `agents/` 一致 |

### 2.2 不可派生者纳入校验

沙箱内的 `workflows/ddd-workflow.js` 与文档内的规范角色表无生成通道，保持内联，纳入机械校验。

| 位置 | 处置 |
|---|---|
| `roster-check.js` 的 `AGENT_DECLARATION_FILES` | 追加 `skill/ddd-methodology/references/spec-role.md`、`workflows/ddd-workflow.js` |
| workflow 的代理名提取 | 提取 `agent: "ddd-*"` 形式的字段值，不提取注释与状态键 |
| `profiles/models.json` 的角色名提取 | 提取配比各档的角色键集合 |

### 2.3 判据

1. `agents/` 目录文件集合与全部声明位置的角色名集合双向一致。
2. `profiles/models.json` 每档的角色集合等于 `agents/` 集合。
3. `workflow` 出现的代理名均属 `agents/` 集合。
4. `apply-models` 不再含硬编码角色名单。

## 3. P2 脚本共享层

### 3.1 新增 `scripts/lib/text.js`

导出下列函数，供各脚本与校验模块共用。

| 函数 | 职责 | 现重复位置 |
|---|---|---|
| `readFileText(file)` | 安全读文件，异常返回空串 | ref-check、roster-check |
| `withLineNumbers(text)` | 拆行并编号 | ref-check、roster-check |
| `drift(item, file, line, criterion, expect, found)` | 构造漂移项，字段固定 | ref-check、roster-check、decision-tables |

### 3.2 新增 `scripts/lib/walk.js`

导出目录遍历函数，供 `code-health`、`governance-check`、`trace-check` 共用，统一跳过点目录、`node_modules`、`docs` 等既有排除集。

### 3.3 改造范围

| 脚本 | 改动 |
|---|---|
| `ref-check.js` | 删内联实现，改 `require` 共享层 |
| `roster-check.js` | 同上 |
| `decision-tables.js` | 同上 |
| `code-health.js` | 改用 `walk.js` |
| `governance-check.js` | 改用 `walk.js` |
| `trace-check.js` | 改用 `walk.js` |

### 3.4 约束

1. 各脚本的对外行为、输出契约与退出码不变。
2. 共享层文件头声明目标与范围，并写明不包含什么。
3. 共享层不引入第三方依赖。
4. 安装脚本的 scripts 段追加 `lib/text.js` 与 `lib/walk.js`，或改为整目录复制并更新 `--check`。

## 4. P3 规范拆分

### 4.1 文件划分

| 文件 | 承载节 |
|---|---|
| `spec.md` | 索引、问题与解法、全局约定 |
| `spec-role.md` | 角色与交接 |
| `spec-gate.md` | 质量门禁、缺陷四级路由 |
| `spec-design.md` | 粒度与独立性、接口先行与冻结、并行实现与集成、实现与测试分离、测试阻塞防护 |
| `spec-change.md` | 需求变更、二次开发、渐进式改造 |
| `spec-declare.md` | 声明面可验证与修剪、结构与注释的机械证据 |
| `spec-govern.md` | 本仓库适用边界、状态文件、结构与契约的演进治理 |
| `spec-rebuild.md` | 存量重建 |

### 4.2 约定

1. 节标题集合全局唯一，跨文件不得重名。节编号保持不变，作为排序标识。
2. 引用形式保持「节标题」节，写法不变，对外零影响。
3. `spec.md` 作为索引入口，列出全部节标题与其所在文件。
4. 每份新文件头部一句范围说明，写明承载的节与不包含什么。
5. 每个文件都须低于 200 行文档阈值。

### 4.3 引用与校验同步

1. `ref-check` 的规范读取改为跨文件，提供统一的节查找函数，先合并全部 `spec*.md` 再按节标题定位。
2. 依赖规范内容的校验项，含 C1、C3、C4、C6、C8、C9，全部改为跨文件读取。
3. `code-health` 的文件规模度量扩展至活文档，使规范切分后的各文件纳入 200 行阈值判定。
4. `SKILL.md` 的知识加载规则与流程表按新文件组织更新。

## 5. 接口变化

本轮不改变任何对外接口。脚本命令、输出末行、退出码、安装参数、skill 调用、阶段键、门禁号、项目内文件契约均不变。

`references/` 目录的内部文件组织变化属仓库内部结构，不构成对外契约。既有引用由「节标题」节形式承载，故引用写法也不变。

## 6. 验证

1. `ref-check` 全项通过，且能在拆分为多文件后正确解析规范节标题。
2. `code-health` 无超限，规范各文件均低于 200 行，且不再有「规范不受阈值管辖」的缺口。
3. `governance-check` verdict 为 ok。
4. `roster-check` 的 C5 在新增声明位置后仍通过，并能检出构造的漂移。
5. 全部对外契约实测不变。
6. `ddd-doc-sync` 巡检与 `ddd-auditor` 审计无阻断项。

## 7. 波次

| 波次 | 内容 | 依赖 |
|---|---|---|
| 1 | P3 规范拆分与引用更新 | 无 |
| 2 | P2 脚本共享层 | 依赖波次 1 的节标题集合 |
| 3 | P1 清单派生与校验扩展 | 依赖波次 2 的共享层 |
| 4 | 验证与审计 | 依赖前三者 |
| 5 | 范围废弃项清单与收尾 | 依赖波次 4 |

三道写入者文件集互斥：波次 1 独占 `references/` 与引用方，波次 2 独占 `scripts/`，波次 3 独占 `roster-check`、`apply-models` 与 `profiles`。波次 2 与 3 同在 `scripts/`，故串行。
