# 真跑层报告（§十二 手段③ · R37）

> 对象：以本仓为插件装入宿主（OpenCode v2.2.7），用 `scnet/DeepSeek-V4.1-Flash` 跑**端到端**。属**临时审计件**（登记 `docs/temp.jsonl`）。
> 方式：独立消费者项目（避免本仓自污染），`opencode run` 显式指示模型调用工具；核对副作用。

## 一、已**证实**（真进程级）

| # | 验证点 | 证据 | 机制 |
|---|---|---|---|
| 1 | 插件被宿主加载 | `opencode plugin list` → `ddd local E:/Code/ddd-methodology`；日志 `loading plugin` | M4 |
| 2 | **注入真的进入模型上下文** | 模型逐字回述到 `[ddd:core]`、`[ddd:board]`、`[ddd:self]` 三行 | M13/R52 |
| 3 | **看板端到端可用** | 模型调 `board.mjs add` → `board.jsonl` 落 `BRD-0001`、`BOARD.md` 重放；下一轮注入 `[ddd:board] 待办 1 … top: BRD-0001` | M7 |
| 4 | 技能被广告 | 模型回述可用技能含 `ddd-methodology`/`dev-tools`/`frontend-variant-contract`/`lang-*` | R52/R62 |
| 5 | 命令**可跑** | 模型据 `assets/commands.json` 与源码正确使用 `board.mjs reconcile/replay` | M4 |

→ **M7、M13、R52 得到真跑级验证**（这是手段①②给不了的）。

## 二、新发现（真跑才暴露）

### F5 · 随包 `agents/` 在真宿主**不可发现**（高置信度 · 未闭合）

| 项 | 内容 |
|---|---|
| 严重度 | **high** |
| 证据链 | ① 类型定义：`AgentEditor` **只有 `list/get/default/update/remove`，无 `add`**（`dist/promise/agent.d.ts`）→ 插件注册表**无法新增** agent；② 文档：宿主只从 `~/.config/opencode/agents/` 与 `.opencode/agents/` **发现** agent；③ 代码：本插件无任何「把随包 `agents/*.md` 落盘到 `.opencode/agents/`」的动作；④ 真跑：模型回述**看不到**任何 `ddd-*` 代理 |
| 结论 | 设计称「命令→角色由 `mode: subagent` 派发」，但**随包 10 个角色在真宿主里既未注册（宿主无 `add` 口）也未落盘** → 角色实际不可用 |
| 与设计的关系 | `agents/DESIGN.md` 假定角色「以 `mode: subagent` 派发」；缺一件「角色落盘/装载」的承接（同 F2 类：**声明 vs 实物**） |
| 待裁决 | (A) 补一件「随包 agents → 项目 `.opencode/agents/` 落盘」的设计与实现（对齐 `/ddd-init` 或新工具）；(B) 收窄设计声明 |

### F6 · 插件注册的**命令面**是否以斜杠命令暴露，**未获证实**（待核，不判缺陷）
| 观察 | 数据 |
|---|---|
| 模型看不到 `ddd-*` 命令 | 两次真跑，模型明确回述「不存在 ddd-board/ddd-validate 命令」 |
| `/api/command` 返回空 | 即便存在 md 命令 `/probe-md`、`/zzz` 时仍空 → 该端点不反映此命令面 |
| md 命令行为 | `/probe-md`、`/zzz` 模型**去读文件**才拿到模板文本 → `run` 模式**可能不展开**斜杠命令 |
| 探针插件 | 隔离探针的 `setup` 未被调用（但 ddd 插件 `setup` 被调用）→ 本地目录插件解析方式差异，**根因未定** |
| 定性 | **待核**：无法区分「插件命令注册失败」与「`run` 模式/TUI 才展开斜杠命令」。**不判为缺陷**，但「命令以 `/` 触发」的**真可用性仍无正面证据** |

### F7 · `/ddd-init` 骨架生成 + Q3 命令派发**无实现**（高置信度 · 未闭合）

| 项 | 内容 |
|---|---|
| 严重度 | **high** |
| 证据链 | ① `assets/commands.json` 的 `ddd-init` 声明「在当前项目根落项目级骨架（根文档三件 + `docs/` 结构 + 空图集 + 快照）」，但 `src/index.ts` 的 `ddd-init` 仅发一条提示词，**无任何落盘逻辑**（`src/**` 无 `.opencode`/骨架生成代码）；② 设计树**无**「骨架生成」文件级设计；③ `agents/DESIGN.md` 要求插件命令 handler 走 `session.create → switchAgent → prompt`，但 `src/index.ts` **无 `switchAgent`/`session.create` 调用**（仅有注释提及） |
| 结论 | R1 的「存在骨架生成命令」与 Q3 的「插件命令派发」均**声明有、实质缺**（同 F2 类：声明 vs 实物）。真跑中模型只能自行去读源码/手调脚本，**正是缺这些实物的表现** |
| 待裁决 | (A) 补 `ddd-init`（骨架生成器）与 Q3 派发的设计与实现；(B) 收窄声明 |

## 三、诚实界定

- **未验**：Q4 角色工具裁剪（依赖 F5 的角色可派发）、M5 阻塞确认弹窗（`run` 无交互 TUI）、M6 复发计数、M8 evaluate 拦截、skill **按需**载入（仅证被广告，未证按需注入）。
- 这些多依赖 **F5（角色可派发）** 或 **交互式 TUI**；F5 未闭合前，Q4/M5-TUI 路径无法真跑。
- 本仓**未被污染**（真跑在独立目录；`git status` 干净）。

## 四、结论

- 真跑**证实**了 M7/M13/R52 在真进程可用；这是「三手段并存」的价值所在。
- 真跑**暴露** F5（high，角色不可发现）、F7（high，骨架生成与 Q3 派发缺）、F6（待核，命令面）；均为手段①②无法发现。
- 建议：先闭合 F5/F7（补「角色落盘」「骨架生成 + 命令派发」承接），再继续 Q4/M5 的真跑验证。
