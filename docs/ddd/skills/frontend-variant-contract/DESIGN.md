---
doc: design
level: group
target: skills/frontend-variant-contract
status: frozen
landed: true
covers: [frontend-variant-contract]
depends: [assets/variant-contract-schema.json]
updated: 2026-11-11
---

# 分组设计：skills/frontend-variant-contract（变体契约奠基 · 第 0 步）

## 目录定位与边界

- **职责**：UI 生成前，把「合法变化空间」枚举穷尽、量化封顶、写入**机器可读契约**；使后续生成被限制在有限设计空间。
- **边界内**：五步流程的**判断式**说明与反模式清单。
- **边界外**：契约的**字段结构**（`assets/variant-contract-schema.json`）；某项目的**取值**（`docs/variant-contract.json`，项目级）。

## 目录规划

| 文件/目录 | 一句话职责 |
|---|---|
| `SKILL.md` | 五步流程（枚举→范围→固化→入口唯一→审计）＋反模式 |
| `references/` | 维度/影响范围/审计细则（分组设计见 `references/DESIGN.md`） |

## 适用与落点

- 适用：场景一（零起）、场景二（首次接 UI）；场景三随反推（标 draft）；**纯原型显式跳过**。
- 挂 `/ddd-arch`；载入由 router 按意图 `frontend` 注入（R62）。

## 与 ddd 的对齐

契约取值 **`docs/variant-contract.json`**（单点权威）；变体段在 **`docs/ARCHITECTURE.md`**（只引用）；`theme-config` 为**派生件**（重放生成）；变体审计＝**项目登记门禁**。详见概要设计 §十八。

## 状态

`draft`。