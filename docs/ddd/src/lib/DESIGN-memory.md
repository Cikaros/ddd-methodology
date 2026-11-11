---
doc: design
level: file
target: src/lib/memory.ts
status: frozen
landed: true
covers: [MemoryEntry, computeConfidence, shouldRemind, shouldPromote, decay, projectScope]
depends: [assets/memory.json]
updated: 2026-11-11
---

# 文件设计：src/lib/memory.ts（M6 记忆闭环 · 详细设计）

> 本件是 **M6 记忆闭环**的详细设计（纯函数部分）。目标是「经验可沉淀、可衰减、可晋升、可自动注入」，且**与宿主原生持久指导（`AGENTS.md`/`instructions`）分工不打架**：原生管「跨会话指导」，本机制管「坑点计数与晋升」。

## 1. 定位与边界

- **职责**：记忆条目的置信度计算、提醒/晋升判定、衰减、scope 过滤；纯函数，可离线自测。
- **边界内**：判定逻辑与数据契约。
- **边界外**：读写盘（唯一写入器在 `scripts/`）；注入（router/context hook）；归纳（`ddd-curator`）。

## 2. 存储分层（与 §8.6 一致）

| 层 | 载体 | 性质 |
|---|---|---|
| **权威** | `docs/memory/memory.jsonl`（追加写、唯一写入器） | 项目内、git 可 diff、单一真相源 |
| 派生 | `docs/memory/MEMORY.md`（重放生成、禁手改） | 人读视图 |
| 运行时 | `ctx.storage`（去重键、游标） | 非权威；不得藏事实 |
| 阈值 | `assets/memory.json`（`remindAt`/`promoteAt`/`consistency`/`decayPerSession`/`injectTopN`/`redlines`） | 单点权威 |

> **与 `AGENTS.md` 的分工**：长期稳定的「规则型指导」上提为 `AGENTS.md`（原生、稳定）；`memory.jsonl` 只存**带计数的坑点/步骤**，晋升后再上提。二者不重复同一内容（M10）。

## 3. 数据契约（`memory.jsonl` 每行）

| 字段 | 含义 |
|---|---|
| `id` | `MEM-####` |
| `ts` | ISO 时间 |
| `kind` | `record` / `occur` / `decay` / `promote` / `archive` / `session` / `checkpoint` |
| `type` | `pitfall`（坑点）/ `procedure`（反复出现的步骤） |
| `scope` | 项目根名（`basename`），跨项目隔离 |
| `key` | 归一化模式键；`occur`/`decay` 据此归并 |
| `symptom` / `cause` | 症状 / 根因 |
| `trigger` | 命中形态（供 `tool.execute.before` 比对：工具名模式或入参模式） |
| `guardId` | 已被某判据/守卫拦住时记其编号 |
| `occurrences` | 由 `occur` 行累加 |
| `confidence` | 1–5 星 |
| `source` | 会话/命令标识 |

## 4. 生命周期（状态机）

```
record(1★) --occur--> occur(n★) --达remindAt--> 注入提醒 --达promoteAt且一致率达标--> candidate
   |                                                                        |
   +--未再出现--session关闭--> decay(减星) --低于1★--> archive          promote(人工确认) --> 晋升(规则/技能/守卫 | 看板任务)
```

- **record**：首次出现，`occurrences=1`，`confidence=1`。
- **occur**：同 `scope+key` 再现，`occurrences++`，重算星级；**同一会话同一 key 只计一次**（去重）。
- **remind**：`confidence ≥ remindAt` 起，注入一行摘要。
- **promote 候选**：`confidence ≥ promoteAt` 且**一致率 ≥ consistency** → 标 `candidate`。
- **提升去向**：`pitfall` → 规则/技能/守卫（**须人工确认**）；`procedure` → **直接转一条看板任务**（带 `acceptance`）。
- **decay**：每次「会话结束」对未再现条目 `confidence -= decayPerSession`；低于 1★ → `archived`，不进默认注入。
- **archive**：归档，保留历史行，不进投影。

## 5. 置信度与判定（纯函数）

| 导出 | 契约 |
|---|---|
| `computeConfidence(occurrences, consistency)` | 由次数与一致率得 1–5★（阈值读 `assets/memory.json`） |
| `shouldRemind(entry, cfg)` | `confidence >= remindAt` |
| `shouldPromote(entry, cfg)` | `confidence >= promoteAt && consistency >= cfg.consistency` 且未 archived |
| `decay(entry, cfg)` | 返回新星级或 `archived` |
| `projectScope(root)` | 取项目根名作 `scope` |

> 阈值**只读 `assets/memory.json`**，代码不得内置（门槛可调，R32）。

## 6. 注入（经 router，R52）

- 目录层每请求注入**至多 `injectTopN`** 条 `symptom` 一行摘要（按 `scope` 过滤）。
- 若存在 `candidate`，额外注入一行「有 N 条候选待提升（`/ddd-memo list`）」。
- 全文由代理按需 `read`（渐进式披露）。
- **不常驻全量**；不重复注入同一片（键控幂等）。

## 7. 与宿主钩子的对接

| 时机 | 宿主面 | 动作 |
|---|---|---|
| 复发命中 | `tool.hook("execute.before")`（`event.tool`+`event.input`） | 匹配 `trigger` → `occur`（去重） |
| 请求注入 | `session.hook("context")` / `instructions.entry` | 注入 topN + 候选提示 |
| 会话结束（衰减） | `ctx.event.subscribe({ types: ["session.deleted"] })` | `decay` 未再现条目（**待核**：以 `session.deleted` 作"关闭"语义；亦可用 `experimental.idle` 做检查点） |
| 压缩前 | `session.hook("compaction")` | 写 `checkpoint` 行 |

## 8. 与 `ddd-curator` 的交互

- `ddd-curator` 只读会话轨迹与既有记忆，**只产出 `record`/`occur` 提案**；`promote` 须人工确认。
- curator 的写入走**唯一写入器**（`scripts/`），不直接改 jsonl（禁手改）。

## 9. 失败语义与自省

- 判定对象不存在（无 `memory.jsonl`）→ `na`，**不判为通过**。
- 「零命中」与「无条目」是两个读数。
- 记忆写入必须幂等（`scope+key+sessionID+位移`去重）。
- 晋升/衰减的**计数**可机械判；「该不该晋升」的处理判断式（人工）。

## 10. 待核（实现批次实测）

- `V-20`：会话「关闭」的准确钩子（`session.deleted` vs `experimental.idle`）。
- `V-21`：`tool.execute.before` 的 `event.input` 形态是否足以匹配 `trigger`（结构是否稳定）。
- `V-22`：注入走 `context` 还是 `instructions.entry`（后者实验性；核心用前者）。