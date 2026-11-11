---
doc: design
level: file
target: assets/role-tools.json
status: draft
landed: false
covers: [role-tools]
depends: [src/lib/guard.ts]
updated: 2026-11-11
---

# 文件设计：assets/role-tools.json（角色→工具白名单）

## 定位与边界

- **职责**：每个子代理角色**允许的工具集**的唯一权威（Q4 机械强制的输入）。
- **边界内**：角色 id → 允许工具名单。
- **边界外**：强制施加（`src/index.ts` 的 context hook 裁剪 + 权限）；工具实现。

## 对外暴露接口

JSON：`{ "roles": { "<role-id>": ["read","grep", ...] } }`

| 角色（示例） | 允许（示例） |
|---|---|
| `ddd-design-reviewer` / `ddd-auditor` | `read`、`grep`、`glob`（**只读**） |
| `ddd-designer` / `ddd-test-designer` | 只读 + `write`/`edit`（限目标树） |
| `ddd-implementer` | 只读 + `write`/`edit` + `shell`（受守卫） |
| `ddd-tester` | 只读 + `shell`（跑测试，受守卫） |
| `ddd-consolidator` | 只读 + `write`/`edit`（限目标块） |
| `ddd-curator` | `read` + 记忆追加（经唯一写入器） |

## 需引入的依赖

无。被 `src/lib/guard.ts` 与 `src/index.ts` 消费。

## 调用的模块能力及接口

`src/index.ts` 在 `session.hook("context")` 中据 `event.agent` **删除不在白名单的工具**（`delete event.tools[x]`）；并据本件生成角色 `permissions` 的 `deny`。

## 已知约束

- **单点权威**：角色工具集只在此件；角色 md 与代码引用不复写。
- 宿主无 agent 级 `tools` 字段，故本件是「请求级裁剪 + 权限」的唯一数据源。
- 只读角色不得被授予写工具。