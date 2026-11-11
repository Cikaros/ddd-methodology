---
doc: design
level: file
target: assets/commands.json
status: frozen
landed: true
covers: [commands-registry]
depends: [src/lib/registry.ts]
updated: 2026-11-11
---

# 文件设计：assets/commands.json（命令注册表）

## 定位与边界

- **职责**：命令的**唯一权威注册表**——名称、用途、参数、实现形态。
- **边界内**：命令清单数据。
- **边界外**：命令的实现（server part 的 transform 或 `/.opencode/commands/*.md`）。

## 对外暴露接口

JSON：`{ "commands": [ { "name", "purpose", "params", "impl", "blocking", "dispatch" } ] }`

| 字段 | 取值 |
|---|---|
| `name` | `ddd-*`（前缀化） |
| `purpose` | 一行用途 |
| `params` | 参数取值域，如 `[]` 或 `["--from-code"]` |
| `impl` | `extension`（由 server part 注册）或 `prompt`（md 入口） |
| `blocking` | `true` 表示阻塞节点 |
| `dispatch` | **派发策略**：`same`（默认，同会话执行）／`isolated`（子代理隔离；仅 `ddd-review`／`ddd-validate`／`ddd-consolidate`） |

## 需引入的依赖

无（数据件）。被 `src/lib/registry.ts` 与 `scripts/` 只读消费。

## 调用的模块能力及接口

被 `src/lib/registry.ts` 的 `COMMANDS` 投影；由 `scripts/` 对账二者一致。

## 已知约束

- **单点权威**：命令条目只在此写具体值；`src/lib/registry.ts` 的 `COMMANDS` 是运行期投影，须与本件一致（M10）。
