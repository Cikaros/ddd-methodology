# 设计树评审（第一轮 · 机械对账）

> 对象：`docs/ddd/**`（43 份设计件）。方法：机械对账 + 承重机制承接核查。属**临时审计件**，收尾时清理。

## 一、读数

| 项 | 读数 |
|---|---|
| 设计件总数 | 43（子项目 1 / 模块 5 / 分组 9 / 文件 28） |
| frontmatter 齐备 | 43/43（`doc`/`level`/`target`/`status`/`updated`） |
| `target` 唯一 | 43/43，无重复 |
| 已证伪断言（pi.dev 期） | 0 |
| 测试设计件（`UNIT-TESTS-*`/`TESTS-*`） | **0** |

## 二、发现与处置

| # | 级别 | 发现 | 处置 |
|---|---|---|---|
| F1 | **high** | **无任何测试设计件**：违反 R21「测试树四级」，G4「测试树覆盖」无承接 | **已闭合（第二轮）**：补 28 份 `UNIT-TESTS-*` + 15 份 `TESTS-*`，用例编号 94 条全局唯一，机械对账 0 问题 |
| F2 | med | 承重机制 **M13** 未被设计件显式承接 | **已修**：`docs/ddd/src/lib/DESIGN.md` 的「承重机制承接」已补 M13→`router.ts`+`guard.ts` |
| F3 | low | `skills/lang/DESIGN-SKILL-TEMPLATE.md` 的 `target` 误写为具体路径 | **已修**：改为 `skills/lang/<id>/SKILL.md` |

## 三、同构实例的例外（登记，非缺陷）

以下为**目录驱动的同构实例**，按族设计件 + 目录资产覆盖，**不逐实例另立设计树**（否则违反 M10 单点权威且判定冗余）：

- `skills/lang/<id>/`（12 语言）← `docs/ddd/skills/lang/DESIGN.md` + `assets/languages.json`
- `skills/lang/<id>/references/*` ← `docs/ddd/skills/lang/references/DESIGN.md`
- `skils/lang/DESIGN-SKILL-TEMPLATE.md` 为统一模板
- `assets/lang-<id>.json` ← `assets/languages.json` 的 `mechanicalKeys`
- `skills/dev-tools/references/*`、`skills/frontend-variant-contract/references/*` ← 各自 references 分组设计

## 四、结论

- 结构面（同构、frontmatter、target 唯一、无证伪断言）**通过**。
- **F1 已闭合**：补全四级测试树（28 `UNIT-TESTS-*` + 15 `TESTS-*`，94 条用例编号全局唯一，0 问题）。
- **第二轮复评通过，设计树冻结**（86 份件 `status: frozen`）。
- 下一步：代码落地（按文件级设计逐件实现），再 `/ddd-test`、`/ddd-validate`。