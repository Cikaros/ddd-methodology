# 工具面改造契约

对象文件：`scripts/trace-check.js`、`scripts/code-health.js`、`scripts/governance-check.js`、`scripts/ref-check.js` 新建、`workflows/ddd-workflow.js`、`extensions/ddd-governance.ts`。

## 1. 脚本消费契约

三个既有脚本的输出格式不强制统一为 JSON，改为统一「人类可读正文加末行机读结论」，并消除退出码语义的歧义。契约如下，同时是 `spec`「结构与注释的机械证据」节脚本消费契约表的唯一权威源。

| 脚本 | 输出形态 | 末行机读结论 | 退出码 | 门禁地位 | 输出上限 |
|---|---|---|---|---|---|
| trace-check.js | 文本正文 | `RESULT: pass` 或 `RESULT: gap` | 0 通过，1 存在缺口 | G4 与 G5 门禁 | 12000 字节 |
| code-health.js | 文本正文 | `RESULT: report` | 恒 0 | 仅报告，不作门禁 | 12000 字节 |
| governance-check.js | 单 JSON | verdict 字段 | 0 通过，1 阻断 | G5-INT 门槛 | 12000 字节 |
| ref-check.js | 文本正文 | `RESULT: pass` 或 `RESULT: drift` | 0 通过，1 存在漂移 | 本仓库文档同步链 | 12000 字节 |

统一要求如下。

1. 输出按 UTF-8 字节计量，超过 12000 字节时截断明细，末行机读结论必须保留且完整。截断时在正文保留一行计数，形如 `明细已截断：共 N 项，已列 M 项`。
2. 每个脚本的文件头注释写明本文的表行内容，即输出形态、末行机读结论、退出码语义、输出上限、门禁地位。
3. 脚本头注释中的规范引用改为语义化形式，禁止裸 `§N`。

## 2. 既有脚本的具体改动

### 2.1 trace-check.js

1. 末尾输出由 `结果：通过 ✓` 与 `结果：未通过` 改为正文加固定末行：通过时末行输出 `RESULT: pass`，缺口时末行输出 `RESULT: gap`。
2. 退出码保持 0 与 1。
3. 增加输出字节上限逻辑，上限 12000 字节。
4. 头注释按第 1 节要求改写，`spec §4` 一类引用改为语义化。

### 2.2 code-health.js

1. 末尾 `结论：存在 N 项结构健康问题，本版仅报告不阻断` 之后追加固定末行 `RESULT: report`。
2. 退出码保持恒 0，并在头注释与末行共同表明「仅报告，不作门禁」。
3. 增加输出字节上限逻辑，上限 12000 字节，且截断时保留 `[相对上次恶化]` 段。
4. 头注释中的 `§16` 引用改为语义化。

### 2.3 governance-check.js

1. 输出形态保持单 JSON。JSON 增加字段 `limitBytes`，值为 12000，使消费端可自证上限。
2. 现有截断逻辑保留，并在截断时于 `warnings` 追加一条含总数与已列数的说明。
3. 头注释中的 `spec §2` 与 `spec §13` 引用改为语义化。

## 3. ref-check.js 新建

新脚本，供本仓库文档同步链使用，校验跨文档引用与常量一致性。

### 3.1 输入与输出

用法：`node ref-check.js <仓库根>`。只读。

输出文本正文，末行 `RESULT: pass` 或 `RESULT: drift`，退出码 0 或 1，输出上限 12000 字节。

### 3.2 校验项

| 编号 | 校验项 | 判据 |
|---|---|---|
| C1 | 语义化节引用有效 | 全部 md 中 `见「X」节` 的 X 能在 `spec.md` 的二级与三级标题集合中命中 |
| C2 | 裸章节号引用已清除 | 全部活文档与脚本文件中不出现 `§` 加数字形式的跨节引用；脚本面含 `scripts/*.js` 与 `extensions/*.ts` |
| C3 | 阈值一致性 | 出现 `500 行` 处上下文含代码文件语义，`300 行` 处含基础或核心模块语义，`200 行` 处含文档语义 |
| C4 | 阶段键一致性 | `workflows/ddd-workflow.js` 的 `stageRegistry` 数组与 `spec` 状态文件节的键集合完全一致 |
| C5 | 代理清单一致性 | `agents/ddd-*.md` 文件集合与 `SKILL.md`、`README.md`、安装脚本声明的代理集合一致 |
| C6 | 门号一致性 | 全部文档中出现的门号属于 `spec` 质量门禁表定义的门号集合 |
| C7 | 脚本名一致性 | 全部文档中引用的 `scripts/` 下脚本名均存在对应文件 |
| C8 | 冻结短语一致性 | 冻结短语清单中的短语，凡在活文档中出现，须逐字一致；清单不含阈值锚点，阈值配对由 C3 校验 |
| C9 | 守卫编号一致性 | `extensions/ddd-governance.ts` 文件头的判定编号与触发点，与 `spec` 16.5 守卫判定表的编号与触发点集合一致 |

### 3.3 冻结短语清单

脚本内置下列短语，用于 C8。短语以空白规范化后逐字比对。阈值锚点不在本清单内，其一致性由 C3 校验，避免同一事实两处校验而互相矛盾。

1. `这个任务是只读的吗`
2. `派发类型不匹配`
3. `记录被触碰文件的改动前后规模、是否拆解与依据的粒度预判`
4. `全量测试的唯一主体是 ddd-tester`
5. `RESULT: pass`

清单中的短语，凡在任一活文档行内出现部分特征时须逐字完整，不得改写。阈值锚点的子集引用，例如只写代码与基础能力两档，属合法，不判漂移。

6. `只读的探查、调研、方案比选、环境勘察、资料检索，一律派 scout`

第 6 项是三处副本的共同前缀，各文档其后可接不同的后半句，本项只锁定共同前缀。

### 3.4 实现约束

1. Node 环境，可用 `require` 与 `fs`。文件头部按注释纪律说明目标与范围。
2. 每个校验项独立函数，输出漂移时给出文件路径、行号、判据与期望值。
3. 任何单项内部异常不得中断全局，记入漂移清单并继续。
4. C2 的扫描面除活文档外含 `scripts/*.js` 与 `extensions/*.ts`，其余校验项扫描面仍为活文档。
5. 无外部依赖。

## 4. workflows/ddd-workflow.js

### 4.1 阶段流头注释

头注释中的阶段流复述改为指针，固定表述：「阶段流以 `references/spec.md`「角色与交接」节的交接链为唯一权威，本脚本的阶段定义须与其一致，由 `scripts/ref-check.js` 的 C4 校验。」

保留文件头对运行时例外、用法、前置条件、缺陷路由策略、实现与测试硬分离的说明。`references/spec.md §15` 一类引用改为语义化。

### 4.2 阶段注册表

`stageRegistry` 数组末尾追加 `"audit"`。数组顺序改为与流程一致，即 `requirements`、`acceptance`、`architect`、`decomposer`、`interface-review`、`implement-plan`、`g5-int`、`test-execute`、`audit`。

### 4.3 并行段键名统一

1. `parallelStages` 首项 `key` 由 `"ddd-implement"` 改为 `"implement-plan"`。
2. `parallelStages` 次项 `key` 由 `"ddd-test-plan"` 改为 `"test-plan"`。
3. 调用处 `p.key === "ddd-implement"` 改为 `p.key === "implement-plan"`。
4. 键名不得再出现两套命名。

### 4.4 接入机械门禁

`workflow` 运行在无 `require` 与 `fs` 的沙箱，不能直接调用脚本，脚本证据由阶段任务文本要求子代理执行。

1. `decomposer` 阶段任务末尾追加：「完成后运行 `node ~/.pi/agent/skills/ddd-methodology/scripts/trace-check.js <项目根>`，将输出附入完成报告，作为 G4 证据。」
2. `g5-int` 阶段任务在既有 `code-health` 调用之外追加：「运行 `node ~/.pi/agent/skills/ddd-methodology/scripts/trace-check.js <项目根>` 与 `node ~/.pi/agent/skills/ddd-methodology/scripts/governance-check.js <项目根>`，将两者输出附入门禁记录，作为 G5 与 G5-INT 证据。governance-check 的退出码非零即视为阻断。」

### 4.5 新增审计阶段

在测试执行循环正常结束后、`return` 之前，追加审计阶段。

1. 触发条件：`escalated` 为空，即测试全绿或未通过项已定级且未超轮次。
2. 任务代理：`ddd-auditor`。
3. 任务文本要求：执行声明面审计，核验变更记录声称与实际产物一致，输出审计报告与修剪清单；报告标题下方给出建议归档名；只读，不落盘。
4. 状态键：`stateNote("audit")`。
5. 审计报告随返回值给出，字段名 `auditReport`。落盘由根会话执行，任务文本与返回值的 `note` 一并写明。
6. 若 `escalated` 非空，跳过审计阶段并在返回值注明跳过原因。

### 4.6 返回值

`return` 对象增加字段 `auditReport` 与 `skippedStages`，`note` 中补充「审计报告的落盘由根会话执行」一句。

### 4.7 引用改写

全文 `references/spec.md §N` 形式改为语义化节名引用。`references/spec.md §3` 改为 `规范「缺陷四级路由」节`，`§15` 改为 `规范「状态文件」节`。

## 5. extensions/ddd-governance.ts

1. 文件头判定编号摘要与 `spec` 16.5 的守卫判定表逐项一致，编号 H-1 与 H-2、触发点、判定条件、动作四列内容相同。
2. 头注释结尾的 `docs/analysis/method-versioning-governance.md §5.1、§5.3、§9` 与 `references/spec.md §4、§7、§16` 改为语义化引用，即 `method-versioning-governance.md 的硬门禁节` 与 `规范「粒度与独立性」节、「实现与测试分离」节、「结构与契约的演进治理」节`。
3. 判定逻辑、常量与阈值不变。`GRANULARITY_LINE_LIMIT` 保持 500，与 `spec` 阈值锚点一致。
4. 阈值承载差异保留，并在头注释固定表述：「基础能力 300 行与文档 200 行阈值由 `code-health` 度量与审计承接，本守卫只拦代码文件 500 行。」

## 6. 安装脚本

`scripts/install.sh`、`scripts/install.bat`、`scripts/uninstall.sh`、`scripts/uninstall.bat` 的固定文件清单中，`scripts` 段追加 `ref-check.js`。清单顺序与 `README.md` 结构树一致。

## 7. 变更记录要求

本组文件均被触碰，按「结构与契约的演进治理」节登记。`ref-check.js` 为新增能力，其消费方为文档同步链与 `README.md` 的提交前检查说明，满足声明面铁律。
