---
doc: design
level: file
target: scripts/report-io.mjs
status: frozen
landed: true
covers: [writeReportJson, writeReportText]
depends: [src/lib/paths.ts]
updated: 2026-11-12
---

# 文件设计：scripts/report-io.mjs（派生报告幂等写入）

## 定位与边界

- **职责**：为 `docs/reports/**` 的派生报告提供**幂等写入**——**同一输入恒得同一文件**；内容（除 `ts` 外）不变则**保留既有 `ts`**，不制造无意义 diff。
- **边界内**：写入策略（ts 保留、内容比对、必要时才落盘）。
- **边界外**：报告的**内容**（由各写入器：`snapshot`／`drift-check`／`validate` 等生成）；判定逻辑。

## 背景（DEF-0013）

报告含 wall-clock `ts`；若每次刷新，则「同一输入」产出不同文件，违反方法论「**可复算**」要求，并令 `npm run release` **永远留下脏工作区**（门不可用）。本件修此。

## 对外暴露接口

| 导出 | 契约 |
|---|---|
| `writeReportJson(outPath, obj)` | 写 JSON 报告：内容（除 `ts`）不变 → 保留旧 `ts` 且不落盘；有实质变化才更新 `ts` 并写盘。返回 `true`＝有实质变化 |
| `writeReportText(outPath, text)` | 写文本报告（md）的幂等版本；内容相同不落盘。返回 `true`＝有实质变化 |

## 需引入的依赖

- Node 标准库（`node:fs`、`node:path`）。

## 调用的模块能力及接口

被 `scripts/snapshot.mjs`、`scripts/drift-check.mjs`、`scripts/validate.mjs`（以及可选的 md 写入器）调用。

## 已知约束

- **幂等优先**：内容稳定是常态；只有实质变化才更新 `ts` 与文件。
- **不吞变化**：内容确有变化时**必须**落盘（不得因 `ts` 保留而漏写）。
- **不改内容语义**：只决定「何时写、ts 取何值」，不增删报告字段。
- 路径：写入取项目根（§8.7）。

## 状态

本件为 `frozen`；与实物（`scripts/report-io.mjs`）对账一致。
