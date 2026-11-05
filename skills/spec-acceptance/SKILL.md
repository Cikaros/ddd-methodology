---
name: spec-acceptance
description: 验收标准规范，管 AC 的可判定性与三类路径覆盖。当节点为 acceptance、需要撰写或修订 AC.md 时读取。
---

# 验收规范

## 何时用

- acceptance 节点，撰写 AC.md。
- 需求变更后，调整对应 AC。
- 派发 ddd-acceptance 前，确认输入含 REQUIREMENTS.md 与 ARCHITECTURE.md。

## 做什么

**AC.md 结构**（表头固定，被机械校验锚定，不得改写）：

```markdown
# 验收标准

| AC 编号 | 对应需求 | 路径类型 | Given | When | Then |
```

**三条判据。**

- 每条 AC 可客观判定，不得含主观词。
- AC 与需求编号双向可追溯：每条 AC 指向需求编号，每条需求有 AC 覆盖。
- 路径类型取正常、边界、异常三值之一，三类路径均须有 AC 覆盖。

**模块级 AC。** 总 AC 由分解设计分发到各 DESIGN 的模块级验收要点，分发动作见 spec-contract；本技能只定总 AC 与三类路径覆盖。

## 不做什么

- 不改需求：需求矛盾或缺口时停止并报告，回 requirements 节点。
- 不以「看起来正确」代替客观可判定。
- 不省略正常、边界、异常三类路径中的任一类。

## 条款与来源对照

| 条款 | 来源 |
|---|---|
| AC.md 表头 | templates.md 的 AC 节 |
| 路径类型三值 | templates.md 的 AC 节 |
| 三类路径均须有 AC 覆盖 | templates.md 的 AC 节与 DESIGN-governance.md 门禁表 G2 行 |
| 每条 AC 可客观判定 | templates.md 的 AC 节与 DESIGN-governance.md 门禁表 G2 行 |
| AC 与需求编号双向可追溯 | DESIGN-governance.md 门禁表 G2 行 |
| 模块级 AC 由分解设计分发 | templates.md 的 AC 节 |
| 需求矛盾或缺口即停止报告 | DESIGN-agents.md 契约总表（ddd-acceptance 前置阻断条件） |
