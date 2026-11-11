---
doc: design
level: file
target: assets/counterexamples.json
status: frozen
landed: true
covers: [counterexamples]
depends: [scripts/selftest.mjs]
updated: 2026-11-11
---

# 文件设计：assets/counterexamples.json（反证样本集 · R25）

## 定位与边界

- **职责**：**注入式违规样本**的唯一权威——每条机械判据配一件**反证**；判据在反证下**不沉默**才算成立（R25）。
- **边界内**：反证样本数据（`{ id, criterion, inject, expect }`）。
- **边界外**：判据实现（`src/lib/**`、`scripts/**`）；判据编号的散文（概要 §6.3）。

## 对外暴露接口

JSON：`{ "counterexamples": [ { "id", "criterion", "target", "inject", "expectFail" } ] }`

| 字段 | 含义 |
|---|---|
| `id` | 反证编号（`CE-####`） |
| `criterion` | 对应机械判据（如 `UT-src-lib-board-03`、`G5`、`drift-check`） |
| `target` | 被注入的判定对象（文件/对象名） |
| `inject` | 注入形态（缺 `acceptance`、`priority` 越域、别处复写阈值…） |
| `expectFail` | 期望：判据**沉默=失败**（即必须报出违规） |

## 需引入的依赖

无。被 `scripts/selftest.mjs` 读入并逐条注入断言。

## 调用的模块能力及接口

`scripts/selftest.mjs` 遍历本件：对每条反证，构造违规输入喂给对应判据，断言**判据报出**（非沉默）。

## 已知约束

- **单点权威**：反证样本只在此件；判据代码不内置样本。
- **成对报告**：反证集与机械判据集**双向对账**——缺任一侧即失败（R25）。
- 反证只用于**离线自测**（无模型），不进运行期。

## 状态

本件为 `frozen`；与实物（`scripts/`）对账一致。
