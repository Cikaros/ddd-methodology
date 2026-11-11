---
doc: design
level: file
target: src/lib/paths.ts
status: frozen
landed: true
covers: [packageRoot, projectRoot, packagePath, projectPath, within]
updated: 2026-11-11
---

# 文件设计：src/lib/paths.ts（路径解析）

## 定位与边界

- **职责**：解析**包根**与**项目根**，并提供随包件／项目件的拼接函数。
- **边界内**：根解析与拼接。
- **边界外**：盘面读取；路径纪律的**判据**（在规则层）。

## 对外暴露接口

| 导出 | 形态 | 说明 |
|---|---|---|
| `packageRoot()` | `() => string` | 由 `import.meta.url` 上溯两级得包根 |
| `projectRoot(location)` | `(loc) => string` | 取 `ctx.location.directory`；缺失即抛错，**不回落** |
| `packagePath(rel)` | `(rel) => string` | 相对**包根**拼接 |
| `projectPath(root, rel)` | `(root, rel) => string` | 相对**项目根**拼接 |
| `within(prefix, candidate)` | `(p, c) => boolean` | 候选是否在前缀内 |

## 需引入的依赖

- `node:url`、`node:path`（标准库）。

## 调用的模块能力及接口

被 `src/index.ts` 调用（如技能 `path` 取包根）。

## 已知约束

- **随包件的根取包根，不得拼项目根**；生成到使用者项目的件取项目根（§8.7，C-43 教训）。
- 二者**不得混用同一拼接基准**。
- 缺失 `ctx.location.directory` 时**报错**而非静默回落（避免把件落到错误根）。
