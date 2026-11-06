---
name: spec-test-case
description: 用例设计规范，管同目录 TEST.md 的用例与覆盖。当节点为 test-plan、需要撰写或修订模块目录下的 TEST.md 时读取。
---

# 用例规范

## 何时用

- test-plan 节点，撰写与同目录 DESIGN 并置的 TEST.md。
- 模块级 AC 变更后，调整用例集合。
- 派发 ddd-test-designer 前，确认输入含 AC.md、基础能力清单与就近 DESIGN。

## 做什么

**TEST.md 结构**（节名固定）：

```markdown
# TEST：模块名

## 测试范围

## 基础能力独立用例
| 用例ID | 覆盖的基础能力 | 前置 | 断言 | 执行命令（含超时） |

## 用例清单
| 用例ID | 覆盖的 AC | 路径类型 | 前置 | 步骤 | 断言 | 执行命令（含超时） | 预估时长 | 风险级别 | 优先级 |

## 桩化说明

## 手动测试清单
| 用例ID | 无法自动化原因 | 手动步骤 | 预期结果 | 反馈状态 | 登记时间 |

## 缺陷记录与路由
| 缺陷ID | 级别 | 定级依据 | 路由去向 | 状态 |
```

- 用例清单的「覆盖的 AC」指向模块级 AC，模块级 AC 全覆盖。
- 基础能力清单中每条基础能力（或较高风险者）须有独立用例，与其独立测试文件对应。
- 涉及网络、长循环、大数据量、外部服务或真实等待的用例必须桩化，或移入手动测试清单；高风险用例须桩化。
- 执行命令须含超时；用例须标预估时长与风险级别。
- 缺陷记录与路由表只记结果，级别定义与路由去向见 spec-defect-routing。

**覆盖是否充分**：

- 量化口径为行覆盖率，阈值默认 80%，与统一解析脚本 `skills/ddd-methodology/scripts/coverage-check.js` 的默认值一致，两处不得不同。
- 覆盖率经 Cobertura 兼容 XML 由该脚本判定，不依赖具体语言工具；阈值可为具体项目配置覆盖。
- 报告缺失与报告不可解析同为报告缺口，未达阈为覆盖缺口，三者均不得视为通过；覆盖缺口按 D 级或 C 级路由，不得以覆盖率数字好看为由放行。

## 不做什么

- 缺 AC 与设计即报派发类型不匹配，不凭空造用例。
- 不裸跑用例，只照抄计划中的含超时命令。
- 不在本技能重复定义缺陷四级，级别定义归 spec-defect-routing。
- 测试执行不在本节点，本节点只出计划。

## 条款与来源对照

| 条款 | 来源 |
|---|---|
| TEST.md 各节名与表头 | templates.md 的 TEST_PLAN 节，产物名改同目录 TEST.md |
| 产物为同目录 TEST.md | DESIGN-agents.md 契约总表（ddd-test-designer 产出） |
| 覆盖模块级 AC | DESIGN-governance.md 门禁表 G5 行与 templates.md 的 TEST_PLAN 节 |
| 高风险用例须桩化 | DESIGN-governance.md 门禁表 G5 行 |
| 桩化、超时与四态报告 | spec-design.md 的测试阻塞防护节 |
| 缺 AC 与设计即报派发类型不匹配 | DESIGN-agents.md 契约总表（ddd-test-designer 前置阻断条件） |
| 覆盖是否充分的行覆盖率口径、三态与阈值默认值 | DESIGN-test-baseline.md 第三、五、六节 |
