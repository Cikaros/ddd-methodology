---
doc: design
level: file
target: src/lib/registry.ts
status: frozen
landed: true
covers: [COMMANDS, SKILLS, registrations, auditRegistrations]
updated: 2026-11-11
---

# 文件设计：src/lib/registry.ts（注册清单与自检）

## 定位与边界

- **职责**：声明本插件要注册的**命令清单**与**技能清单**，并提供自检（前缀、去重、必有描述）。
- **边界内**：清单数据与纯函数自检。
- **边界外**：把清单装进宿主（在 `src/index.ts`）；命令的**唯一权威**注册表（在 `assets/commands.json`，本件是运行期投影）。

## 对外暴露接口

| 导出 | 形态 | 说明 |
|---|---|---|
| `CommandSpec` | 类型 | `{ name, description }` |
| `SkillSpec` | 类型 | `{ id, name, description }` |
| `COMMANDS` | `readonly CommandSpec[]` | 13 条命令，统一 `ddd-` 前缀 |
| `SKILLS` | `readonly SkillSpec[]` | 随包技能清单 |
| `registrations()` | `() => Registrations` | 返回清单 |
| `auditRegistrations(r?)` | `(r?) => string[]` | 自检，返回问题列表（空即合格） |

## 需引入的依赖

无（**只依赖标准库**，故可离线自测）。

## 调用的模块能力及接口

无外部调用。被 `src/index.ts` 与 `scripts/selftest.mjs` 只读消费。

## 已知约束

- 清单**单点权威**在 `assets/commands.json`；本件与其须一致（由 `scripts/` 对账）。
- 命令名与 md 文件命令**不同名**（前缀化，规避 V-07）。
