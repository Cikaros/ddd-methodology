# 落地期发现（缺陷登记册 · R36 唯一权威处）

> 对象：代码落地 + `/ddd-test` + `/ddd-validate` 的机械读数。属**临时审计件**（登记 `docs/temp.jsonl`）。
> 说明：本轮落地按 49 份文件级设计逐件实现，机械验收全绿；但**落地过程**暴露了两条设计树自身的缺陷，如实登记。

## F1 · 冻结件正文残留 `draft` 标记（**已修复**）

| 项 | 内容 |
|---|---|
| 严重度 | med |
| 判据 | 概要 §六.4：「`status: frozen` 的件不得含 `draft` 标记」 |
| 现象 | 15 份**目录级**设计件 frontmatter 已是 `status: frozen`，但 `## 状态` 正文仍字面写「本件为 `draft`…」 |
| 范围 | `docs/ddd/DESIGN.md`、`src/DESIGN.md`、`src/lib/DESIGN.md`、`assets/DESIGN.md`、`agents/DESIGN.md`、`scripts/DESIGN.md`、`skills/DESIGN.md` 及 `skills/**` 各目录级共 15 件 |
| 归因 | 冻结时只改了 frontmatter `status`，未做 M12「剔内联痕迹 / 重构成终稿」，正文状态句未同步 |
| 处置 | **已修复**：`## 状态` 正文统一归并为「本件为 `frozen`；与上级设计件及实物对账一致。」（非契约叙述，契约（frontmatter/target）逐字未动） |
| 复检 | body `draft` 标记件数：15 → **0** |

> **自审计漏检根因**：原自审计检查项只做 `^status:\s*draft`（frontmatter 行）扫描，未扫**正文**状态句；M12「内联痕迹」清单未含「正文状态句」。

## F2 · `scripts` 模块承重承接超越其文件级实证（**已闭合 · 已补齐**）

| 项 | 内容 |
|---|---|
| 严重度 | high（涉及多项「保留核心」） |
| 判据 | R13/R20 声明面与实物对账「声明了但实物没有」；§十三 承重机制须有**机械承接件** |
| 现象 | 子项目设计称「M1/M2/M3/M9/M10 → `scripts/`（快照、变更流、落地门禁、图集重放、反漂移）」，`scripts/DESIGN.md` 亦称承 M1/M2/M3/M9/M10；但 `scripts/` 仅有 `selftest.mjs`、`board.mjs` 两件文件级设计与实现 |
| 缺件（无文件级设计、无实现） | ① **M1** 设计树机器可读快照；② **M2** 变更流 `docs/CHANGELOG.jsonl` **唯一写入器**（R27）；③ **M9** 图集重放与巡检（R35）；④ **M10** 反漂移**复写扫描**；⑤ 门禁读取器；另 R25（反证）、R36（缺陷登记册） |
| 处置 | **已闭合（选 A 补齐）**：补 7 件文件级设计 + 7 件测试 + 实现：`scripts/snapshot.mjs`(M1)、`change.mjs`(M2)、`validate.mjs`(M3)、`map.mjs`(M9)、`drift-check.mjs`(M10)、`defects.mjs`(R36) 与 `assets/counterexamples.json`(R25)；`package.json` 增脚本入口；`scripts/DESIGN.md`/`assets/DESIGN.md` 父件接线 |
| 复检 | 声明面=实物面：M1/M2/M3/M9/M10/M7 + R25/R36 均有具名设计与实现；`drift-check` 零复写；`snapshot` 缺口 0 |

> **自审计漏检根因**：原自审计检查项 #6 只验「M1–M13 是否在树中被**提及**」，未验「每个承重机制是否有**具名文件级承接设计**且实物存在」。这是「提及 vs 承接」的判据强度不足——已在本轮补齐中修正为「具名承接 + 实物存在」。

## 三、读数小结

| 项 | 读数 |
|---|---|
| 本轮落地文件级设计 | 41/41（机械验收：tsc 0 错；离线自测 106/106） |
| 发现缺陷 | 2（F1 已修复；F2 已闭合 · 已补齐） |
| 设计树状态 | 112/112 `frozen`；`landed: true` 56/56 |
| 门禁读数 | G1/G3/G4/G5 pass；G2/G6 na；**block 0** |
| 诚实界定 | 「block 0」不等于「无缺陷」；两轮发现均已登记并处置（`docs/audits/landing-findings.md` 为 R36 登记册唯一权威处的实例） |
