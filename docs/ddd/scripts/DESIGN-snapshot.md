---
doc: design
level: file
target: scripts/snapshot.mjs
status: frozen
landed: true
covers: [design-tree-snapshot]
depends: [src/lib/registry.ts]
updated: 2026-11-11
---

# 文件设计：scripts/snapshot.mjs（设计树机器可读快照 · M1）

## 定位与边界

- **职责**：把 `docs/ddd/**` 的受控 frontmatter **重放**为**机器可读快照**（同构/覆盖/漂移的判定底座）；快照是**派生件**，禁手改。
- **边界内**：扫描、折叠、写 `docs/reports/design-tree.json`。
- **边界外**：判定门禁（`src/lib/gates.ts`）；设计件内容。

## 对外暴露接口

`node scripts/snapshot.mjs [--root <项目根>] [--check]`
退出码：`0` 过；`1` 失败（快照与设计树不一致，含手改检出）；`2` 用法错。

**快照形态**（`docs/reports/design-tree.json`）：

| 字段 | 含义 |
|---|---|
| `ts` | 生成时间 |
| `designs[]` | `{ path, level, target, status, landed, covers, depends }` |
| `tests[]` | `{ path, target, status, landed, ids }` |
| `counts` | `{ design, test, ids, byLevel }` |
| `gaps` | `{ mismatches[], missingUnitTests[], missingGroupTests[], duplicateTargets[], duplicateIds[] }` |

## 需引入的依赖

- Node 标准库（`node:fs`、`node:path`、`node:url`）。
- 无宿主依赖；不依赖模型。

## 调用的模块能力及接口

- 统一调用 `src/lib/evidence.mjs#scanDesignTree`，不再另写一份 frontmatter、设计树和测试缺口解析器。
- 被 `scripts/validate.mjs`（G3/G4 判据入参）与审计只读消费。

## 已知约束

- **只读设计树、只写报告**；不改权威件。
- **重放一致**：同一设计树恒得同一快照（除 `ts`）；`--check` 检出与既有快照的差异（含手改）。
- 快照落 `docs/reports/`（派生位置，§4.2）；不得把权威事实藏进快照。
- 路径取**项目根**（快照属生成到使用者项目的件），工具自身取包根（§8.7）。

## 状态

本件为 `frozen`；与实物（`scripts/`）对账一致。
