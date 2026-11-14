---
doc: design
level: file
target: scripts/validate.mjs
status: frozen
landed: true
covers: [gate-reader]
depends: [src/lib/gates.ts, scripts/snapshot.mjs, scripts/change.mjs]
updated: 2026-11-11
---

# 文件设计：scripts/validate.mjs（门禁读取器 · M3）

## 定位与边界

- **职责**：复用 `src/lib/evidence.mjs` 把项目实物采集为 `ProjectState` 快照，调用 `src/lib/gates.ts` 的判据，产出 `docs/reports/validate.json`（G1–G6 读数）。**不做判断式**；只做机械读数。
- **边界内**：状态采集、判据调用、报告；G6 收尾前置（含缺陷登记册存在性）。
- **边界外**：判据实现（`src/lib/gates.ts`）；缺陷判定（审计）。

## 对外暴露接口

`node --experimental-strip-types scripts/validate.mjs [--root <项目根>] [--check] [--release]`
退出码：`0` 无 `block`（可推进）；`1` 有 `block`；`2` 用法错。

**报告形态**（`docs/reports/validate.json`）：`{ ts, readings: GateReading[], summary, canAdvance, readyForRelease, errors, evidence, defectsRegister }`。
每个 `GateReading` 含 `id`/`verdict`/`examined`/`unrecognized`/`remedy?`；**`na` 与 `pass` 不得塌成同一读数**。

## 需引入的依赖

- Node 标准库；`src/lib/gates.ts`（只读导入）。

## 调用的模块能力及接口

- 读：`docs/ddd/**`（直接扫描；不信任可手改快照）、`docs/REQUIREMENTS.md`、`docs/ARCHITECTURE.md`、`docs/temp.jsonl`、`docs/board/board.jsonl`、缺陷登记册。
- 写：`docs/reports/validate.json`。
- 被 `/ddd-validate` 命令调用。

## G6 收尾前置（含 R36 缺陷登记册）

G6 判据须核对：`docs/temp.jsonl` 登记项均已清理；**看板活跃投影为空**；版本已落三处；**缺陷登记册存在且为唯一权威处**（R36）。
「缺陷已全部登记」是交付判据本身——报告须区分「零 FAIL」与「零缺陷」。

## 已知约束

- **只读权威、只写报告**；不改权威件。
- **缺件即 `na`，绝不判 `pass`**（§8 补充线索、R25）。
- `block`/`visible` 必带 `remedy`（Linter 即 Prompt）。
- 路径：报告写项目根；工具取包根（§8.7）。

## 状态

本件为 `frozen`；与实物（`scripts/`）对账一致。

## 2.0.0 发布条件

CLI 与 RPC 共用 `gate-evaluator.ts`；`--release` 在 G1–G6 全部通过后还调用 `executable-verifier.mjs` 真实执行 npm test 与已有的 typecheck/lint；脚本失败、缺少测试、源码指纹变化均不能视作发布准备就绪。`--check` 保持无报告写入。

## 2.0.0 收尾契约（2026-11-14）

**统一 G1-G6 + release**：--check 只读；--release 明确执行项目测试，无有效测试证明不可通过；所有结果与源指纹一致。
