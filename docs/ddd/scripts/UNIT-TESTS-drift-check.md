---
doc: unit-tests
level: file
target: scripts/drift-check.mjs
status: frozen
landed: true
depends: [scripts/DESIGN-drift-check.md]
updated: 2026-11-11
---

# 单元测试设计：scripts/drift-check.mjs

## 执行件与前置

- 执行件：已实现（`scripts/drift-check.mjs`）。
- 前置：`scripts/DESIGN-drift-check.md`、`assets/counterexamples.json`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-drift-check-01 | 复写检出 | 别处复写权威值 → 退出 1 | 已落地 |
| UT-scripts-drift-check-02 | 权威=实物 | `commands.json` ↔ `registry.ts` 一致 | 已落地 |
| UT-scripts-drift-check-03 | 阈值不内置 | 代码内置阈值 → 检出 | 已落地 |
| UT-scripts-drift-check-04 | 反证不沉默 | 反证样本下判据报出（R25） | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。

## 2.0.2 新增回归判据

- 命令名一致但角色、派发方式、描述或阻塞标志漂移时必须失败。
- Agent 角色白名单缺少 `skill` 时必须失败。
- `package.json`、锁文件和最新变更流声明的版本不一致时必须失败。
