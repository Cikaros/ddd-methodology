---
doc: design
level: file
target: scripts/scaffold.mjs
status: frozen
landed: true
covers: [scaffold]
depends: [scripts/materialize.mjs, assets/languages.json]
updated: 2026-11-11
---

# 文件设计：scripts/scaffold.mjs（项目骨架生成器 · F7）

## 定位与边界

- **职责**：`/ddd-init` 的机械承接——在**当前项目根**落**项目级骨架**：根文档三件（`AGENTS.md`/`README.md`/`CONTRIBUTING.md`）、`docs/` 固定位置清单、空图集、机器可读快照；并**物化**随包件（调 `materialize.mjs`）。
- **边界内**：目录与占位件的**幂等**生成。
- **边界外**：内容填充（由后续节点/模型完成）；门禁判定。

## 对外暴露接口

`node scripts/scaffold.mjs [--root <项目根>] [--force]`
退出码：`0` 过（已存在且一致=幂等跳过）；`1` 失败；`2` 用法错。

**落点清单**（对齐概要 §4.2 固定位置，R11）：

| 落点 | 形态 |
|---|---|
| `AGENTS.md` / `README.md` / `CONTRIBUTING.md` | 根文档**三件**（R12 白名单；第四件即违规） |
| `docs/GLOSSARY.md` / `docs/ARCHITECTURE.md` | 单文件（占位，待填） |
| `docs/CHANGELOG.jsonl` / `docs/temp.jsonl` | 追加写（空） |
| `docs/requirements/` / `docs/ddd/` / `docs/reports/` / `docs/audits/` / `docs/maps/` | 目录 |
| `docs/maps.json` | 空 delta `{add:[],override:[],disable:[]}` |
| `docs/reports/design-tree.json` | 由 `snapshot.mjs` 生成 |
| `.opencode/agents/` | 由 `materialize.mjs` 物化 |

## 需引入的依赖

- Node 标准库；`scripts/materialize.mjs`（物化随包件）。

## 调用的模块能力及接口

- 由 `/ddd-init` 调用；`--force` 才覆盖既有件（默认幂等跳过，不静默覆盖）。
- 生成后可选触发 `snapshot.mjs`（机器可读快照）。

## 已知约束（关键）

- **根文档白名单**：只落三件（R12）；已存在第四件文档即报错（不静默）。
- **幂等**：已存在且一致则跳过；不一致默认报差异、需 `--force`（不静默覆盖）。
- **不写业务代码**；只在项目根落骨架与占位。
- 路径取**项目根**；工具自身取**包根**（§8.7）。

## 状态

本件为 `frozen`；与实物（`scripts/`）对账一致。

## 2.0.2 全局集成约束

scaffold 在写入任何项目文档前调用 materialize all --check；--force 显式传递给物化器。
