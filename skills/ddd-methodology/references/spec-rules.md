# 规则规范（spec-rules）

## 三态落点（每条规则须落其一，否则是「纸老虎」）

| 类别 | 落点 | 说明 |
|---|---|---|
| 静态可判规则 | 权限规则 `{action, resource, effect}`（配置 `permissions`） | last-match-wins；`effect ∈ allow/deny/ask` |
| 项目登记规则 | `session.update({ permissions })` | 在 agent 规则之后评估，last-match-wins |
| 需动态判断的规则 | `permission.hook("evaluate")` | 对 `allow`/`ask` 运行；可置 `deny` 与 `message`（补救话术） |

## 失败语义三分

- **阻塞**：不通过即拦下、须给补救（`deny` 或 `evaluate` 置 `deny`）。
- **可见**：读数入册但不拦。
- **不适用**：判定对象不存在、退出码零；**不得与「通过」塌成同一读数**。

## 关键口径

- **权限域无 `transform`**：规则不得声称「注册」，只落配置 / `session.update` / `evaluate` hook。
- **hook 回调返回 void**：不能靠返回值阻塞；拦走权限层或抛错。
- **不重写命令黑名单**：命令串形态交宿主**内置 shell 扫描器**（fail-closed）。
- **缺省无匹配规则时取 `ask`**（默认拒绝）；审批风控须 **fail-safe**（判定失败倾向 `ask`，不默认 `allow`）。
- **显式 `deny` 是终判，不进入 `evaluate` hook**。

## 盲区叙述

机器可读的盲区清单在 `assets/rules.json` 的 `blindspots`；本件只作语义叙述。留痕以**自写为主、事件为辅**，事件面缺失不产生空洞。
