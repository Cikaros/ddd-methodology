---
doc: design
level: file
target: src/lib/board.ts
status: frozen
landed: false
covers: [BoardRow, project, canTransition, admit, detectOrphans]
depends: [assets/board.json]
updated: 2026-11-11
---

# 文件设计：src/lib/board.ts（看板投影与判定 · M7）

> **目的**：把「多步待办」做成**持久、可验收、跨会话不丢**的看板，防止 Agent「做一半丢一半」。纯函数，可离线自测。

## 1. 定位与边界

- **职责**：行折叠→投影；准入判定；状态转移合法性；孤儿/陈旧检测。
- **边界内**：纯判定（入参为行数组）。
- **边界外**：读写盘（`scripts/board.mjs`）；注入（`src/index.ts` 的 context hook）；命令（server part）。

## 2. 行契约（`board.jsonl` 每行）

| 字段 | 说明 |
|---|---|
| `kind` | `task`／`move`／`evidence`／`archive`／`rule-hit`／`rule-undecided`／`profile-change`／`stale-hit` |
| `ts` | ISO 时间 |
| `taskId` | 任务标识（`BRD-####`） |
| `reqId` | 归属需求（无前驱时 `null`） |
| `title` / `acceptance` | 标题 / **验收判据（必填）** |
| `priority` | `P0`–`P3`（P0 最高，默认 P2） |
| `status` | `pending`／`in_progress`／`blocked`／`done`／`dropped` |
| `dependsOn` | 前驱 `taskId[]` |
| `seq` | 写入时赋的单调序号（同优先级定次序） |
| `from`/`to`/`reason`/`evidence` | 视 `kind` 携带 |

## 3. 对外暴露接口

| 导出 | 契约 |
|---|---|
| `project(rows)` | 折叠每 `taskId` 最新态 → 剔除 `archive` → 剔除前驱未满足 → 按 `(priority 升, seq 升)` 排序 |
| `admit(row, projection, cfg)` | 准入：`acceptance` 非空、`priority` 在域、`dependsOn` 实存；返回插入位次；反饥饿超限且缺 `reason` 则拒 |
| `canTransition(from, to)` | 合法转移（见下） |
| `detectOrphans(projection, now, cfg)` | `in_progress` 超 `orphanHours` 无新行 → 列提示（**不判失败**） |
| `summarize(projection)` | `{ pending, inProgress, blocked }`（供 RPC/注入） |

**合法转移**：`pending→in_progress`；`in_progress→blocked`；`blocked→in_progress`；`pending|in_progress|blocked → done`；`任意→dropped`（须 `reason`）；`done|dropped→archive`。其余拒。

## 4. 需引入的依赖

无（纯函数；阈值由调用方从 `assets/board.json` 传入）。

## 5. 调用的模块能力及接口

被 `src/index.ts`（注入摘要、RPC `board`）与 `scripts/board.mjs`（校验）调用。

## 6. 关键约束（防"做一半丢一半"）

- **`acceptance` 必填**：缺者不进板（R33）。
- **`from` 必须与投影一致**：转移行声称的 `from` 与当前投影不符即拒写。
- **收尾硬门禁**：`project()` 为空才允许 G6；`done`/`dropped` 须 `archive`；`reqId:null` 须 `rehome` 或 `drop`。
- **与 `todowrite` 不双记账**：持久任务只在看板；`todowrite` 仅会话内草稿（裁决 #10）。
- 阈值（priority 域、反饥饿、孤儿）**只读 `assets/board.json`**，不写死。