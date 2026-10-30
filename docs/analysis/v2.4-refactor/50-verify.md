# 验证与验收契约

## 1. 机械验证

改造完成后依次运行，命令均在仓库根执行。

| 顺序 | 命令 | 期望 |
|---|---|---|
| 1 | `node -e "require('./scripts/ref-check.js')"` 或直接执行 `node scripts/ref-check.js .` | 退出码 0，末行 `RESULT: pass` |
| 2 | `node scripts/code-health.js .` | 退出码 0，末行 `RESULT: report`，无新增超阈值文件 |
| 3 | `node scripts/trace-check.js .` | 本仓库无 AC.md，输出末行 `RESULT: gap` 并说明无判定对象，退出码 1。本仓库无设计树与 AC，不将其作门禁，见规范「本仓库适用边界」节 |
| 4 | `node scripts/governance-check.js .` | 输出单 JSON，含 `verdict` 与 `limitBytes` 字段 |
| 5 | `node --check scripts/trace-check.js scripts/code-health.js scripts/governance-check.js scripts/ref-check.js` | 语法通过 |
| 6 | `node -e "const fs=require('fs'),vm=require('vm');new vm.Script('(async function(args,runs){'+fs.readFileSync('workflows/ddd-workflow.js','utf8')+'\n})')"` | 语法通过。`workflow` 为 pi 沙箱模块，含顶层 await 与顶层 return，不能以 `node --check` 校验 |

第 3 项若因本仓库无 AC.md 而报缺口，属既有行为，不视为本轮回归，但须在验收记录中注明。

## 2. 代理验收

| 代理 | 验收内容 | 期望结论 |
|---|---|---|
| ddd-doc-sync | 巡检全部文档一致性，覆盖其十项清单 | 漂移清单为空，或仅存与本轮无关的历史项并逐项说明 |
| ddd-auditor | 审计本轮新增声明与改动文件的消费方与验证手段 | 无新增无消费方声明 |

两份报告由根会话按建议归档名落盘至 `docs/audits/`。

## 3. 人工抽查

1. 任取三个代理，核对其完成本职所需判据是否在其提示词内。抽查对象建议为 `ddd-implementer`、`ddd-tester`、`ddd-interface-reviewer`。
2. 任取三处内联副本，与权威源比对是否逐字或语义一致。抽查对象建议为四级判据、结构治理回执句、粒度阈值。
3. 任取一张判定表，确认其含默认分支。
4. 确认 `SKILL.md` 流程表九步与 `workflows/ddd-workflow.js` 阶段流一致。
5. 确认 `global/APPEND_SYSTEM.md` 中「资料检索」一句仍存在，且与 `README.md`、`SKILL.md` 版本一致。

## 4. 验收标准到证据映射

| AC | 证据 |
|---|---|
| AC-1 判据就近 | 人工抽查第 1 项 |
| AC-2 权威单一 | `ref-check` 的 C8 加人工抽查第 2 项 |
| AC-3 判定表默认分支 | `ref-check` 的 C10 加人工抽查第 3 项 |
| AC-4 引用可机械检出 | 机械验证第 1 项 |
| AC-5 脚本消费契约表 | 机械验证第 2 至 4 项加人工比对 |
| AC-6 流程一致 | `ref-check` 的 C4 加人工抽查第 4 项 |
| AC-7 无新增无消费方声明 | 代理验收的 auditor 报告 |

## 5. 版本收尾

1. `CHANGELOG.md` 新增条目，记录本轮六项动作、改动文件清单、验证结论。
2. 结构健康度量写入 `docs/health.json`，由 `code-health` 脚本完成。
3. 打 tag `v2.4.0`。
4. 若安装脚本清单已更新，提示用户重新安装以同步部署面。

## 6. 风险与回退

| 风险 | 防护 |
|---|---|
| 大规模文档改写引入新的自相矛盾 | `ref-check` 的 C1 至 C9 加 doc-sync 巡检 |
| 脚本输出格式变更破坏既有消费方 | 只增末行机读结论，不改既有正文与退出码语义；`workflow` 不解析新增末行 |
| `ref-check` 自身成为无消费方声明 | 消费方为文档同步链与 `README.md` 提交前检查说明，已登记 |
| 阶段键新增 `audit` 与既有状态文件不兼容 | 新增键为追加式，既有 `doneStages` 仍合法，`stageRegistry` 过滤逻辑不变 |
| 改造范围蔓延 | 以本契约文件为界，超出范围记为下轮候选，不夹带 |
