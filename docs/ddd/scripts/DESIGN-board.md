---
doc: design
level: file
target: scripts/board.mjs
status: frozen
landed: true
covers: [board-writer]
depends: [src/lib/board.ts, assets/board.json]
updated: 2026-11-11
---

# 文件设计：scripts/board.mjs（看板唯一写入器）

## 定位与边界

- **职责**：`docs/board/board.jsonl` 的**唯一写入器**（append-only）＋投影重放；禁手改。
- **边界内**：`add`／`move`／`evidence`／`drop`／`rehome`／`reconcile`／`replay --check`。
- **边界外**：投影算法（`src/lib/board.ts`）；注入（`src/index.ts`）。

## 对外暴露接口

`node scripts/board.mjs <sub>`：`add`／`move`／`evidence`／`archive`／`rehome`／`reconcile`／`replay --check`。
退出码：`0` 过；`1` 失败（含手改检出）；`2` 用法错。

## 需引入的依赖

- Node 标准库；`src/lib/board.ts` 的纯函数（只读导入）。
- 读 `assets/board.json` 阈值。

## 调用的模块能力及接口

- 追加行前调 `admit`/`canTransition` 校验；`replay --check` 比对 `docs/board/BOARD.md` 派生视图。
- `detectHandEdit`：jsonl 行不合法/`seq` 非单调 → 失败。

## 已知约束

- **append-only**：只追加不改旧行；状态转移只以新行表达。
- **禁手改**：派生视图 `BOARD.md` 由重放生成；手改可检。
- **不做业务**：不加锁之外的重逻辑；并发追加用 `O_APPEND`+单行写。
- 不收 `todowrite` 数据（不双记账）。
## 2.0.0 事务与检查

读-判-写在 `board-store.mjs` 独占锁中完成；`replay --check` 纯比较不修复派生文件；`reconcile` 验证整段历史；无效 archive/重挂和并发冲突立即失败。
