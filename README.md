# @cikaros/ddd-methodology（Hermess）

> **分区式设计驱动开发方法论** —— 文档为唯一权威，代码为其落地。
> 一个可装入 [OpenCode](https://opencode.ai) 的插件包；装入后在**当前项目根**搭起设计文档骨架，其后按节点序列与门禁推进当前项目。

> `opencode-plugin + subagent + ddd.methodology = Hermess`

- **产出的不是功能，而是环境**：一套可机械校验的设计驱动开发流程（设计树 / 测试树 / 变更流 / 门禁）。
- **文档先行**：任何变更先改文档，再落地代码；落地结果可机械对账。
- **零手动提示**：插件据上下文**自主注入**合适纪律，不必手敲 `@skill`；同时**机械守底线**，不靠模型自觉。
- **持久多步待办**：看板落盘、跨会话不丢，防「做一半丢一半」。

---

## 一、安装

### 前置
- Node.js ≥ 20
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

### 方式 B：包（发布后）
```bash
opencode plugin add @cikaros/ddd-methodology@1.0.2
```

### 方式 C：Git 仓库（无需发布到 npm）

OpenCode 支持 npm 兼容的 Git 规格（**hosted 简写 / HTTPS / SSH**），可选分支、标签、完整提交哈希；私有仓库走你现有的 Git 凭据。本仓地址为 `github.com:Cikaros/ddd-methodology`：

```bash
# ① 简写：默认分支最新（浮动，自动检查更新）
opencode plugin add github:Cikaros/ddd-methodology

# ② 钉到标签（推荐：可复现）
opencode plugin add github:Cikaros/ddd-methodology#v1.0.2

# ③ 钉到完整提交哈希（最稳：不受标签移动影响）
#    取当前 v1.0.2 的提交哈希：
#      git ls-remote https://github.com/Cikaros/ddd-methodology.git refs/tags/v1.0.2^{}
#    然后：
opencode plugin add github:Cikaros/ddd-methodology#<完整提交哈希>

# ④ SSH 形式（等价）
opencode plugin add git+ssh://git@github.com/Cikaros/ddd-methodology.git#v1.0.2
```

也可不装进全局，而直接在**项目 `opencode.jsonc`** 里以 Git 规格声明：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:Cikaros/ddd-methodology#v1.0.2", "options": { "profile": "standard" } }
  ]
}
```

> **钉版建议**：用**标签**或**完整提交哈希**（`@1.0.2` 或 `#v1.0.2`/`#<sha>`）——精确版本与完整 commit 会保持钉住；未钉版的分支会被后台自动检查更新。
> **仓库子目录**：若插件在 monorepo 子目录，用 `::path:` 选择器，如 `github:acme/plugins#main::path:packages/opencode-plugin`。

`plugins` 里可显式停用（`"-<id>"`）或按需装入；`options.profile` 取 `minimal` / `standard` / `strict`（预设套餐，见 `assets/profiles.json`）。

### 验证安装
在项目目录运行：

```bash
opencode plugin list        # 应出现 ddd  local
```

启动一次会话后，若看到模型上下文里出现 `[ddd:core]` 等注入行，即装入成功。

---

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

命令是**稳定接口**；各节点的具体工作由子代理角色以子会话承担（上下文隔离，防漂移）。

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
node scripts/materialize.mjs all . # 物化随包子代理角色到 .opencode/agents/
```

开发本包时可用 npm 脚本：

```bash
npm run typecheck   # tsc --noEmit
npm test            # 等价于 node scripts/selftest.mjs .
npm run validate
```

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
├── skills/         # 随包技能（主技能 + 前端变体契约 + 语言族 + 开发工具）
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
