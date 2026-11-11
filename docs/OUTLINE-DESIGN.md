---
doc: design
level: overview
reqId: hermess-redesign
status: frozen
landed: false
target: .
opened: 2026-11-11
updated: 2026-11-11
targetVersion: 1.0.0
---

# 基于 OpenCode Plugin 的分治式设计驱动开发方法论 · 概要设计

> `$Hermess = 操作系统$`
> `$opencode-plugin + subagent + ddd.methodology = Hermess$`

本件是本方法论的**总体设计**，宿主为 **OpenCode**。本件自包含：读完本件即可据以实现、可据以评审。

- 需求依据：`docs/REQUIREMENTS.md`（本件是其设计落地）。术语一律以 `docs/GLOSSARY.md` 为准（由本方法论初始化时生成）。
- **设计纪律：每一项涉宿主形态的设计主张都须经验证。** 证据分两级——**类型定义**（宿主实装 **v2.2.7** 的 `.d.ts`，最强）与**官方文档快照**（v2.2.7）。凡证据不足者，本设计**不把它当承重项**（见 §〇）。
- 文末 §十六 给出**需求剪裁**（宿主已提供者一律剔除）、§十七 给出**补充需求**。

---

## 〇、可行性裁定（本件的成色保证）

本设计的**每一条承重项只依赖「已核」事实**（类型定义／官方快照可判定的形态）。凡证据不足的宿主行为（记作 `V-0x`），本件**不把它当承重项**，而按下面三法之一处置，使设计**在任一答案下都成立**：

| 待核行为 | 处置 | 裁定后本件如何成立 |
|---|---|---|
| `V-01` 内置工具可否 `remove` | **不依赖**。工具面只做**新增**（把校验件包成新工具）；「关闭内置工具」交权限 `deny` 表达 | 无论可否 remove，均成立 |
| `V-02` 改 options 是否重载 | **不依赖**。所有 options 只在 `setup` 读一次；要求「改配置→重载」的场景**统一走显式重载/重启**，不赌自动重载 | 自动重载与否只影响便利性 |
| `V-04` 被拒调用是否发事件 | **不依赖**。留痕以**规则命中点自写**为主（`evaluate` hook / 工具内），事件流只作**补充** | 事件面缺失不产生空洞 |
| `V-05` 重试上限可否观测 | **不依赖**。retry 策略只做「松/紧」调整，不声称精确计数 | 与上限读数无关 |
| `V-06` tui/server 的 `id` 是否须一致 | **规避**。tui part **显式声明与 server 相同的 id** | 一致即稳，不一致也不亏 |
| `V-07` 插件命令与 md 命令重名裁决 | **规避**。插件命令统一前缀化命名（`/ddd-*`），与 md 命令名**不同名** | 无重名即无冲突 |
| `V-08` TUI 远程 RPC | **降级为可选**。核心命令全走 **server part**；TUI 面板作增强 | 远程不通则面板不显，命令仍可用 |
| `V-09` `experimental.idle` 配额 | **降级为可选**。「收尾软推一次」优先用它；不可用则退化为「收尾门禁硬拦」 | 无 idle 亦有硬拦兜底 |

**结论**：本设计**可在当前 OpenCode v2.2.7 上实现**。承重面（包形态、transforms 注册、hooks 观测、权限执法、会话/存储/事件/RPC/TUI）**全部已核**；待核项仅影响**增强**，不影响**成立**。

**结构可行性已实测**（离线、无模型）：对宿主实装的 `@opencode/plugin@2.2.7` 运行探针通过——证明三 part 包形态可解析、本地目录可解析、`packageID` 规则成立、SDK 导出面存在、transform/hook 回调形态与「权限域无 `transform`」均与类型一致。

---

## 一、定位与等式

- **本方法论产出的是环境，不是功能。** 使用者装入后，在当前项目根搭起设计文档骨架，其后按节点序列与门禁推进**当前项目**。
- 定位依据：`Model × Harness = 最终能力`。模型能力决定上限，本方法论（Harness）决定逼近上限多少。
- 等式：`opencode-plugin + subagent + ddd.methodology = Hermess`。
- **当前项目**：使用者正在开发的那个项目。使用者用 OpenCode 开发 ddd 项目时，当前项目即该 ddd 项目。判定面是「当前项目根是否存在本方法论的骨架与判据件」，**与宿主名无关**。

## 一之附、适用场景（三类）

本方法论须服务三类使用场景。场景**不改变**骨架与门禁本身，只决定**入口节点、步子大小、以及有无一次例外**。

### 场景一 · 项目从零开始选型实现

- **特征**：无既有代码、无既有设计树。
- **入口**：`/ddd-init` → `/ddd-intent` → `/ddd-arch`（选型）→ 全节点序列。
- **特殊**：**选型是重大决策**，须先出书面论证稿（四列对比表）再定；技术栈、核心依赖、目录结构在 `/ddd-arch` 定，设计树自顶向下建。
- **门禁**：G1–G6 全走。

### 场景二 · 二次开发类项目

- **特征**：已有项目与（可能部分的）设计树；工作是**追加功能、追加接口、修改 bug**；在特定场景/框架下**Todo 驱动**。
- **入口**（按需求类型分流）：
  - 追加功能/接口 = **新需求** → `/ddd-intent` → `/ddd-design` → `/ddd-implement` → `/ddd-test`。
  - 修 bug = **FIX 需求** → `/ddd-change` + 最小设计更新 → `/ddd-implement` → `/ddd-test`。
- **特殊**：
  - **Todo 驱动**：每个 Todo 是一条**看板任务**（须带 `acceptance`，见 §六.2 / M7）；外来 Todo 经宿主 `todowrite`（`experimental.todo`）或本项目看板登记，**二者不得重复记账**（见 §十六 与待裁）。
  - 设计更新须**外科式**：只动受影响的节点，不得全量重写设计树。
- **门禁**：以 G3/G4/G5 为主（同构、覆盖、落地非空）；G1（需求冻结）只在有新需求时走。

### 场景三 · 项目迁移

- **特征**：项目已存在（甚至语言/框架要换），**设计树不存在**。
- **特殊——方向反转一次**：正常是「先文档后代码」；迁移期须**先由既有代码反推设计树**。反推件为**一次性产物**，显式标注（`status: draft`，**不得直接 `frozen`**），且**必须可机械对账**（§五.3 声明面与实物双向），否则反推出的设计不可信。反推**核对**后回到正向流程（先改文档再改代码）。
- **入口**：`/ddd-init`（落骨架）→ **反推**（`/ddd-design --from-code`）→ `/ddd-arch` 校验 → 其后同场景二。
- **门禁**：反推件先过 G3（同构）；`landed: true` 只允许在该件被核对后出现。

### 场景对照表

| 维度 | 场景一 · 零起 | 场景二 · 二次开发 | 场景三 · 迁移 |
|---|---|---|---|
| 设计树 | 无 → 自顶向下建 | 有（可能部分）→ 外科式更新 | 无 → 由代码反推 |
| 入口 | `/ddd-init` | 新需求 或 FIX 入口 | `/ddd-init` + 反推 |
| 驱动 | 节点序列 | **Todo 驱动**（看板任务） | 反推 + 节点序列 |
| 例外 | 无 | 允许外科式、允许部分树 | **允许一次「代码 → 文档」反向** |
| 主导门禁 | G1–G6 | G3 / G4 / G5 | G3（反推同构）+ G1–G6 |

- 三者**共用同一套骨架与门禁**；差别只在入口、步子大小、以及有无一次反向。方法论**不得为某场景写死路径**——差异表达为「选走哪些节点」，而非「另起一套流程」。

## 二、目标与非目标

| 项 | 内容 |
|---|---|
| **目标** | ① 一套可机械校验的设计驱动开发流程（设计树 / 测试树 / 变更流 / 门禁）；② 一个可装入 OpenCode 的插件包，提供命令、技能、代理、规则、守卫与报告；③ 对外可对接的改造面（命令、门禁、测试、版本）；④ 知识、规则、反馈三态的沉淀与复用；⑤ **服务三类使用场景**（零起选型、二次开发、项目迁移，见 §一之附）。 |
| **非目标** | 不产出业务功能代码；不产出数据库与后端服务；不产出前端界面；不做模型选型与推理参数调优；不接管宿主的会话存储；不规定使用者项目的业务架构。 |
| **交付判据** | 交付的是「**缺陷已全部登记**的设计」，不是「无缺陷的设计」（登记册是唯一权威处）。 |

## 三、核心原则

1. **文档为唯一权威，代码为其落地。** 顺序固定：先改设计文档 → 再落地为代码；禁止先改代码再回头补设计。**唯一例外**：场景三（迁移）的**一次性反推**——由既有代码反推设计树，反推件须标 `status: draft`、可机械对账、核对后方转正向（§一之附）。
2. **决策纪律。** 重大决策（项目初期、目标变更）须先出书面论证稿：四列对比表（备选项｜证据｜代价｜后续走向），落 `docs/audits/`，登记 `docs/temp.jsonl`，人工裁决后清理。论据须标来源与强度（直接证据／转述／推断），**不接受自述完成**。
3. **三根支柱。**
   - **设计环境**：知识（按需加载）+ 规则（常驻且薄，每条绑定一个执法点）。
   - **明确意图**：动手前把需求澄清到可设计、可验收，并以阻塞方式取得确认。
   - **构建反馈**：建立判定对错的回路，使偏差在发生处即被察觉（测试树 + 机械校验件 + 分层评估）。
4. **四路归因注册口**（Agent 出错时补缺口，而非「再试一次」）：信息缺失 → 补可读状态；知识缺失 → 补可发现知识；规则被忽略 → 补强制执行；工具不匹配 → 改工具本身。
5. **约束三级火箭：建议 → 文档 → 代码。** 同一件事只选一级落点并写明理由；「文档」级须声明靠什么执行，否则等同建议。
6. **Linter 即 Prompt。** 机械判据的报错信息里直接写补救指令；每条判据的输出**必须含补救字段**。
7. **不写提示词的硬约束。** 机械可判定的约束一律落守卫或校验件，不写进提示词；提示词只承担不可机械判定的判断式。
8. **Build to Delete。** 架构像乐高一样松散，每层都能随时撕掉；任何「聪明控制逻辑」须给出它的可删除边界。
9. **The Harness is the dataset。** 留痕是资产不是日志；留痕字段须能回答「在哪一步、因何失守」。
10. **冻结即归并。** 需求、设计、代码在迭代期是「一路叠加的修订」；一旦**冻结**，须做一次**最终版优化转换**——剔除此前累积的**变更记录痕迹**，把产物**重构成最终形态**（而非在旧文上再打补丁）。据此，三类冻结与收尾各带一个**归并步**（见 §六.4），且**强烈建议用子任务（子代理）按模块、目录隔离重构**，以进一步防止上下文污染造成的漂移。**归并只删产物内联的痕迹，不删权威变更流**（审计资产保留）。

## 四、文档体系

### 4.1 四类文档形态

| 形态 | 用途 | 版本策略 |
|---|---|---|
| 当前项目 | 使用者正在开发的项目 | — |
| 多文件 | 时间线或版本化管理 | 按时间/版本分件，不覆盖 |
| 单文件 | 仅此一处 | 永远保持最新，不留历史 |
| 文件树 | 设计按路径逐步细化 | 仅最新版本 |

### 4.2 固定位置（`docs/` 下）

| 路径 | 形态 | 职责 |
|---|---|---|
| `docs/GLOSSARY.md` | 单文件 | 术语唯一权威；新术语先在此补条 |
| `docs/ARCHITECTURE.md` | 单文件 | 架构基线：技术栈、依赖、目录、环境探查、承重机制 |
| `docs/CHANGELOG.jsonl` | 追加写 | 机器变更流，单一真相源 |
| `docs/CHANGELOG.md` | 单文件（派生） | 人读发布记录，由变更流重放 |
| `docs/temp.jsonl` | 追加写 | 临时产物登记，收尾清空 |
| `docs/requirements/` | 三件 | 需求基线、需求摘要历史、进行中需求 |
| `docs/ddd/` | 文件树 | 详细设计树（四级同构，见 §五） |
| `docs/OUTLINE-DESIGN.md` | 单文件 | 概要设计（本件） |
| `docs/reports/` | 派生 | 机械证据：校验输出与测试报告 |
| `docs/audits/` | 派生（临时） | 论证稿落点；登记 `docs/temp.jsonl`，裁决后清理 |
| `docs/maps.json` | 单文件 | 项目图集 delta（`add`/`override`/`disable`） |

### 4.3 根目录文档白名单

仅 `AGENTS.md`、`README.md`、`CONTRIBUTING.md` 三件；第四件文档即违规（机械可判）。

### 4.4 单一权威与反漂移

- **单元权威**：同一事实只在一处定义（记名登记：事实名 → 权威件），其余一律引用不复写；机械判据须能**检出别处的复写**，且权威件自身取值须等于实物。
- **术语唯一权威**：`docs/GLOSSARY.md`。
- **上游受控**：凡引用宿主或第三方文档，引用以**节名与引文**为准，行号只作便利；用页面哈希把「上游原文」与「我们的结论」绑定（见 §十四）。
- **宿主环境信息不入受控件**：绝对路径、主机 OS 与构建号、用户名只入**不入版本控制**的环境记录件；受控报告的根一律写仓库相对形式。

## 五、设计树与测试树

### 5.1 四级同构

`docs/ddd/<X>` 与仓库根 `<X>` 一一对应。四级：

| 级 | 设计件 | 测试件 |
|---|---|---|
| 子项目 | `docs/ddd/<subproject>/DESIGN.md` | `docs/ddd/<subproject>/TESTS-<name>.md` |
| 模块 | `docs/ddd/<subproject>/<module>/DESIGN.md`（核心协议另落 `DESIGN-<core>.md`） | `docs/ddd/<subproject>/<module>/TESTS-<name>.md` |
| 分组（目录） | `docs/ddd/<subproject>/.../<path>/.../DESIGN.md` | 同目录 `TESTS-<name>.md` |
| 文件 | `docs/ddd/<subproject>/.../<path>/.../DESIGN-<filename>.md` | 同目录 `UNIT-TESTS-<filename>.md` |

- **文件级设计件四个必备节**：定位与边界、对外暴露接口、需引入的依赖、调用的模块能力及接口。
- **契约冻结与落地标记**：设计件声明 `status`（draft/frozen）与 `landed`；**`landed: true` 只允许出现在 `frozen` 件上**。

### 5.2 设计件 frontmatter（机械判定前置）

| 键 | 取值 | 必填 |
|---|---|---|
| `doc` | `design` / `unit-tests` / `tests` | 是 |
| `level` | `subproject` / `module` / `group` / `file` | 是 |
| `target` | 对应代码路径（分组及以上为目录路径） | 是 |
| `status` | `draft` / `frozen` / `deprecated` | 是 |
| `landed` | 是否已落地，默认 `false` | 是 |
| `covers` | 本件承诺覆盖的接口标识 | 否 |
| `depends` | 所依赖的其他设计件的 `target` | 否 |
| `updated` | 日期 | 是 |

### 5.3 声明面与实物双向对账（四条同族判据）

1. 声明了但实物没有（含接口签名逐字对账）；
2. 实物导出了但设计一字未提；
3. 源件在设计树里无落点；
4. 引用面不可解析（引的执行件/前置件/夹具须实存）。

> **凭空发明是最重的一类缺陷**：实测实现者发明一个不存在的接口签名并蔓延五份设计件。故签名须与实物逐字对账。

## 六、工作流与门禁

### 6.1 节点序列（命令改造口）

| 命令 | 用途 | 阻塞 |
|---|---|---|
| `/ddd-init` | 在当前项目根落项目级骨架（根文档三件 + `docs/` 结构 + 空图集 + 机器可读快照） | |
| `/ddd-intent` | 明确意图：把需求澄清到可设计、可验收 | ▲ |
| `/ddd-arch` | 生成或更新 `docs/ARCHITECTURE.md` 与目录规划 | ▲ |
| `/ddd-design` | 逐层生成或更新设计树 | |
| `/ddd-review` | 冻结前独立交叉评审接口契约 | |
| `/ddd-test-design` | 生成或更新测试用例树 | |
| `/ddd-implement` | 按冻结契约落代码与单元测试 | |
| `/ddd-test` | 执行四级测试并出报告与缺陷路由 | |
| `/ddd-validate` | 跑门禁、出报告 | |
| `/ddd-change` | 记一条变更流 | |
| `/ddd-map` | 重放图集 | |
| `/ddd-wrapup` | 收尾：清临时件、剔需求、发布版本；含跨树归并终检 | ▲ |
| `/ddd-consolidate [scope]` | **冻结即归并**：按模块/目录隔离重构为最终版（§六.4）；`scope` = `requirements`／`design`／`code`／`all` | ▲（冻结时） |
| `/ddd-design --from-code` | **仅场景三**：由既有代码反推设计树（一次性、须核对） | ▲ |

> 上表是**全集**；三类场景各自只走其中一段（入口与步子见 §一之附）。`--from-code` 只属场景三，且反推件须核对后方可继续。`/ddd-consolidate` 在**需求冻结、设计冻结、代码冻结**三处各触发一次（§六.4）。

> **命令→子代理**（R64）：命令是稳定接口，各节点的具体工作由 `agents/` 的**子代理角色**以子会话承担（上下文隔离）；命令名不变即可替换实现。

### 6.2 门禁

| 编号 | 门禁 | 执行者 | 通过判据 |
|---|---|---|---|
| G1 | 需求冻结 | 人 | 需求件 `status: frozen`，裁决记录无未决项 |
| G2 | 架构就位 | 人 | `docs/ARCHITECTURE.md` 含技术栈、核心依赖、目录结构、环境探查四类内容 |
| G3 | 设计树同构 | 机械 | 同构对账零失败；命令注册表双向核对零失败 |
| G4 | 测试树覆盖 | 机械 | 有文件级设计的源文件全部有对应用例文档 |
| G5 | 落地非空 | 机械 | 判定类表所列各类全通过；交付件存在且大于十字节、schema 合法 |
| G6 | 收尾清空 | 机械 + 人 | `docs/temp.jsonl` 登记项均已清理；看板活跃投影为空；版本已落三处（见 §十一） |

### 6.3 判据的两态

- **机械式**：脚本给出确定结论，须配**反证**（注入式违规样本；判据在反证下不沉默才算成立）。
- **判断式**：由审计逐条给出结论的实施形态。

### 6.4 冻结即归并（最终版优化转换）

> 原则（§三.10）：冻结时把一路叠加的修订**重构成最终形态**，剔除产物内联的**变更记录痕迹**。本节把它落成**触发点、动作、隔离规则与判据**。

**语义界定**——两种「记录」必须分清，不得混淆：

| 类别 | 例子 | 归并时 |
|---|---|---|
| **产物内联的痕迹** | 正文里的「原为 X，现改为 Y」「见 CHG-0132」「（本次修订）」、批注、`draft` 标记、废弃节、TODO 括注 | **剔除**（归并的核心动作） |
| **权威变更流** | `docs/CHANGELOG.jsonl`（含 `rationale`/`outOfScope`/`expectedSignal`） | **保留**（审计资产；归并**不碰**它） |

**三个触发点**（与三类冻结对齐）：

| 触发 | 冻结对象 | 归并动作 | 归并后的门禁 |
|---|---|---|---|
| **需求冻结** | 需求件 `status: draft → frozen` | 剔正文内联痕迹与未采纳备选表述；重构成「当前即事实」的终稿 | G1（四问齐备、待决项为空） |
| **设计冻结** | 设计件 `status: draft → frozen`（含 `landed: true` 前置） | 剔正文内联痕迹；把多轮补丁合并为终稿；契约表述**逐字**对齐实物 | G3（同构/对账）+ §五.3 四判据 |
| **代码冻结** | 实现件达可提交标准 | 剔注释里的临时说明、废弃分支、调试残留；重构成终稿 | G5（落地非空）+ §十二 测试 |

- **收尾（G6）**还须做一次**跨树终检**：确认无遗留的归并残留（内联痕迹、悬空引用、废弃节）。

**隔离规则（防上下文污染）——强烈建议**：

- 归并**不得由原迭代会话就地完成**（原会话已积累大量「为什么改」的上下文，正是漂移之源）。
- 归并**按模块/目录切分，一个子任务（子代理）只负责一块**：子代理**只看该块的目标形态与该块的权威变更流切片**，不看全量历史；多块可并行，互不通信。
- 子代理的**输入面**限定为：①该块的当前产物；②该块对应的变更流条目（只读）；③该块的冻结契约。**不得**把别块的中间推演带进来。
- 归并产物须过**同构/对账判据**（§五.3）：归并不许改变契约语义，只许改变**表述形态**；一旦对账失败即判定为「归并引入漂移」，退回。

**检查点（R63）**：每个冻结点在归并完成后**立即做一次 git 本地提交**作为检查点——需求冻结、概要设计冻结、设计树冻结、代码冻结各一次；提交后工作区须干净。检查点是**可回溯的冻结版本**，不是发布。

**判据**：

- 「无内联痕迹」可机械判：正文不得出现变更流 id（`CHG-####`）、「本次修订」「原为」「TODO」「WIP」等标记词；`status: frozen` 的件不得含 `draft` 标记。
- 「归并不改语义」可机械判：归并前后对**接口签名与 frontmatter** 逐字对账，差异只允许出现在非契约叙述。
- 「子任务隔离」为**判断式**：审计核查归并会话的输入面是否越界（是否读了全量历史）。

**落点（OpenCode）**：归并由 `subagent` 工具驱动（`mode: subagent` 的专用代理如 `ddd-consolidator`），按目录并发；子代理读变更流用只读工具。**归并留痕**：每次归并写一条变更流（`type: docs`），记「本块已归并至终稿」，使归并本身**可审计但不内联**。

## 七、需求与变更流

### 7.1 需求

- 需求文档：`docs/requirements/<req_type>-<req_name>.<status>.md`（类型 `new`/`fix`/`other`；状态 `draft`/`frozen`/`archived`）。
- `docs/requirements/history-requirements.jsonl`：全部需求摘要。
- `docs/requirements/current-requirements.json`：进行中需求（转设计后剔除）。
- **四问**：谁在什么场景遇到什么／要什么可观察的结果／怎么判断做对／本次明确不做。缺一即不可设计。
- **冻结判据**：四问齐备；待决项为空；每条验收线索都能由脚本或明确动作判定。
- **冻结即归并**（§六.4）：冻结的同时做一次最终版优化转换——剔正文内联的变更记录痕迹，重构成终稿；**由子任务按模块隔离完成**。

### 7.2 变更流

- `docs/CHANGELOG.jsonl`，追加写，每行一条独立 JSON，**只经唯一工具写入，禁止手改**（手改可被机械检出）。
- 行契约必备三字段（对「执行过剩」的防线）：`rationale`（为什么做）／`outOfScope`（本次不做什么）／`expectedSignal`（怎么算做对）；另含 `id`/`ts`/`version`/`type`/`docs`。
- 人读件 `docs/CHANGELOG.md` 由变更流**重放**得出，不手写。

## 八、OpenCode 插件实现架构

> OpenCode 的插件模型（一个包、最多四个 part、transforms / hooks / RPC / options）即本方法论的宿主底座。本节把「产出的是环境」落成「一个可 `opencode plugin add` 的插件包 + 在项目里生成的设计文档树」。

### 8.1 包形态与 part 划分

一个插件包 = 一个 npm 包，最多四个 part，共用一个 `@opencode/plugin` 依赖：

| part | export | 运行时 | 本设计取舍 |
|---|---|---|---|
| **server** | `.` 或 `./server` | OpenCode 服务端进程 | **采用**：能力核心——注册命令/技能/代理/工具、挂 hook、实现 RPC、读写项目内权威件 |
| **tui** | `./tui` | 终端客户端 | **采用**：人机交互——斜杠命令、面板、对话框、通知；经 `context.client` 连服务端（支持远程） |
| **rpc** | `./rpc` | 无运行时（契约） | **采用**：server ↔ tui 的类型化契约；契约与实现分离，可被外部客户端 import |
| **gui** | `./gui-experimental` | Desktop 窗口 + 主进程 | **不纳入**（实验性 API；须打成单个 CJS） |

- `id` 由 server part 的 `Plugin.define({ id })` 声明；tui part **显式声明与之相同的 id 前缀**（裁定 `V-06`：不赌宿主是否强制一致）。
- 本地目录形式无 `package.json` 时按默认文件名解析：`server`/`index`、`tui`、`rpc`（`.ts`/`.tsx`/`.js`）。**已实测**（probe P1/P2）。
- `package.json` 须导出 `.`、`./tui`、`./rpc`；`files` 含源码与随包资源；发布前 `npm run typecheck` 与离线自测须通过；**测安装后的包，不只测 workspace link**。
- 宿主 `Plugin.Features` 恰四键（`server`/`tui`/`rpc`/`gui`），与上表一致（已核）。

### 8.2 能力靠 transforms（注册面）

**四类注册口落 transforms**：命令 → `ctx.command.transform`；技能 → `ctx.skill.transform`；代理 → `ctx.agent.transform`；工具 → `ctx.tool.transform`（把校验件包成模型可调用的工具）。

两条铁律：

1. transform 回调**必须同步**：外部数据先 `await` 取好，再在同步回调里注册；数据变化后调 `reload()`。
2. 注册返回 `Registration`，`dispose()` 撤销；`reload()` 重放 transform 但**不重跑 `setup`**。

**工具面只增不移**（裁定 `V-01`）：只做 `editor.add(...)` 把校验件包成新工具，**不依赖「移除内置工具」**；要禁止某内置动作时，用权限 `deny` 表达（见 §九），不赌 `remove` 对内置工具是否生效。

### 8.3 交互靠 TUI part

- `context.keymap.layer` 注册**斜杠命令**（`slash: { name }`）与快捷键（工厂须**纯**）。
- `context.ui.slot/panel` 做**看板与报告面板**；`context.ui.dialog.confirm/prompt/select` 做**阻塞式确认**（对应「明确意图」）；`context.attention.notify` 做长任务提醒。
- **核心命令一律由 server part 提供**（裁定 `V-08`）：server 命令在本地与远程服务器下都成立；TUI 面板与快捷键是**增强**，远程 RPC 不通时仅面板不显，命令仍可用。命令命名**统一前缀化**（如 `/ddd-validate`），与 md 文件命令**不同名**，规避重名裁决（裁定 `V-07`）。

### 8.4 跨部件靠 RPC，契约与实现分离

- `src/rpc.ts` 只放 `Rpc.define`（可被 tui/其他插件/外部客户端 import 而不加载实现），实现在 server part（`ctx.rpc.register`）。
- 外部客户端经 `POST /api/rpc/{rpcID}/{method}` 调用；**入参必须服务端校验**（外部客户端可直连，不能只靠 TS 类型）。
- 事件名用过去式、数据必须是 object；订阅用本地名、收到前缀名 `rpc.<id>.<event>`。

### 8.5 按需装入靠 options

- 使用者在 `opencode.json(c)` 用对象形 `{ "package": "<包名>", "options": {...} }` 声明；`setup(ctx)` 读 `ctx.options`（类型 `Readonly<Record<string, any>>`，值须自行收窄）。
- **options 键集**：`profile`（预设套餐）、`gates`（启停缺省门禁）、`paths`（文档树根）、`blindspotCap`（不可判定放行上限）。据「Manifest + Profile」原则，避免装入不需要的组件产生上下文噪音。
- **options 只在 `setup` 读一次**（裁定 `V-02`）：不依赖「改 options 自动重载」。要求「改配置即生效」的场景，一律走**显式重载/重启**并在文档写明，不赌自动重载。

### 8.6 持久化分层

- **权威事实落项目内 jsonl**（受版本控制、可 diff）：变更流、记忆、看板。
- **运行时状态落 `ctx.storage`**（插件作用域 JSON KV，`get/set/remove/scan`）：游标、去重键、缓存。
- 二者不可混：把权威事实藏进 storage 即从 git 记录里消失，也违反「当前项目的一切体现在文档更新中」。

### 8.7 随包件与项目件分离

- **随包件的根取包根，不得拼项目根**（使用者项目里没有这些目录）。
- **插件子进程不得以宿主进程身份启动**：须显式用 `node` 具名启动，不得用 `process.execPath`；工具路径取包根。
- 随包上下文里的路径须为**包根相对**或**项目相对**，不得写宿主绝对路径。

### 8.8 生命周期与清理

- `setup` 在插件加载时运行，可返回 cleanup（同步或异步）；卸载时所有 registration 自动 dispose。
- 常驻任务用定时器并在 cleanup 清理；`ctx.event.subscribe` 的流用 `AbortController` 终止。
- 插件跑在服务端进程：重 CPU/同步 IO/未捕获异常会拖慢所有会话。

### 8.9 包骨架（可直接实现）

```text
ddd-methodology/
├── package.json            # name、type:module、exports{. , ./tui, ./rpc}、files
├── src/                    # 模块：插件实现（server / tui / rpc 三 part）
│   ├── index.ts            # server part：Plugin.define({ id:"ddd", setup(ctx) })；注册四类 transforms + hooks + RPC
│   ├── tui.tsx             # tui part：面板/对话框/通知（增强）
│   ├── rpc.ts              # rpc part：Rpc.define 契约（server 实现，tui/外部调用）
│   └── lib/                # 分组：共享纯函数（可离线自测）
│       ├── registry.ts     # 注册面清单与自检（给定 ctx，注册命令/技能/代理/工具）
│       ├── router.ts       # 自主注入路由：判相位/意图/场景 → 选最小切片集
│       ├── guard.ts        # 底线守卫：底线清单 → 执法点（permission/tool-hook/gate）
│       ├── gates.ts        # 门禁判据（纯函数，入参为项目状态）
│       └── paths.ts        # 包根/项目根解析（随包件不得拼项目根）
├── scripts/                # 模块：随包工具（离线自测、门禁读取器）
│   └── selftest.mjs        # 离线自测入口：mock ctx 断言 setup 注册了什么
├── assets/                 # 模块：配置基线（命令注册表、门禁规范、注入切片、底线、变体 schema、语言基线）
├── skills/                 # 模块：随包技能（目录形态 SKILL.md + references/）
│   ├── ddd-methodology/    # 方法论主技能
│   ├── frontend-variant-contract/  # 前端通用技能：变体契约奠基（第 0 步）
│   ├── lang/<id>/          # 语言规范技能族（html/css/js/vue/java/python/shell/android/sql/c/cpp/nasm）
│   └── dev-tools/          # 常用开发工具使用规范（含各语言关联工具）
├── agents/                 # 模块：随包子代理角色（md，mode: subagent）；角色清单见 docs/ddd/agents/DESIGN.md
├── .gitignore              # 项目层：node_modules 等不入版本控制
├── .gitattributes          # 项目层：文本统一 LF
├── package-lock.json       # 项目层：依赖锁定
└── docs/                   # 本方法论自身的文档树（对应「本仓既是包又是项目」）
```

- 随包件（`assets/`、`skills/`、`agents/`、`src/lib/`、`scripts/`）**位置取包根**；生成到使用者项目的件（`docs/**` 骨架）**取项目根**。二者不得混用同一拼接基准（§8.7）。
- **离线自测入口**：`node --experimental-strip-types scripts/selftest.mjs .`，用 mock `ctx` 断言「setup 注册了什么」并逐条跑通每个工具/RPC（无模型、无网络）。
- **归并子代理**：`agents/ddd-consolidator.md`（`mode: subagent`），按模块/目录一次性处理一块；经宿主 `subagent` 工具派发（§六.4）。
- **归并命令**：`/ddd-consolidate [scope]`（由 server part 的 `ctx.command.transform` 注册），`scope` 取 `requirements`／`design`／`code`／`all`。

## 九、执法、留痕与插入点

> 本节的实现方式全部由 `@opencode/plugin@2.2.7` 类型定义核实。三条**前提**先立，否则会照搬其它 harness 的错误形态：
> 1. **权限域没有 `transform`**（`permission.d.ts` 只有 `list/get/reply/hook/assert`）——执行规则不能「注册」，只能落**配置**（`permissions`/`policies`）、**会话级替换**（`session.update({permissions})`）或**运行时**（`permission.hook("evaluate")`）。
> 2. **hook 回调返回 `void`**（`registration.d.ts`）——不能靠返回值阻塞；阻塞只能经权限层（`deny`，或 `evaluate` 置 `deny`）或抛错。
> 3. **宿主内置 shell 扫描器**（`raw/permissions.md` 的 Scanner 节）：跨 Bash/Zsh/sh/PowerShell，遇到无法安全分析的动态命令**返回 scanner error 而非执行**（fail-closed）。故「形态层」**不自造**。

### 9.1 规则落点（按「静态→动态」分三类）

| 类别 | 落点 | 说明 |
|---|---|---|
| **静态可判规则** | 权限规则 `{action, resource, effect}`（配置 `permissions` 或组织 `policies`） | last-match-wins；`effect ∈ allow/deny/ask` 即失败语义三分的静态面 |
| **项目登记规则** | `session.update({ sessionID, permissions: Ruleset })` | 在 agent 规则**之后**评估，last-match-wins；这是「项目门禁对接为可执行规则」的宿主落点 |
| **需动态判断的规则** | `permission.hook("evaluate")` | 对 `allow`/`ask` 运行；可置 `event.effect = "deny"` 与 `event.message`（补救话术）。**显式配置的 `deny` 是终判，不调 hook** |
| **命令串形态** | 宿主内置扫描器承担 | 方法论只补**语义级**规则，不重写命令黑名单 |

**每条执行规则须能落成以上三者之一**；落不进的就是「纸老虎」，不得声称已强制。

### 9.2 失败语义三分

| 语义 | OpenCode 落点 |
|---|---|
| 阻塞 | 权限 `effect: deny`；或 `evaluate` hook 置 `deny` 且 `message = <补救话术>`（补救随拒绝原因回模型）；或工具内 `permission.assert` 被拒抛 `Tool.Error` |
| 可见 | 读数入册但不拦（`ctx.event.subscribe` 留痕） |
| 不适用 | 判定对象不存在，退出码零；**不得与「通过」塌成同一读数** |

- **缺省无匹配规则时取 `ask`**（不是 `allow`），符合「默认拒绝」。
- **审批风控须 fail-safe**：`evaluate` hook 里 LLM 判断解析失败时倾向 `ask`，不得默认 `allow`。
- **不可判定（scanner 无法分析）由宿主 fail-closed**，方法论不自建该层。**留痕以自写为主**（裁定 `V-04`）：规则命中即在 `evaluate` hook／工具内**同步自写**一条 jsonl；`ctx.event.subscribe` 的事件流只作**补充**——能收到就多一条，收不到也不损功能。

### 9.3 留痕

- **自写为主、事件为辅**（裁定 `V-04`）：规则命中点同步自写 jsonl（不赌事件面）；`ctx.event.subscribe({ types, signal })` 订阅事件流（`session.tool.*`、`session.execution.*`、`permission.asked/replied`、`session.compaction.*`、`filesystem.changed` 等）作**旁证**。游标与去重键落 `ctx.storage`。
- **留痕字段须能回答「在哪一步、因何失守」**：事件类型、命中层、规则 id、被判对象、补救话术、去重键。
- **hook 非 exactly-once**：`prompt` hook 并发可能执行多次。凡「写一次留痕」「精确计数」须用去重键（`sessionID/messageID/id`），不得依赖钩子次数。
- 注意：插件在服务端进程内，**收不到 `server.connected`**（`event.d.ts` 已 `Exclude`）；未知事件类型被警告并忽略。

### 9.4 插入点总表

| 钩子 / 事件 | 时机 | 动作 | 能否阻塞 |
|---|---|---|---|
| `session.hook("prompt")` | 用户 prompt 准入 | 注入随包上下文；脱敏；**幂等** | 否（无类型化拒绝 API） |
| `session.hook("context")` | 每次模型请求前 | 注入看板摘要/坑点索引；`delete event.tools.X`；改 `event.options` | 否（只影响本次出站请求） |
| `tool.hook("execute.before")` | 工具执行前 | 参数规范化/脱敏；替换 `event.input` | 否（拦走权限层） |
| `tool.hook("execute.after")` | 工具成功/失败后 | 审计、打标、挂验收证据 | 否 |
| `permission.hook("evaluate")` | 规则评估后、执行/弹窗前 | 企业策略/LLM 二次判断；置 effect/message；**fail-safe**；**在此自写留痕** | **是（置 deny）** |
| `shell.hook("create.before")` | shell 命令创建前 | 强制沙箱变量；限制超时（**毫秒**）；注入代理 | 否 |
| `session.hook("retry")` | 失败已分类、重试未调度 | 重试松/紧调整（`delay` 单位**毫秒**）；**不声称精确计数**（裁定 `V-05`） | 否 |
| `session.hook("compaction")` | 压缩摘要请求 | 压缩前存证；可自带 `result` 跳过模型调用 | 否 |
| `session.hook("experimental.idle")` | 会话将 idle、无待处理输入时 | **可选增强**：收尾「软推一次继续」；不可用则退化为收尾门禁硬拦（裁定 `V-09`） | 否（经准入输入促其续跑） |
| `ctx.event.subscribe(...)` | 全生命周期 | 异步审计、外部同步、失败编排（**旁证**，非承重） | 否 |
| `setup(ctx)` 的 transform | 插件加载时 | 注册命令/技能/代理/工具；**同步、可重放** | — |

### 9.5 「明确意图」的取得确认

- TUI part 的 `context.ui.dialog.confirm/prompt/select` 是**阻塞式**确认原语；server part 侧为 `ctx.permission.assert`。二者须显式择一，不得同时承担同一个确认点。

## 十、门禁、测试、版本与项目的对接（最要紧的一条）

> 「对外提供 Commands 改造口」的推广：**门禁也该是改造口**。方法论定义规范并只自带一套缺省实现；项目按规范登记自家的门禁／测试／版本落点。

### 10.1 规范与实现分离

- **对接规范的最小字段集**（每道门禁一条）：`id` / 判面（判什么、不判什么）/ 执行者 / 读数形态 / 完成判据 / 失败语义（阻塞·可见·不适用）/ 是否入节点源。另留 `ext` 扩展位。
- **登记面必须自省**：每道门禁（无论缺省还是项目登记）须自报：判面、判定对象数、未识别形态数；且**「零 FAIL」与「无判定对象」必须是两个读数**。
- **两套主体不混用**：贡献者面（保证分发的配置正确）与使用者项目面（保证按需装入）须分开。
- **缺省集地位**：可被项目停用，但**停用须在项目配置里显式登记**（不许静默消失）。
- **约束落在最便宜处**：修正便宜、等待最贵；第一选择是「自动检查 + 快速反馈」，而非「等人批准」；须人判的必须标明阻塞什么、阻塞多久。

### 10.2 按需装入

- 以 **Manifest**（本项目需要哪些组件）+ **Profile**（预设套餐）声明，对接 OpenCode 原生的 `plugins` 对象形 `options`（§8.5），不自造装载机制。
- 停用语义对接 `plugins` 数组的 `-<id>`（显式停用）。

## 十一、版本与临时件

- **版本号**：`v<A>.<B>.<C>`；A 全局重构性变更，B 新需求变更，C FIX 与其他变更；未明确要求时默认 +1。
- **版本落点恰为三处**（G6 须逐处可判）：① `package.json` 的 `version`；② 变更流 `docs/CHANGELOG.jsonl` 对应记录；③ 使用者 `opencode.json(c)` 的**钉版声明**（`<包名>@<version>` 或完整 Git commit）。
- **不得回写已发布版本组**：版本一经打 tag，其后追加的变更须落新版本组，否则三处一致地一致在旧号上、掩盖发布边界。
- **临时件**：产生即登记 `docs/temp.jsonl`（**仓库相对路径**）；收尾按登记清理，完成后清空该件。
- **收尾命令面须与门禁判据面同构**：收尾每一步须有判者，或有明确文字说明它不可机械承接。
- **收尾含跨树归并终检**（§六.4）：确认无遗留的内联痕迹、悬空引用与废弃节；三类冻结的归并若未做，收尾补做。

## 十二、测试与评估

- **四级测试**：文件级 → 分组级 → 模块级 → 子项目级；有问题退回实现层迭代，直至通过。
- **用例被声明即有执行面**：声明的每条用例编号须在测试语料里出现过；编号**全局唯一**；未落地报「待落地」而非「缺陷」。
- **三种验证手段**（须并存）：① 无模型自测（注册面与纯函数断言，离线可跑）；② 类型检查（契约版本匹配）；③ 真跑（端到端需模型，须显式指示模型调用某工具）。
- **评估金字塔与纵深防御**：代码评分器 80% + 模型评分器 15% + 人类 5%；四层纵深（代码全覆盖同步拦截 → 模型抽样 10–20% → 规则引擎 → 人类关键节点）。**门禁＝全覆盖同步拦截那一层；评估＝抽样异步度量**，二者显式分开。
- **统计判据成对报告**：`Pass@k`（能力上限）与 `Pass^k`（可靠性下限）。
- **评估漂移自省**：通过率方差趋近零说明评估失效；模型升级后须人工抽检。

## 十三、承重机制清单

承重机制＝被多个环节消费、缺失即导致整体设计失效的机制；缺失时不得以约定替代。

| 编号 | 机制 | 缺了会坏在哪里 | 机械承接 |
|---|---|---|---|
| M1 | 设计树机器可读快照 | 同构/覆盖/漂移不可判定，文档退化为不可判定大散文 | 受控 frontmatter + 重放生成快照 |
| M2 | 变更流 | 「为什么改/本次不做什么/怎么算改对」永久丢失 | `docs/CHANGELOG.jsonl` 唯一写入工具 |
| M3 | 落地门禁 | 实施者自陈不可信；「做错了报告做对了」是跨会话最大风险 | 交付件非空 + schema 合法 + 快照一致 + 白名单 |
| M4 | 命令改造口 | 使用者无法适配；命令与代理定义耦合 | 入口层与声明式注册表**双层双向对账** |
| M5 | 意图澄清 | 需求未澄清即推进，实现期无限扩张 | 阻塞式确认（TUI dialog / `permission.assert`） |
| M6 | 记忆闭环 | 同类的坑反复踩；经验随会话消失 | `memory.jsonl` 记忆条目 + 晋升 + 衰减 |
| M7 | 看板闭环（**持久多步待办**） | 规划任务被忘、「做一半丢一半」；宿主 `todowrite` 实验性且会话级，跨会话/压缩即丢 | `docs/board/board.jsonl`（append-only、单一真相源）＋ 投影 ＋ 每步注回上下文 ＋ 收尾活跃投影为空（G6） |
| M8 | 执行规则闭环 | 工具调用无门禁；危险/越界命令无拦 | 规则落点三分（权限配置 / `session.update` / `evaluate` hook）＋ **对接宿主内置扫描器**（fail-closed；不自建命令黑名单，见 §十六） |
| M9 | 图集重放与巡检 | 关系类缺陷读文本看不出，画成图才显形 | 从设计树与基线重放产出图；产图者不宣判 |
| M10 | 单点权威与反漂移 | 同一事实被手写多遍，「部分修复」反复发生 | 权威登记 + 扫描复写 |
| M11 | **项目对接规范**（本版新立） | 方法论把开发仓处境当成使用者项目处境，每次「不一样」即一条缺陷 | 规范字段集 + 契约形态判据 + 登记面自省 |
| M12 | **冻结即归并** | 产物随迭代内联累积「变更记录痕迹」，冻结后仍是「补丁摞补丁」，读者读到的是修订史而非事实；就地归并又会被原会话上下文污染而漂移 | 冻结触发归并（§六.4）＋ 内联痕迹与契约语义双向对账 ＋ **子任务按模块/目录隔离** |
| M13 | **自主注入与底线守卫** | 依赖使用者手动提示 skill/纪律 → 漏提示即失守；只靠提示词又挡不住模型带偏 | 注入层（router + `context` hook/`instructions.entry`，幂等、可删）＋ 守卫层（底线清单 → 机械执法点）；两层分离（§十九） |

## 十四、可复用工程机制

- **上游漂移的哈希绑定**：原文快照 + 每页 SHA-256 的 manifest + 每篇结论「基于哪些页的哪个哈希复核过」的 reviewed 基线；上游一变即知哪些结论需重读。
- **离线自测 harness**：用 mock 的插件上下文加载入口，断言「setup 注册了什么」并逐条跑通每个工具/RPC，使无模型、无网络、配额耗尽时也能回归。
- **随包记忆的初版坑点**（OpenCode 语义，须带症状与根因；**只收「会反复踩且宿主不会替我们拦」的**，宿主文档已覆盖的不重复收）：
  1. transform 里 `await` → 注册表重建不可预测；
  2. `reload()` 不重跑 `setup` → 误以为重载会重新初始化；
  3. prompt hook 非 exactly-once → 用它做计费/审计会并发重复计数；
  4. `options` 里 `undefined` 是「回落默认」，不是「删除默认」；
  5. 显式 `deny` 不进入 `evaluate` hook → 想在 deny 上再加工会落空；
  6. **hook 回调不能阻塞**（返回 `void`）→ 想「拦下」只能走权限层或抛错；
  7. **权限域无 `transform`** → 执行规则只能落配置 / `session.update` / `evaluate` hook。
  - （`http` body 一次性流、`server.connected` 收不到、无 `/api/tool` 端点三条已见宿主文档，**移出随包记忆**，改为运行期 TODO 时查宿主文档。）

## 十五、关键取值（已定）

> 以下取值**已定**，使本件完整自洽、可直接进下一层。

| # | 事项 | 取值 | 说明 |
|---|---|---|---|
| 1 | 设计树目录前缀 | **`docs/ddd/<subproject>/`** | 全局件与子项目件分层，避免与 `docs/ARCHITECTURE.md` 等同层互斥 |
| 2 | 根文档集合 | **`AGENTS.md` / `README.md` / `CONTRIBUTING.md` 三件** | 以 §四.3 为准 |
| 3 | 「规范 + 项目对接」立项 | **立项为承重机制 M11** | |
| 3a | 对接字段集 | **冻结为七字段 + `ext` 扩展位** | 冻结即须配契约形态判据 |
| 3b | 项目登记的门禁能否阻塞 | **允许阻塞，但须显式声明阻塞面与时长** | |
| 3c | 缺省集能否停用 | **可停用，但须显式登记（不许静默）** | 对接 `plugins` 的 `-<id>` |
| 4 | `docs/audits/` | **保留，定位为派生/临时件**（登记 `docs/temp.jsonl`，裁决后清理） | 落 `docs/` 下，不入根白名单 |
| 5 | 交付 part 面 | **server + tui + rpc 三 part，GUI 不纳入** | |
| 6 | 命令入口主形态 | **静态命令用 `.opencode/commands/*.md`；需读项目状态或挂 hook 的命令用 `ctx.command.transform`** | 两形态并存须一条双向对账判据 |
| 7 | 参考库纳入方式 | **只引用，不拷入本仓** | |
| 8 | `reqId` 与版本位 | **沿用 `hermess-redesign`；`targetVersion: 1.0.0`** | 宿主更换属全局重构性变更（A 位） |
| 9 | 场景三反推件是否可直接 `frozen` | **不可**；只能 `draft`，核对后转正向再冻结 | 防止反推出的设计冒充既定 |
| 10 | 场景二 Todo 记账处 | **本项目看板**（宿主 `todowrite` 仅作临时便签，不产生 `acceptance`） | 避免两处记账不一致 |

## 十六、需求剪裁（OpenCode 已提供者，一律剔除）

> 原则：**凡宿主已提供的，方法论不得再实现**。早期概要设计来自非 OpenCode 宿主，许多能力当时须自造；换成 OpenCode 后，其中相当一部分已是**内置**。本节逐条裁定：**剔除**（删需求）／**对接**（改写为配置或调用宿主）／**保留**（宿主确实没有，须自建）。剔除后本方法论的体积显著缩小，且更不易与宿主漂移。
>
> 每条给**判据**：若某需求能被一条宿主配置或一个内置工具**完全覆盖**，即剔除；若只被覆盖一部分，改写为「对接 + 保留差额」。

### 16.1 明确剔除（宿主已提供，删需求）

| 原需求/机制 | 为何剔除（宿主已提供） | 出处 |
|---|---|---|
| **规则层「命令串形态黑名单」**（自建 shell 解析与危险命令清单） | 宿主**内置 shell 扫描器**跨 Bash/Zsh/sh/PowerShell，多子命令与 `cd` 目标逐个判，无法安全分析即 fail-closed | `raw/permissions.md`（Scanner） |
| **规则层「路径越界判定」**（自建路径归一与允许前缀） | 归属**权限规则** `external_directory` + `read`/`edit` 的 `resource` 匹配（含 `~`、通配、Windows 大小写不敏感） | `raw/permissions.md`（Rules/Directories/Actions） |
| **「超时注入与钳位」**（自建默认超时与上限） | `shell.create.before` hook 事件直接携带 `timeout`（毫秒）可改；这是宿主面，不是方法论的规则文本 | `promise/shell.d.ts`；`raw/build__plugins__server.md`（Shell） |
| **「格式与 lint 自动修复」判断式** | 宿主 `formatter` 在 `write`/`edit`/`patch` 后自动格式化；命令文件里的 `` !`cmd` `` 可插入 shell 输出 | `raw/config.md`（Formatter）；`raw/commands.md`（Shell） |
| **「忽略非受控面」的扫描跳过集**（依赖/产物/缓存） | 宿主 `watcher.ignore` 管文件监控；方法论的自建扫描只需**复用同一清单**，不必各写一份 | `raw/config.md`（Watcher） |
| **「工具输出截断」** | 宿主 `tool_output.max_lines/max_bytes` | `raw/config.md`（Output） |
| **「会话内临时清单」UI（不持久）** | 宿主 `experimental.todo` 给 `todowrite`（**实验性、会话级**）；**持久多步跟踪不在此列**（见 M7 看板，自建） | `raw/config.md`（Todos） |
| **「模型/提供方白名单与预算」** | 宿主 `providers` 配置 + `ctx.provider/model.transform`；方法论不必自建模型治理 | `raw/config.md`（Providers）；`raw/build__plugins__server.md` |
| **「MCP 服务器增删」** | 宿主 `mcp.servers` 配置 + `ctx.mcp.transform` | `raw/config.md`（MCP） |
| **「参考资料注入」** | 宿主 `references` 配置（本地目录/Git 仓库）+ `ctx.reference.transform` | `raw/config.md`（References）；`raw/references.md` |
| **「子代理启动」机制** | 宿主 `subagent` 工具 + `agents` 配置（`mode: subagent`）；`experimental.subagent_depth` 控嵌套 | `raw/tools.md`（Subagent）；`raw/config.md` |
| **「会话重命名/移动、worktree 创建/列举/删除」** | 宿主 `opencode` Code Mode 命名空间已含 `session_rename/session_move`、`worktree_create/list/remove` | `raw/tools.md`（Sessions/Worktrees） |
| **「审批评审 / 敏感操作二次确认」** | 宿主 `permission.assert` + 权限 `ask`；工具 `Options.permission` 可命名 action | `raw/build__plugins__server.md`（Permissions） |
| **「组织级硬策略」** | 顶层 `policies`（`opencode.config.policy` 内置插件，仓库不可关闭） | `raw/permissions.md`；`raw/plugins.md` |
| **「上下文压缩策略」** | 宿主 `compaction`（auto/keep/buffer、原生 provider compaction、后台压缩） | `raw/config.md`（Compaction） |
| **「长任务完成提醒」** | TUI `context.attention.notify`（含声音、可 blur 触发） | `raw/build__plugins__cli.md`（Notifications） |
| **「代码块渲染器扩展」** | TUI `context.markdown.registerCodeBlockRenderer`；GUI `CodeBlock` | `raw/build__plugins__cli.md`；GUI 文档 |
| **「原生浏览器自动化」** | 宿主 `browser` Code Mode 命名空间（标签/导航/截图/控制台/网络/性能） | `raw/tools.md`（Browser） |
| **「Web 搜索源」** | 宿主 `websearch` 工具 + `websearch.provider` 配置 | `raw/tools.md`（Websearch）；`raw/config.md`（Search） |
| **「项目指令加载」机制** | 宿主 `AGENTS.md` 发现 + `instructions` 配置（含 glob/URL、就近加载、变更热更） | `raw/instructions.md` |
| **「技能/命令发现」机制** | 宿主自动发现 `.opencode/skills/`、`.opencode/commands/`、`.opencode/agents/`，并支持 `skills` 配置数组与 HTTP 目录 | `raw/skills.md`、`raw/commands.md`、`raw/config__agents.md` |

### 16.2 改写为「对接」而非「自建」

| 原需求/机制 | 改写后 | 依据 |
|---|---|---|
| 门禁「注册表 + 双向对账」（自建命令注册表校验） | 命令**发现**交宿主；方法论只保留**命名规范**与「本项目命令清单」文档，不再自建发现器 | `raw/commands.md`（Loading） |
| 「能力层：关闭工具」 | 交**权限 `deny`** 表达；不自建活动工具集开关（`V-01` 亦不依赖） | `raw/permissions.md` |
| 「留痕源：事件流」 | 改为**自写为主、事件为辅**（`V-04`）；宿主事件只作旁证 | §九.3 |
| 「临时目录/工作树」 | 交宿主 `worktree.*` 与 `worktree` 配置；方法论只管把**落点写进文档** | `raw/config.md`（Worktrees） |
| 「截图/可视证据」 | 交宿主 `browser` 命名空间；方法论只规定「何时要求取证」 | `raw/tools.md`（Browser） |

### 16.3 保留（宿主确实没有，须自建）

> 这些是本方法论**不可让渡**的核心，宿主不提供：文档权威与反漂移、单一真相源与自省、变更流三字段、四级同构设计/测试树、门禁与项目对接规范、记忆闭环、图集重放、缺陷登记册。

| 保留项 | 为何宿主不提供 |
|---|---|
| 设计树/测试树 + frontmatter 契约 + 同构/覆盖/漂移四判据 | 宿主无关文档骨架 |
| 变更流 `CHANGELOG.jsonl`（为何改/本次不做/怎么算对） | 宿主无此语义 |
| 单一真相源 + 派生物重放 + 权威登记 | 方法论纪律 |
| 门禁与「项目对接规范」 | 方法论的规定形态 |
| 记忆闭环（坑点晋升/衰减） | 宿主无跨项目经验沉淀 |
| 图集重放与巡检 | 宿主无关系类缺陷显形 |
| 缺陷登记册 + 诚实界定 | 方法论纪律 |

### 16.4 本节的净效果

- **删除**约二十类「原须自建、现宿主已提供」的需求；方法论从「再造一个 harness」收缩为「**规定纪律 + 对接宿主**」。
- 新增 §17「补充需求」（宿主插件模型**新开**的面）。

## 十七、补充需求（OpenCode 插件模型新开的面）

> 与 §十六 相反方向：换宿主后**新出现**、原概要设计未涵盖、且价值明确的能力。每条给**落点**与**判据**，标「补」。

| # | 补充需求 | 落点（OpenCode） | 判据 |
|---|---|---|---|
| 补-1 | **TUI 交互层**：本方法论此前无终端 UI。补看板/报告斜杠命令、会话侧面板、阻塞式确认对话框、长任务通知 | `tui` part：`context.keymap.layer`、`context.ui.slot/panel`、`context.ui.dialog.*`、`context.attention.notify` | 「明确意图」的取得确认有阻塞原语；看板/报告可在终端直读 |
| 补-2 | **跨部件契约（RPC）**：server 与 tui/外部客户端之间的类型化方法/事件 | `rpc` part：`Rpc.define` + `ctx.rpc.register`；HTTP `POST /api/rpc/{id}/{method}` | 契约与实现分离、可被他人 import；入参服务端校验 |
| 补-3 | **组织级策略对接**：把「团队硬约束」落到宿主 `policies`，而非仅项目配置 | `policies` 配置（`opencode.config.policy` 不可关闭） | 组织约束在仓库外强制，仓库不可关闭 |
| 补-4 | **会话级权限注入**：项目登记的门禁**运行时**落为会话规则 | `ctx.session.update({ permissions })` | 项目门禁可执行、last-match-wins、在 agent 规则之后 |
| 补-5 | **事件留痕**：订阅 `session.tool.*`/`session.execution.*`/`permission.*` 等做审计与外部同步 | `ctx.event.subscribe({ types, signal })` | 留痕字段能回答「在哪一步、因何失守」 |
| 补-6 | **程序化会话驱动**：CI 失败自动开分析会话、批量归档、注入动态上下文 | `ctx.session.create/prompt/generate/command/synthetic/instructions.entry` | 自动化场景有机械入口 |
| 补-7 | **按需装入（Manifest + Profile）**落到宿主原生 `options` | `opencode.json(c)` 对象形 `plugins` + `ctx.options` | 不装不需要的组件，减少上下文噪音 |
| 补-8 | **模型治理**：白名单/预算/路由/私有网关 | `ctx.provider.transform`、`ctx.model.transform`、`session.hook("experimental.model.resolve")` | 模型使用受控且可观测 |
| 补-9 | **审批风控**：LLM 二次判断、按路径/命令的企业策略 | `permission.hook("evaluate")`（fail-safe） | 危险动作在弹窗前被拦或升级 |
| 补-10 | **离线自测面**：注册面可被 mock `ctx` 断言 | 随包 `selftest`（`node dist/lib/selftest.mjs <插件目录>`） | 无模型、无网络可回归 |
| 补-11 | **上游漂移自省**：宿主文档/类型版本与结论绑定 | 哈希 manifest + reviewed 基线 | 宿主升级即知哪些结论需重读 |
| 补-12 | **随包上下文注入**：把「关键纪律 + 随附片段」注入准入/请求 | `session.hook("prompt")`（幂等）与 `session.hook("context")` | 不写提示词的硬约束照旧（§三.7），注入只承担不可机械判定者 |
| 补-17 | **冻结即归并**：三类冻结各触发一次最终版优化转换，剔内联痕迹、重构为终稿 | `/ddd-consolidate`（server part 注册）＋ `agents/ddd-consolidator`（`mode: subagent`）；经 `subagent` 工具按模块/目录隔离 | 冻结件无内联痕迹（`CHG-####`/「本次修订」/`draft`）；归并前后契约逐字对账；归并留一条变更流 |
| 补-18 | **前端变体契约（第 0 步）**：UI 生成前枚举合法变化空间 | `skills/frontend-variant-contract/`；`docs/variant-contract.json`（单点权威）；`theme-config` 重放生成；变体审计＝项目登记门禁 | 五维封闭枚举；`allowedTokenLayer`/`forbiddenCrossEffects`；入口仅 shell |
| 补-19 | **自主注入（零手动提示）** | `src/lib/router.ts` ＋ `session.hook("context")`/`instructions.entry`；切片表 `assets/injection-slices.json` | 不输入 skill 名也注入；幂等、不占轮次 |
| 补-20 | **语言/工具规范技能** | `skills/lang-<id>/`、`skills/dev-tools/`；机械值落 `assets/lang-<id>.json` | 按需注入；正文无具体阈值；基线可覆盖并登记 |

- 补充项的取舍须过三问（§三.5 约束三级火箭）：① 它能否被机械判定？能 → 落守卫/权限；② 它是否机械可判定却写进了提示词？是 → 违规；③ 它的可删除边界在哪（Build to Delete）？

### 17.1 场景驱动的补充（由 §一之附 三类场景导出）

| # | 补充需求 | 落点（OpenCode） | 判据 |
|---|---|---|---|
| 补-13 | **场景分流**：进入项目时判定场景（零起／二次开发／迁移），据此选入口与步子 | `session.hook("prompt")` 注入场景声明；或 `/ddd-init` 时生成场景标记件 | 场景可判定且可变更；不同场景走不同节点段 |
| 补-14 | **报错即改的最小闭环**（场景二 FIX） | 看板任务（带 `acceptance`）+ `tool.hook("execute.after")` 挂证据 | FIX 需求走变更流 + 最小设计更新，不重建设计树 |
| 补-15 | **TODO 驱动**：外来 Todo 登记为看板任务，逐条推进 | 宿主 `todowrite`（`experimental.todo`）或本项目看板；二者择一记账 | 每条 Todo 有 `acceptance`；无验收判据者不进板 |
| 补-16 | **代码 → 设计反推**（场景三，一次性） | `/ddd-design --from-code`；产出件标 `draft` 并强制对账 | 反推件过 §五.3 双向对账；`landed: true` 须核对后 |

---

## 十八、前端通用技能：变体契约奠基（第 0 步）

> **一句话**：既有的执行期约束让 Agent 在「允许的颜色和间距」里工作；本技能（第 0 步）让 Agent 在「允许的变化维度」里工作。二者叠加，主题风格才真正被钉死在一个**有限、可枚举的设计空间**内。

### 18.1 定位与适用

- **随包技能** `skills/frontend-variant-contract/`，在 `/ddd-arch`（架构就位）阶段按需载入；不是另立体系。
- **适用**：场景一（零起）、场景二（首次接入 UI 开发）。**场景三（迁移）**：随反推设计树一并反推，标 `draft`。**纯原型/一次性页面**：显式跳过（自由度优先），并在需求里登记「跳过」。
- **不引入**多 Harness 规则文件（`CLAUDE.md`/`.cursor/rules`）；只用宿主 **`AGENTS.md`** 与技能 `references/`。

### 18.2 五步（保留原思想，落点改为 ddd 兼容）

| 步 | 动作 | ddd 落点 |
|---|---|---|
| 1 | **枚举变化维度**：主题模式/品牌租户/密度/强调色/圆角风格，每维**封闭枚举** | 写入 `docs/variant-contract.json` 的 `dimensions` |
| 2 | **影响范围**：每维声明 `allowedTokenLayer` 与 `forbiddenCrossEffects`；不支持组合入禁止清单 | 同文件每维字段 |
| 3 | **固化为机器可读契约**：五维＋范围＋反模式；`theme-config` 由其**重放**生成 | `docs/variant-contract.json`（单点权威）＋ `docs/ARCHITECTURE.md`「变体契约」段（只引用） |
| 4 | **变体入口唯一**：切换只在应用 shell；组件只消费语义 token，不接受风格发明参数 | 落为**项目规则**（R34：须有执法点） |
| 5 | **确定性审计**：检测多处写入点、未声明值、非法风格 props | **项目登记门禁**（R28 七字段），非 ddd 内置 G1–G6 |

- **默认建议（非硬法则）**：总维度 ≤3；强调色、圆角各 ≤2。**超限须附代价说明**，可改（Build to Delete）。

### 18.3 与 ddd 机制的对齐（关键，避免不兼容）

- **单点权威（M10）**：变体取值只在 `docs/variant-contract.json` 写一次；`docs/ARCHITECTURE.md` 与技能正文一律**引用不复写**。
- **派生物由重放生成（§四.2 派生件规则）**：`theme-config` 是**派生件**，禁手改；与契约重放不一致即失败。
- **失败语义三分（§十.1）**：变体审计 `block`（非法值、多处写入点）；且**两类失败分开**——`token 值违规`（硬编码颜色等）与`变体契约违规`（越界变化）**各给独立 remedy**（Linter 即 Prompt）。
- **门禁对接（R28）**：变体审计作为**项目登记门禁**，须自报 `id`/判面/执行者/读数形态/完成判据/失败语义/是否入节点源；自省字段齐备。
- **不上升为 ddd 全局机制**：token 三层（Primitive→Semantic→Component）仅作**前端技能内部知识**（`references/`），不进 ddd 的承重机制清单。

### 18.4 落点与原设想的差异（已剔除的不兼容项）

见 `docs/REQUIREMENTS.md` §四·丑「磨合边界」表：根 `DESIGN.md`→`ARCHITECTURE.md`；未定位置的契约→`docs/variant-contract.json`；`theme-config` 作输入→改为派生件；`CLAUDE.md`/`.cursor`→仅 `AGENTS.md`；硬前置「5 步体系」→可选对接；lint 内建→项目登记门禁。

---

## 十九、自主注入与底线守卫（核心机制 · M13）

> **诉求**：使用者不必手动 `@skill` 或敲命令；插件**自主抉择注入合适内容**引导 agent，同时**机械守住底线**不被带偏。
> **前提（两句必须同时成立）**：注入是**引导**（可删、可被绕过）；底线是**机械强制**（绕不过）。二者混为一谈即失效。

### 19.1 两层分离

| 层 | 目的 | 手段（OpenCode） | 能否被绕过 |
|---|---|---|---|
| **注入层**（引导） | 在对的时机给对的**最小**内容 | `session.hook("context")` 推 `event.system`/`event.messages`；`ctx.session.instructions.entry.put`（**键控**、渲染 `<context key>`、不占轮次） | 可（故只作引导） |
| **守卫层**（底线） | 不让 agent 带偏 | 权限 `deny` / `permission.hook("evaluate")` / `tool.hook("execute.before")` / 门禁 `block` | 不可 |

- **铁律**：能机械判定的底线，**绝不只写进注入文本**（§三.7）。注入只承担不可机械判定的引导。

### 19.2 自主判定（router，`src/lib/router.ts`）

输入三类信号，输出**最小切片集**：

| 信号 | 来源 | 用途 |
|---|---|---|
| **相位** | `/ddd-*` 命令执行时写 `instructions.entry` 键 `ddd:phase` | 命令驱动，最确定 |
| **意图** | `session.hook("prompt")` 读文本/附件（启发式；可选 `experimental.generate.decisions` 分类，仅准入一次控成本） | 场景二无命令时的补充 |
| **场景** | 补-13 的场景标记（零起/二次开发/迁移） | 决定切片族 |

- 映射表在 `assets/injection-slices.json`：`(phase,intent) → sliceIds`（单点权威）。
- **判定必须可观测**：注入的 `sliceId` 与判定依据入留痕。

### 19.3 注入（幂等、不占轮次、渐进式）

- **键控**写入：`Id = ddd:<sliceId>`；同键重复写是**更新**，不重复注入；不产生对话轮。
- **最小切片**：只注入当前相位必需者；全文留 `skills/**/references/` 按需读（渐进式披露）。
- **幂等键**：跨重试/并发用 `sessionID+sliceId`；`ctx.storage` 存去重游标。

### 19.4 底线（guard，`src/lib/guard.ts` + `assets/bottom-lines.json`）

| 底线（例） | 执法点 |
|---|---|
| 文档先行：未改设计不得改代码 | 门禁 `block`（G3/契约对账）＋ `tool.hook("execute.before")` 观测 |
| 变体契约不越界 | 项目登记门禁（R51）`block` |
| 门禁未过不推进 | `permission` / 门禁 `block` |
| 归并不删变更流 | `permission` 对 `CHANGELOG.jsonl` 的写操作 `deny`（除唯一工具） |
| 不硬编码视觉值 | 项目登记门禁（R51）`block` |

- 每条底线**必须声明执法点**；**落不进执法点的不是底线**（R57）。
- 失败带 **remedy**（Linter 即 Prompt）；`block`/`visible`/`na` 三分。
- **不是底线的不拦**：判断式约定（如命名风格）只作注入引导，不占执法点。

### 19.5 自省（R58）

- 注入自报：本步注入 `sliceId[]`、依据（相位/意图）、是否跳过。
- 守卫自报：拦住次数、未识别次数；**「零违规」与「无判定对象」是两个读数**。

### 19.6 诚实边界

- 不追求「全自动读懂意图」。**相位确定时注入确定内容 + 底线机械兜底**；判定误判只影响引导（可删），不损坏底线（机械）。
- 注入层是 Build to Delete 的：模型变强后，可只留底线、撤掉注入。

---

## 二十、语言规范与工具使用规范（随包技能）

> 与 §十八 同属知识层，共用注入机制（§十九）。**机械值落 `assets/`，约定落技能正文，上游指南只引用不拷入。**

### 20.1 语言规范技能（`skills/lang-<id>/`）

| 件 | 职责 |
|---|---|
| `SKILL.md` | 何时载入（检测到该语言）＋核心约定（命名/结构/惯用法/错误处理）＋导航 |
| `references/google-style.md` | Google 风格指南的**引用**（链接＋版本／复核日），**不含逐字拷贝** |
| `references/project-overrides.md` | 项目对基线的覆盖及理由（避免两处打架） |

- **默认基线**：Google 风格指南优先（`html`/`css`/`javascript`/`java`/`python`/`c++` 等有对应版）；无对应者用该语言官方/事实标准（如 `shell`、`nasm`、`sql`）。项目可覆盖并登记理由。
- **语言目录**：`html`、`css`、`javascript`、`vue`、`java`、`python`、`shell`（`sh`/`zsh`/`bash`/`pwsh`）、`android`、`sql`（`mysql`/`redis`）、`c`、`cpp`、`nasm`；权威清单在 `assets/languages.json`。
- **机械值**（缩进、行宽、引号、尾逗号、严格度）→ `assets/lang-<id>.json`，由宿主 `formatter`/linter 消费；技能正文**不写具体阈值**（§三.7）。

### 20.2 工具使用规范技能（`skills/dev-tools/`）

| 件 | 职责 |
|---|---|
| `SKILL.md` | 何时载入＋跨工具通用约定（提交粒度、分支、验证前置） |
| `references/<tool>.md` | 单工具用法与判断：git、包管理器、formatter/linter、测试运行器、CI、容器、shell |

- 只写**用法与判断**，不复制工具自身的机械默认值（那些由工具配置承担）。

### 20.3 与既有机制的关系

- **按需注入**（R62）：语言/工具技能**不常驻**；router（§19.2）据检测到的语言/工具注入对应切片。
- **不重造**（§十六）：格式化与 lint 交宿主 `formatter` 与权限/规则；本技能只提供约定与 `assets/` 基线。
- **单点权威（M10）**：语言取值只在 `assets/lang-<id>.json`；技能与项目配置均引用。

---

## 证据与限制

- 本件基于三源：参考库 `hermess-engineering`、`opencode-plugin-lab` 的 OpenCode 证据（**类型定义** `@opencode/plugin@2.2.7/dist/` 与 `@opencode/schema/dist/`，及**官方文档快照**，基线 **OpenCode v2.2.7**，快照日 2026-11-11）、以及现状 ddd 项目的实测记录（旧实现，仅作知识回溯）。
- **待核项不承重**：§〇 已把 `V-01`…`V-09` 逐条裁定为「不依赖／规避／降级为可选」，故本件**在任一答案下都成立**；待核项只影响**增强**，不影响**可交付**。
- **结构可行性已实测**（离线、无模型）：对宿主实装的 `@opencode/plugin@2.2.7` 运行探针 **PASS**（三 part 解析、本地目录解析、`packageID`、SDK 导出面、transform/hook 形态、权限域无 `transform`）。
- **未做外部检索**：OpenCode 面全部取自离线证据；快照日之后的上游变更不在本件效力内（解法见 §十四 的哈希绑定）。
- 参考库自身有两处已知口径冲突（规则系统是否含 YAML frontmatter；钩子配置的字段级 schema 缺失），取用时须标**待核**。
