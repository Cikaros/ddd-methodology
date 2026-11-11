---
doc: design
level: file
target: assets/rules.json
status: frozen
landed: false
covers: [rules]
depends: [src/index.ts]
updated: 2026-11-11
---

# 文件设计：assets/rules.json（执行规则基线）

## 定位与边界

- **职责**：执行规则的**唯一权威基线**；每条规则声明它落宿主的哪一种**可执行面**。
- **边界内**：规则 id、判面、落点类别、权限规则形态。
- **边界外**：落点的运行时施加（`src/index.ts`）；命令串形态（**交宿主内置扫描器**，不自建）。

## 对外暴露接口

JSON：`{ "rules": [ { "id", "surface", "action", "resource", "effect" } ] }`

| 字段 | 取值 |
|---|---|
| `surface` | `permission`（落 `permissions`） / `session`（落 `session.update({permissions})`） / `evaluate`（落 `permission.hook("evaluate")`） |
| `action`/`resource`/`effect` | 权限四元组的取值（`effect ∈ allow/deny/ask`） |

## 需引入的依赖

无。被 `src/index.ts` 只读消费。

## 调用的模块能力及接口

`src/index.ts` 依 `surface` 分别：写会话级权限规则、或注册 `evaluate` hook（fail-safe）。

## 已知约束（关键，来自实证）

- **每条规则须落以上三者之一**，否则是「纸老虎」（R34）。
- **权限域无 `transform`**：规则**不得**声称「注册」；只落配置 / `session.update` / `evaluate` hook。
- **不重写命令黑名单**：命令串形态交宿主内置扫描器（fail-closed）。
- 缺省无匹配规则时宿主取 `ask`（默认拒绝）。
