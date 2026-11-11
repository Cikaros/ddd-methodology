---
doc: design
level: file
target: src/lib/router.ts
status: frozen
landed: false
covers: [routeSlices, detectIntent, Phase]
updated: 2026-11-11
---

# 文件设计：src/lib/router.ts（自主注入路由）

## 定位与边界

- **职责**：据**相位／意图／场景**三类信号，选出当前应注入的**最小切片集**（sliceIds）。纯函数，不直接注入。
- **边界内**：信号归一、切片选择、判定依据输出。
- **边界外**：实际注入（`src/index.ts` 的 `session.hook("context")` / `instructions.entry`）；切片内容（`assets/injection-slices.json`）。

## 对外暴露接口

| 导出 | 形态 | 说明 |
|---|---|---|
| `Phase` | 类型 | `init`/`intent`/`arch`/`design`/`implement`/`test`/`wrapup`/`idle` |
| `Intent` | 类型 | `frontend`/`backend`/`bugfix`/`docs`/`unknown` |
| `routeSlices(input)` | `(input) => { sliceIds, basis }` | 选切片；`basis` 记录判定依据（可观测） |
| `detectIntent(text, files)` | `(t,f) => Intent` | 启发式；可选由 `experimental.generate.decisions` 复核 |

## 需引入的依赖

无（**只依赖标准库**；映射表由调用方从 `assets/injection-slices.json` 读入后传入）。

## 调用的模块能力及接口

被 `src/index.ts` 的 context hook 调用；读 `assets/injection-slices.json`（单点权威）。

## 已知约束

- 判定**必须可观测**：返回 `basis`（用了哪类信号）。误判只影响引导。
- 不做机械强制（那是 `guard.ts`）；本件只选内容。