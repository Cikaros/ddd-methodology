---
doc: design
level: file
target: scripts/drift-check.mjs
status: frozen
landed: true
covers: [drift-scan]
depends: [assets/commands.json, src/lib/registry.ts]
updated: 2026-11-11
---

# 文件设计：scripts/drift-check.mjs（反漂移复写扫描 · M10）

## 定位与边界

- **职责**：检**单点权威被复写**——同一事实在权威件之外再写具体值即失败；并核**权威件取值 = 实物**（R13）。
- **边界内**：扫描已知权威对（`assets/commands.json` ↔ `src/lib/registry.ts`；`assets/gates.json` 门禁条数；`assets/languages.json` ↔ `skills/lang/*` 目录；`assets/board.json`/`assets/memory.json` 阈值不得内置于代码）。
- **边界外**：判断式复写（审计）；权威对登记（在 `assets/` 各件声明）。

## 对外暴露接口

`node scripts/drift-check.mjs [--root <项目根>] [--check]`
退出码：`0` 零复写；`1` 检出复写/不一致；`2` 用法错。
报告写 `docs/reports/drift-check.json`：`{ ts, checks: [{ id, authority, mirrors, ok, findings[] }] }`。

## 需引入的依赖

- Node 标准库；只读导入 `src/lib/registry.ts`（比对运行期投影与权威件）。

## 调用的模块能力及接口

- 被 `/ddd-validate`（G3）与审计调用。

## 已知约束

- **只读权威与实物、只写报告**。
- 判据成对（R25）：每条「非复写」机械判据配一件注入式违规样本，须在**反证**下不沉默（样本见 `assets/counterexamples.json`）。
- 阈值只读 `assets/`，代码不得内置（本扫描即检此项）。
- 路径：报告写项目根；工具取包根（§8.7）。

## 状态

本件为 `frozen`；与实物（`scripts/`）对账一致。

## 2.0.2 联动对账增补

- `assets/commands.json` 与 `src/lib/registry.ts` 的命令名、目的、阻塞标志、派发方式及角色应同时对账。
- `assets/agents.json` 中引用的 Agent 应具备 `assets/role-tools.json` 的权限投影；所有受限 Agent 均须能够读取 `skill` 工具，评审角色仍保持只读。
- 插件 `package.json`、锁文件与变更流最新版本记录保持一致。
- 扫描为只读判定，任何不一致返回非零退出状态。
