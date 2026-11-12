---
doc: design
level: module
target: scripts
status: frozen
landed: true
updated: 2026-11-11
---

# 模块设计：scripts（随包工具）

## 定位与边界

- **职责**：不依赖模型的**机械件**——离线自测与门禁读数；这些是承重机制 M1/M2/M3/M9/M10 的机械承接。
- **边界内**：读权威（`docs/**`）与实物、写报告；产出可复算、同一输入恒得同一读数。
- **边界外**：不做业务；不依赖模型或网络；不改权威件。

## 目录规划（分组层）

`scripts/` 为单层目录，无更深分组。文件级见各 `DESIGN-<filename>.md`。现有：`selftest.mjs`（离线自测）、`snapshot.mjs`（设计树快照 · M1）、`change.mjs`（变更流唯一写入器 · M2）、`validate.mjs`（门禁读取器 · M3）、`map.mjs`（图集重放 · M9）、`drift-check.mjs`（反漂移复写扫描 · M10）、`defects.mjs`（缺陷登记册唯一写入器 · R36）、`board.mjs`（看板唯一写入器 · M7）、`materialize.mjs`（随包件物化 · F5）、`scaffold.mjs`（项目骨架生成器 · F7/R1）、`report-io.mjs`（派生报告幂等写入）。

## 依赖方向

- 只读 `docs/**` 与包内实物；写 `docs/reports/**`。
- 不得被 `src/**` 反向依赖（工具与插件实现解耦）。

## 与宿主的关系

脚本一律以 `node` 具名启动，**不得以宿主进程身份启动**（`process.execPath` 在真宿主里是宿主自身可执行文件）；工具路径取**包根**，不拼项目根（概要设计 §8.7、C-43 教训）。

**机械判据（R25）**：`src/**` 与 `scripts/**` 中，**禁止 `spawn*(process.execPath, …)` 形态**——须写 `spawn*("node", [<脚本>, …])`。
反证：注入一处 `spawnSync(process.execPath, …)`，`scripts/selftest.mjs` 的 `UT-src-index-04` 判据须报出（不沉默）。

## 承重机制承接

M1（设计树快照，`snapshot.mjs`）、M2（变更流，`change.mjs` 唯一写入）、M3（落地门禁，`validate.mjs` 读数）、M9（图集重放，`map.mjs`）、M10（反漂移复写扫描，`drift-check.mjs`）、**M7（看板闭环，经 `board.mjs` 唯一写入）**、**R36（缺陷登记册，`defects.mjs` 唯一写入）**、**F5（随包件物化，`materialize.mjs`）**、**F7/R1（项目骨架生成，`scaffold.mjs`）**。

## 状态

本件为 `frozen`；与上级设计件及实物对账一致。
