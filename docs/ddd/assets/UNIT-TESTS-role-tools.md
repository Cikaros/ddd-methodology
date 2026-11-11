---
doc: unit-tests
level: file
target: assets/role-tools.json
status: frozen
landed: false
depends: [assets/DESIGN-role-tools.md]
updated: 2026-11-11
---

# 单元测试设计：assets/role-tools.json

## 执行件与前置

- 执行件：待实现（角色工具白名单的校验与消费）。
- 前置：`assets/DESIGN-role-tools.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-assets-role-tools-01 | schema 合法 | JSON 可解析，键为角色 id，值为工具名数组 | 待落地 |
| UT-assets-role-tools-02 | 只读角色无写工具 | reviewer/auditor 不含 write/edit/shell | 待落地 |
| UT-assets-role-tools-03 | 清单齐备 | `agents/DESIGN.md` 每个角色在此有对应条目 | 待落地 |
| UT-assets-role-tools-04 | 裁剪生效 | context hook 按 `event.agent` 删除白名单外工具后，请求工具集恰为白名单 | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。