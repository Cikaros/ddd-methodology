---
doc: design
level: module
target: src
status: frozen
landed: false
updated: 2026-11-11
---

# 模块设计：src（插件实现）

## 定位与边界

- **职责**：一个 OpenCode 插件包的实现本体，承载三个 part（server / tui / rpc）与共享纯函数层。
- **边界内**：`Plugin.define` 装配、四类注册口（命令/技能/代理/工具）、hooks 观测、RPC 契约与实现、随包件路径解析。
- **边界外**：知识/资产的**内容**（在 `skills/`、`assets/`）；随包工具（在 `scripts/`）；宿主既有能力（凡宿主已提供者不在此重实现）。

## part 划分（对应仓库根的三入口）

| part | 入口文件 | 宿主运行时 | 取舍 |
|---|---|---|---|
| server | `src/index.ts` | OpenCode 服务端进程 | **采用**（能力核心） |
| tui | `src/tui.tsx` | 终端客户端 | **采用**（交互增强） |
| rpc | `src/rpc.ts` | 无运行时（契约） | **采用**（跨部件契约） |

`id` 由 server part 的 `Plugin.define({ id: "ddd" })` 声明；tui part 显式声明**相同前缀**（`ddd`），规避一致性裁决。

## 核心思路与协议

- **注册面**（`src/lib/registry.ts`）：命令/技能/代理/工具的**清单**与自检；实际注册由 `src/index.ts` 的 transforms 完成。
- **只读方法面**（RPC）：门禁读数、看板摘要；皆只读，避免把权威事实藏进 `ctx.storage`。
- **门禁判据**（`src/lib/gates.ts`）：纯函数，入参为项目状态快照；区分 `pass/block/visible/na`。
- **路径纪律**（`src/lib/paths.ts`）：随包件取包根、项目件取项目根，二者不混用。

## 目录规划（分组层）

| 分组 | 目录 | 职责 |
|---|---|---|
| 共享纯函数 | `src/lib/` | 注册清单、门禁判据、路径解析；只依赖标准库，可离线自测 |

`src/` 顶层三件（`index.ts`、`tui.tsx`、`rpc.ts`）各自有文件级设计件。

## 依赖方向

- `src/**` 只依赖 `@opencode/plugin`（宿主）与 `src/lib/**`（本模块纯函数层）。
- `src/lib/**` 只依赖 Node 标准库与 URL，**不依赖宿主**（故可离线自测）。
- 禁止 `src/**` 反向依赖 `scripts/**`。

## 承重机制承接

M4（命令改造口）、M5（意图确认）、M6（记忆闭环）、M7（看板闭环）、M8（执行规则闭环）、M11（项目对接规范）、M12（冻结即归并）在本模块有落点；具体文件见文件级设计件。

## 状态

`draft`；分组与文件级落定并评审后转 `frozen`。
