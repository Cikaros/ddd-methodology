---
doc: design
level: group
target: src/lib
status: frozen
landed: true
updated: 2026-11-11
---

# 分组设计：src/lib（共享纯函数层）

## 目录定位与边界

- **职责**：插件的**纯函数层**——不依赖宿主、不读盘、只依赖 Node 标准库；因此可在**无模型、无网络**下被离线自测断言。
- **边界内**：注册清单与自检、门禁判据、路径解析。
- **边界外**：宿主调用（在 `src/index.ts`）、盘面 I/O（在 `scripts/` 或调用方）、内容（在 `assets/`）。

## 目录规划

| 文件 | 一句话职责 |
|---|---|
| `registry.ts` | 命令/技能清单与自检（`ddd-` 前缀、去重、必有描述） |
| `router.ts` | 自主注入路由：相位/意图/场景 → 最小切片集；判定可观测 |
| `guard.ts` | 底线守卫：底线清单 → 机械执法点；无执法点者报错 |
| `memory.ts` | M6 记忆闭环：置信度/提醒/晋升/衰减/scope（纯函数） |
| `board.ts` | M7 看板：投影/准入/状态转移/孤儿检测（持久多步待办） |
| `shell-encoding.ts` | PowerShell 输出编码适配（UTF-8 前缀；环境适配、可关） |
| `gates.ts` | 六道门禁判据，入参为项目状态快照；区分 `pass/block/visible/na` |
| `paths.ts` | 包根 / 项目根解析；随包件与项目件分离 |

> 本层是「装饰性薄的」：把可机械判定者从宿主耦合中抽出，使 M1/M3/§十二 的离线回归有落点。

## 依赖方向（本分组不变量）

- `src/lib/**` **只依赖 Node 标准库与 `node:url`**；**禁止** import `@opencode/plugin` 或任何宿主包。
- `src/index.ts` 可只读导入 `src/lib/**`；反向禁止。

## 承重机制承接

M3（落地门禁）经 `gates.ts`；M10（反漂移）经 `registry.ts` 的清单单点；§8.7（路径纪律）经 `paths.ts`；**M13（自主注入与底线守卫）经 `router.ts`（注入路由）＋ `guard.ts`（底线守卫）**；**M6（记忆闭环）经 `memory.ts`（置信度/提醒/晋升/衰减）**；**M7（看板闭环）经 `board.ts`（投影/准入/转移/孤儿）**。

## 状态

本件为 `frozen`；与上级设计件及实物对账一致。
