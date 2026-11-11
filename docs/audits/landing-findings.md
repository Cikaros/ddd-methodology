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

## F3 · M5「意图确认」的阻塞式确认原语未落地（**已闭合 · 已补齐**）

| 项 | 内容 |
|---|---|
| 严重度 | high |
| 判据 | R8「以阻塞方式取得确认」；§9.5「TUI `dialog.*` 与 server `permission.assert` 二者择一」；R20 判据①「声明了但实物没有」 |
| 现象 | `src/DESIGN-tui.md` 列出 `context.ui.dialog.confirm/prompt/select` 为所调用能力；`src/DESIGN-index.md` 记 M5 在本模块有落点；但 `src/tui.tsx` 只调 `toast.show`/`ui.slot`，`src/index.ts` 无 `permission.assert`——**阻塞原语两侧皆未落地** |
| 归因 | 落地时 TUI 按「增强、非承重」做了最小实现，未落 §9.5 的阻塞确认「择一」 |
| 处置 | **已闭合（补齐）**：按 §9.5「择一」，M5 由 **server 侧 `ctx.permission.assert`** 承担——`/ddd-intent` handler 在推进前取阻塞确认；`DESIGN-tui.md`/`DESIGN-index.md` 同步声明「备选原语 dialog、实际择 server assert」，消除「声明 vs 实物」缺口 |
| 复检 | `src/index.ts` 的 `ddd-intent` 路径含 `permission.assert`；离线自测（mock `permission.assert`）通过 |

## F4 · M11「项目对接规范」七字段未落地（**已闭合 · 已补齐**）

| 项 | 内容 |
|---|---|
| 严重度 | med |
| 判据 | R28/裁决 3a「对接字段集冻结为七字段 ＋ `ext`」；R51「按 R28 七字段登记」 |
| 现象 | `assets/gates.json`（缺省集）与 `assets/DESIGN-gates.md` 仅声明 `id/executor/failSemantics/inNodeSource`（+`criterion`），**缺「判面/读数形态/`ext`」**；且 M11 在 `docs/ddd/**` 无具名文件级承接 |
| 归因 | 门禁集按 §6.2 的「执行者/通过判据」压缩落地，未展开成 R28 的七字段对接形态 |
| 处置 | **已闭合（补齐）**：`assets/DESIGN-gates.md` 声明七字段（`id`/`scope`/`executor`/`readingShape`/`criterion`/`failSemantics`/`inNodeSource` ＋ `ext`）；`assets/gates.json` 每条补 `scope`/`readingShape`/`ext`；`GateReading` 的 `examined`/`unrecognized` 即读数形态自省 |
| 复检 | 七字段齐备；`scripts/validate.mjs` 读数含 `examined`/`unrecognized`（自省字段） |

> **根因（与 F2 同）**：判据强度不足——「被提及」不等于「有文件级承接且实物存在」。已在本轮把判据升级为「具名承接 + 实物存在」，并据此复检全树。

## 三、读数小结

| 项 | 读数 |
|---|---|
| 本轮落地文件级设计 | 41/41（机械验收：tsc 0 错；离线自测 106/106） |
| 发现缺陷 | 4（F1 已修复；F2/F3/F4 已闭合 · 已补齐） |
| 设计树状态 | 112/112 `frozen`；`landed: true` 56/56 |
| 门禁读数 | G1/G3/G4/G5 pass；G2/G6 na；**block 0** |
| 机制复检 | M1–M13（＋ R25/R36）均有**文件级承接设计**且**实物存在**，0 缺口 |
| 诚实界定 | 「block 0」不等于「无缺陷」；三轮「声明 vs 实物」判据复检（F1–F4）均已登记并处置 |
