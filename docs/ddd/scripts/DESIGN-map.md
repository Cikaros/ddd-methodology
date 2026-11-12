---
doc: design
level: file
target: scripts/map.mjs
status: frozen
landed: true
covers: [map-replay]
depends: [scripts/snapshot.mjs]
updated: 2026-11-11
---

# 文件设计：scripts/map.mjs（图集重放与巡检 · M9）

## 定位与边界

- **职责**：由 `docs/maps.json`（项目图集 delta）与设计树快照**重放**产出人读图集 `docs/maps/MAPS.md`；**产图者不宣判**（审计独立）。
- **边界内**：`replay` / `check`。
- **边界外**：判定缺陷（归 `ddd-auditor`）；图集的语义定义（概要 §十三 M9）。

## 对外暴露接口

`node scripts/map.mjs <sub> [--root <项目根>]`
- `replay`（重放产出 `docs/maps/MAPS.md`；禁手改）
- `check`（`MAPS.md` 与重放一致，差异即失败）

退出码：`0` 过；`1` 失败（派生不一致/引用面不可解析）；`2` 用法错。

**`docs/maps.json` 形态**：`{ "add": [...], "override": [...], "disable": [...] }`（delta）。

## 需引入的依赖

- Node 标准库；读 `scripts/snapshot.mjs` 的快照（只读）作输入。

## 调用的模块能力及接口

- 被 `/ddd-map` 命令调用；供审计只读。
- 重放输入＝`docs/maps.json` ＋ 设计树快照。

## 已知约束

- **重放一致**：同一输入恒得同一 `MAPS.md`（除时间戳）；`check` 检出差异。
- **含快照摘要（派生件的派生件）**：`MAPS.md` 内嵌 `docs/reports/design-tree.json` 的计数——故改动设计树后**必须重跑 `snapshot` 再 `map replay`**（顺序不可颠倒）。根因见 `DEF-0012`（发布曾携带陈旧 `MAPS.md`）。
- **发布门**：`npm run release`＝`regen`（重放全部派生件：snapshot→map→change→defects）→ `check`（逐件对账）→ `typecheck` → `test`；**发布前必过**，防「陈旧派生件随发布」。
- **产图者不宣判**：本件只产图与巡检引用面，不作缺陷判定。
- **派生件禁手改**；引用面不可解析即失败（R20 判据④）。
- 路径：图集写入项目根；工具取包根（§8.7）。

## 状态

本件为 `frozen`；与实物（`scripts/`）对账一致。
