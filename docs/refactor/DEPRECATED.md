# 范围废弃项清单

本轮定向重构范围内被替换的产物，逐项登记。

| 编号 | 原产物 | 类别 | 替代物 | 清除 |
|---|---|---|---|---|
| D1 | `references/spec.md` 的单文件全文组织 | 文档 | 同目录 `spec.md` 索引与七份 `spec-*.md` | 本轮 |
| D2 | `ref-check.js` 的文件读取、行号、漂移项构造内联实现 | 代码 | `scripts/lib/text.js` | 本轮 |
| D3 | `roster-check.js` 与 `decision-tables.js` 的同类内联实现 | 代码 | `scripts/lib/text.js` | 本轮 |
| D4 | `code-health.js`、`governance-check.js`、`trace-check.js` 的内联目录遍历 | 代码 | `scripts/lib/walk.js` | 本轮 |
| D5 | `apply-models.js` 的硬编码角色名单 | 代码 | `agents/` 目录读取 | 本轮 |
| D6 | `roster-check.js` 用于 `workflow` 的通用前缀扫描 | 代码 | 按载体分派的提取策略 | 本轮 |
| D7 | `ref-check.js` 的硬编码阈值规则 | 代码 | 从规范锚点句解析 | 本轮 |

## 声明

未列入本清单而实际不再使用的产物视为静默保留，属缺陷。

## 回溯

被替换的旧版本保留在回溯点 `8eb2f87`，标记 `v2.6.1`。需要参照时用 `git show 8eb2f87:<路径>` 读取。
