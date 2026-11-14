# @cikaros/ddd-methodology（Hermess）

> **2.0.2 发布说明：** 本版统一 Agent 子会话、动态 Skill 推荐、上下文、证据/记忆、RPC/TUI 运行状态与初始化预检；不改变 DDD 目标、15 个命令或 33 个 Skills。`docs/optimization/V2.0.2-INTEGRATION-REPORT.md` 提供完整审查和回归证据，[2.0.2 迁移指南](docs/optimization/V2.0.2-MIGRATION.md) 给出升级步骤。
> **诚实边界：** 官方 OpenCode SDK / DeepSeek Flash 的实机端到端验证仍需在真实宿主环境独立完成；本版不宣称已在真实模型上取得性能增益。


> **2.0.1 Skills 优化**：新增 18 项语言/框架/数据库/工具技能；共 33 项，改用 `assets/skills-catalog.json` 注册与检测。详见 [Skills 改造报告](docs/optimization/V2.0.1-SKILLS-REPORT.md)。
> 检查：`npm run skill-check`；在业务项目物化：`node scripts/materialize.mjs skills --root /path/to/project`（默认绝不覆盖同名自定义 Skill）。


**v2.0.2 正式发布 · 2026-11-14**：延续用户上传的原版 1.0.8 源码及 2.0.1 项目重构，保留 15 个命令、12 个 Agent、Skills、RPC/TUI 与 Hermess 的“文档唯一权威”方法论。改变的是执行引擎、证据、门禁、并发事务和 DeepSeek Flash 上下文策略，而不是叠加新代理。详见 [2.0 功能补齐报告](docs/optimization/V2-COMPLETION-REPORT.md)、[历史重构报告](docs/optimization/V2-REFACTOR-REPORT.md) 与 [2.0.2 迁移指南](docs/optimization/V2.0.2-MIGRATION.md)。

- **本包版本落点**：`package.json` 的 `version` 与 `docs/CHANGELOG.jsonl` 最新记录（均为 `2.0.2`/`v2.0.2`）；使用者侧第三处落点为你在 `opencode.json(c)` 的钉版声明（`@2.0.2` 或 `#v2.0.2`）。

> **分区式设计驱动开发方法论** —— 文档为唯一权威，代码为其落地。
> 一个可装入 [OpenCode](https://opencode.ai) 的插件包；装入后在**当前项目根**搭起设计文档骨架，其后按节点序列与门禁推进当前项目。

> `opencode-plugin + subagent + ddd.methodology = Hermess`

- **产出的不是功能，而是环境**：一套可机械校验的设计驱动开发流程（设计树 / 测试树 / 变更流 / 门禁）。
- **文档先行**：任何变更先改文档，再落地代码；落地结果可机械对账。
- **按需技能**：插件自动识别项目并推荐相关 Skill ID，完整技能正文由 OpenCode 的 `skill` 工具按需读取；纪律由插件注入，底线机械执行。
- **持久多步待办**：看板落盘、跨会话不丢，防「做一半丢一半」。

---

## 一、安装

### 前置
- Node.js ≥ **22.19.0**（与锁定依赖的最低版本一致；CLI 直接执行 TypeScript）
- OpenCode v2.2.7 或更高（`opencode --version`）
- 同一环境可用的模型（本方法论需模型驱动；见「模型」节）

### 方式 A：本地目录（开发/自用）
在**你的项目根**新建或编辑 `opencode.jsonc`：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "/绝对/路径/到/ddd-methodology", "options": { "profile": "standard" } }
  ]
}
```

### 方式 B：包（已正式发布到 npm）
```bash
opencode plugin add @cikaros/ddd-methodology@2.0.2
```
> v2.0.2 已可作为发布版本使用；若你的环境尚未同步 npm 注册表，可先用方式 A（本地目录）或方式 C（钉到标签 `#v2.0.2`）。

### 方式 C：Git 仓库（无需发布到 npm）

OpenCode 支持 npm 兼容的 Git 规格（**hosted 简写 / HTTPS / SSH**），可选分支、标签、完整提交哈希；私有仓库走你现有的 Git 凭据。本仓地址为 `github.com:Cikaros/ddd-methodology`：

```bash
# ① 简写：默认分支最新（浮动，自动检查更新）
opencode plugin add github:Cikaros/ddd-methodology

# ② 钉到标签（推荐：可复现）
opencode plugin add github:Cikaros/ddd-methodology#v2.0.2

# ③ 钉到完整提交哈希（最稳：不受标签移动影响）
#    取已发布 v2.0.2 的提交哈希：
#      git ls-remote https://github.com/Cikaros/ddd-methodology.git refs/tags/v2.0.2^{}
#    然后：
opencode plugin add github:Cikaros/ddd-methodology#<完整提交哈希>

# ④ SSH 形式（等价）
opencode plugin add git+ssh://git@github.com/Cikaros/ddd-methodology.git#v2.0.2
```

也可不装进全局，而直接在**项目 `opencode.jsonc`** 里以 Git 规格声明：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:Cikaros/ddd-methodology#v2.0.2", "options": { "profile": "standard" } }
  ]
}
```

> **钉版建议**：用**标签**或**完整提交哈希**（`@2.0.2` 或 `#v2.0.2`/`#<sha>`）——精确版本与完整 commit 会保持钉住；未钉版的分支会被后台自动检查更新。
> **仓库子目录**：若插件在 monorepo 子目录，用 `::path:` 选择器，如 `github:acme/plugins#main::path:packages/opencode-plugin`。

`plugins` 里可显式停用（`"-<id>"`）或按需装入；`options.profile` 取 `minimal` / `standard` / `strict`（预设套餐，见 `assets/profiles.json`）。

### 验证安装
在项目目录运行：

```bash
opencode plugin list        # 应出现 ddd  local
```

建议在测试会话检查 `[ddd:runtime]` 是否只注入一次，并实际运行 `/ddd-init`、`/ddd-validate` 和一次 RPC 看板读取。单看上下文文本不足以证明宿主兼容。

---


## 2.0.x 运行边界与新能力

- **拆分式架构**：`src/index.ts` 只作为宿主入口；`src/runtime.ts` 注册 SDK；`command-dispatcher.ts` 派发；`context-service.ts` 控制注入；`gate-evaluator.ts` 统一 CLI 与 RPC 判据。
- **可恢复执行生命周期**：`.ddd/state/workflows/<session-sha256>.json` 保存 prepared / dispatched / running / awaiting_verification / verified / failed / superseded；宿主成功仅代表**待验收**，验收需实际执行测试并绑定源码指纹。恢复时不会自动重放有副作用的命令。
- **可用的 TUI 输入**：四问通过 `Ddd.intentCapture` RPC 保存到 `.ddd/state/intent-draft.json`（原始草稿，不冻结需求）。
- **可靠看板**：共享读写器、严格事件重放、跨进程独占锁，`board.mjs replay --check` 不再边检查边覆盖。
- **DeepSeek Flash 调度**：按模型、阶段与意图分配额外上下文预算，并筛选允许读取的项目证据片段；记忆按阶段与证据版本淘汰/降权。不会覆盖 API reasoning、temperature 或模型选择。
- **发布前真实检查**：`validate.mjs --release` 要求 G1–G6 满足发布条件，还需运行检测到的 npm / Go / Rust / Python / Maven / Gradle 常规项目测试；验证中源码指纹变化则失败，没有可识别测试时显示 `unverified`。运行项目测试可能执行用户项目脚本，须先审查。

```bash
# 仅检查 G1–G6，不写报告
node --experimental-strip-types scripts/validate.mjs --root . --check

# 发布前校验：会实际执行项目 package.json 中的 npm test/typecheck/lint
node --experimental-strip-types scripts/validate.mjs --root . --release

# 离线对比已真实采集的同一批 OpenCode/DeepSeek 任务数据
node scripts/eval.mjs --baseline baseline.jsonl --candidate v2.jsonl
```

跨会话草稿、检查点及不含原始提示词的运行指标放在 `.ddd/state/`（建议加入项目 `.gitignore`）；设计、需求、测试与验收权威仍在 `docs/`。详情见 [2.0 调整说明](docs/optimization/V2-REFACTOR-REPORT.md)。


### 显式任务恢复与真实验收（2.0.2）

```bash
# 查看已有执行检查点：不会改变状态
node --experimental-strip-types scripts/workflow.mjs status --root . --session <会话ID>

# 只有真实执行完毕而宿主结束事件丢失时，由操作者确认“执行已经结束”
node --experimental-strip-types scripts/workflow.mjs reconcile --root . --session <会话ID> --ack-execution

# 执行识别到的真实项目测试（可能运行项目自定义脚本），只有测试通过才更新 verified
node --experimental-strip-types scripts/workflow.mjs verify --root . --session <会话ID> --ack-run-tests

# 执行确实中断时显式关闭；不会重放可能已运行的工具动作
node --experimental-strip-types scripts/workflow.mjs close --root . --session <会话ID> --ack-close --reason "取消此次执行"

# 查看实际观测到的指标；不完整的 Token 不会填零或导出为真实 A/B 数据
node --experimental-strip-types scripts/workflow.mjs metrics --root . --session <会话ID> --export
```

TUI 可通过 `/ddd-tui-workflow` 查看会话检查点，确认后验收或关闭；RPC 提供 `workflow` / `workflowVerify` / `workflowClose`。原有 `/ddd-*` 命令保持不变。

**模型实测边界：** 代码实现了指标采集与导出，但宿主实际是否提供用量事件、模型别名以及模型在真实任务中的改进幅度仍需 OpenCode + DeepSeek 联调。无法提供宿主所需事件时，该数据会保持缺失，不会把未测结果标为完成。

## 二、快速上手（三类场景）

装好后，按你的处境挑一条入口：

| 场景 | 特征 | 入口 |
|---|---|---|
| **一 · 从零开始** | 无既有代码 / 设计树 | `/ddd-init` → `/ddd-intent` → `/ddd-arch`（选型）→ 全序列 |
| **二 · 二次开发** | 已有项目；追加功能 / 修 bug | 新需求：`/ddd-intent` → `/ddd-design` → `/ddd-implement` → `/ddd-test`；修 bug：`/ddd-change` + 最小设计更新 |
| **三 · 项目迁移** | 代码在、设计树不在 | `/ddd-init` → `/ddd-design --from-code`（反推，标 `draft`）→ `/ddd-arch` 校验 |

最小起步（推荐）：

```
/ddd-init        # 落项目骨架：根文档三件 + docs/ 结构 + 物化角色
/ddd-intent      # 澄清需求到「四问」齐备，并阻塞式确认
/ddd-arch        # 定技术栈与目录，出选型论证稿
/ddd-design      # 逐层落设计树
```

> `/ddd-init` 会物化随包子代理角色到 `.opencode/agents/`，使 `ddd-*` 角色可被派发。

---

## 三、命令一览

命令是**稳定接口**；默认在同会话执行，只有 review / validate / consolidate 尝试隔离子会话；失败时回退但必须可见。

| 命令 | 用途 | 阻塞 |
|---|---|---|
| `/ddd-init` | 在当前项目根落项目级骨架（根文档三件 + `docs/` 结构 + 空图集 + 快照；并物化角色） | |
| `/ddd-intent` | 明确意图：把需求澄清到可设计、可验收 | ▲ |
| `/ddd-arch` | 生成或更新 `docs/ARCHITECTURE.md` 与目录规划 | ▲ |
| `/ddd-design` | 逐层生成或更新设计树（`--from-code`：由代码反推，仅场景三） | |
| `/ddd-review` | 冻结前独立交叉评审接口契约 | |
| `/ddd-test-design` | 生成或更新测试用例树 | |
| `/ddd-implement` | 按冻结契约落代码与单元测试 | |
| `/ddd-test` | 执行四级测试并出报告与缺陷路由 | |
| `/ddd-validate` | 跑门禁、出报告 | |
| `/ddd-change` | 记一条变更流 | |
| `/ddd-map` | 重放图集 | |
| `/ddd-wrapup` | 收尾：清临时件、剔需求、发布版本 | ▲ |
| `/ddd-consolidate [scope]` | 冻结即归并：按模块/目录隔离重构为最终版（`scope` = `requirements`/`design`/`code`/`all`） | ▲ |
| `/ddd-board <sub>` | 看板（持久待办）：`list`/`add`/`move`/`evidence`/`drop`/`rehome` | |
| `/ddd-memo list` | 记忆条目与候选提示 | |

▲ = 阻塞节点：推进前经**阻塞式确认**（server 侧 `permission.assert`）；被拒即中止该步。

---

## 四、六道门禁

`/ddd-validate` 给出 G1–G6 读数（`pass` / `block` / `visible` / `na`）。

| 编号 | 门禁 | 执行者 | 通过判据 |
|---|---|---|---|
| G1 | 需求冻结 | 人 | 需求件 `status: frozen`，裁决记录无未决项 |
| G2 | 架构就位 | 人 | `docs/ARCHITECTURE.md` 含技术栈 / 核心依赖 / 目录结构 / 环境探查 |
| G3 | 设计树同构 | 机械 | 同构对账零失败；命令注册表双向核对零失败 |
| G4 | 测试树覆盖 | 机械 | 有文件级设计的源文件全部有对应用例文档 |
| G5 | 落地非空 | 机械 | 交付件存在且 > 10 字节、schema 合法、在白名单 |
| G6 | 收尾清空 | 机械+人 | 临时件清空；看板活跃投影为空；版本落三处；缺陷登记册存在 |

> **`na`（无判定对象）≠ `pass`（通过）**：两者是两个读数，不得混同。

---

## 五、方法论要点

- **四级同构**：`docs/ddd/<X>` 与仓库根 `<X>` 逐层对应（子项目／模块／分组／文件）。
- **单点权威**：同一事实只在一处写具体值，其余引用；机械取值一律落 `assets/`（复写可被 `drift-check` 检出）。
- **冻结即归并（M12）**：需求／设计／代码三处冻结时，各做一次最终版优化转换——裥产物**内联**痕迹、重构成终稿；**不碰**权威变更流 `docs/CHANGELOG.jsonl`。
- **两态判据**：机械式（脚本给确定结论，配反证）／判断式（审计逐条结论）。
- **失败语义三分**：阻塞（拦下并给补救）／可见（入册不拦）／不适用（对象不存在、退出码零）。

---

## 六、随包工具（离线可跑，无模型）

包内 `scripts/` 提供机械件，可直接以 `node` 具名运行：

```bash
node scripts/selftest.mjs .        # 离线自测：注册面 + 纯函数 + assets + 内容层
node scripts/snapshot.mjs .        # 设计树机器可读快照（M1）
node scripts/validate.mjs .        # 门禁读数（G1–G6，写 docs/reports/validate.json）
node scripts/drift-check.mjs .     # 反漂移复写扫描（M10）
node scripts/change.mjs add ...    # 变更流唯一写入器（M2）
node scripts/map.mjs replay        # 图集重放（M9）
node scripts/defects.mjs add ...   # 缺陷登记册唯一写入器（R36）
node scripts/board.mjs list        # 看板唯一写入器（M7）
node scripts/scaffold.mjs .        # 项目骨架生成器（/ddd-init 的机械承接）
node scripts/materialize.mjs all . # 物化角色和 Skills 到 .opencode/agents/ 与 .opencode/skills/
```

开发本包时可用 npm 脚本：

```bash
npm run typecheck   # tsc --noEmit（官方 @opencode/plugin@2.2.7 类型下当前未通过，见 DEF-0018）
npm test            # 自测 163 项 + 5 个回归套件共 81 例（当前 80 过 1 失败，见 DEF-0017）
npm run check       # 设计树、变更流、图集、缺陷登记和反漂移校验
npm run workflow -- status --session <OpenCode会话ID> --root <业务项目路径>
```

> 上述两项失败已在 `docs/defects.jsonl` 登记（`DEF-0017`/`DEF-0018`），详见 [2.0.2 发布报告](docs/optimization/V2.0.2-INTEGRATION-REPORT.md) §4。

---

## 七、模型

本方法论依赖模型驱动（子代理、注入、命令派生）。任选一个 OpenCode 可用、且具备工具调用能力的模型即可，例如：

```jsonc
{ "model": "scnet/DeepSeek-V4.1-Flash" }
```

（具体 provider / 凭据在 `~/.config/opencode/opencode.json` 或项目 `opencode.jsonc` 配好；`opencode models` 可列可用模型。）

---

## 八、目录结构（本包）

```text
ddd-methodology/
├── src/            # server / tui / rpc 三 part + 共享纯函数层（lib/）
├── scripts/        # 随包机械件（离线自测、门禁、变更流、图集、看板、缺陷、快照、骨架、物化…）
├── assets/         # 配置基线的唯一权威（命令/门禁/规则/记忆/底线/角色工具/看板/套餐/切片/语言）
├── skills/         # 随包技能（33 个：方法论、语言、框架、数据库、开发工具）
├── agents/         # 随包子代理角色（mode: subagent）
├── docs/           # 本方法论自身的文档树（本仓既是包又是项目）
├── package.json
└── LICENSE
```

---

## 九、诚实边界

- **不产出业务功能代码**：本包产出的是环境与纪律；业务由你的项目经命令推进产出。
- **真跑层需模型**：端到端「模型真的调用某工具」需显式指示模型，非离线可完成。
- **「缺陷已全部登记」是交付判据**：交付的是「缺陷已登记的设计」，不是「无缺陷的设计」（登记册 `docs/defects.jsonl`）。

---

## 十、许可

MIT（见 `LICENSE`）。
