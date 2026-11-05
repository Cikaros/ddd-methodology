# 存量债务登记簿模板

`templates.md` 的配套文件，承载存量债务登记簿的骨架与字段说明。设计依据见 governance-declaration 技能的存量债务登记与清偿条；字段权威在本文件。

登记簿置于 `<项目根>/docs/debts.json`，是存量债务的唯一登记处，替代散落在正文句子中的登记。校验由 `ddd_debt_check` 工具（`root` 传被开发项目根的绝对路径）承担，末行给出机读结论并据此置退出码。

## 骨架

```json
{
  "currentVersion": "v2.11",
  "maxOpen": 10,
  "defaultDueSpan": 2,
  "debts": [
    {
      "id": "D-001",
      "desc": "一句话描述",
      "registeredAt": "v2.11",
      "owner": "根会话",
      "dueBy": "v2.13",
      "status": "open",
      "reason": "登记理由，例如范围外、需先补设计预判",
      "rootCause": "机械校验有盲区",
      "recurrence": { "count": 0, "lastVersion": null }
    }
  ]
}
```

## 字段说明

顶层字段：

| 字段 | 含义 | 约束 |
|---|---|---|
| currentVersion | 当前版本 | 形如 v主.次，按主次两段数值比较 |
| maxOpen | 未清项上限 | 固定默认值十项，未清项数不得超过该字面值；「约三倍」仅说明其由来，非计算规则或校验公式 |
| defaultDueSpan | 默认时限跨度 | 未给 dueBy 时取登记版本加此跨度，默认 2 个版本 |
| debts | 债务条目数组 | 元素字段见下表 |

条目字段（`debts` 数组元素）：

| 字段 | 含义 | 约束 |
|---|---|---|
| id | 编号 | 形如 D-001，仓库内唯一 |
| desc | 一句话描述 | 非空 |
| registeredAt | 登记时的版本 | 形如 v主.次 |
| owner | 承接方 | 必填且具名；禁「留待下一轮」这类无对象的表述 |
| dueBy | 应清版本 | 未清项不得早于 currentVersion，否则判超期 |
| status | 状态 | 仅取 open 或 closed |
| reason | 登记理由 | 非空 |
| rootCause | 根因分类 | 取六类之一，由债务文本归纳 |
| recurrence | 复发记录 | 含 count 与 lastVersion；count 为非负整数，lastVersion 在 count 为零时为 null，否则形如 v主.次 |

根因分类六类：声明与事实脱节、单一权威被违背、机械校验有盲区、规则演进后消费方未同步、反复修补同一处、运行时契约未落地。

字段与 governance-declaration 技能的存量债务条逐项对应，不得增删；超出 maxOpen 或存在超期未清项即触发阻断，连续两轮超期则升级用户；同一根因分类连续两版登记为未清，须在下一轮升级用户并登记为结构性问题。

## 债务历史快照

`debt-check.js` 每次运行时维护 `<项目根>/docs/debt-history.json`，其 `history` 数组按版本新增或就地更新，同一版本重复运行不产生重复条目。每条快照含记录时间 `at`、版本 `version` 与当时全部条目摘要，摘要字段为 `id`、`rootCause`、`status`、`registeredAt` 与 `dueBy` 五项；历史上限五十条，超出截断，与健康度量产物同口径。该脚本据上一版本快照与当前版本新增登记的债务作机械根因复发检测，复发段落不改变其末行结论与退出码；复发计数由根会话在登记同根因新债务时更新，口径见 governance-declaration 技能的存量债务条。
