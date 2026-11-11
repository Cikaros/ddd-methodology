---
doc: unit-tests
level: file
target: assets/counterexamples.json
status: frozen
landed: true
depends: [assets/DESIGN-counterexamples.md]
updated: 2026-11-11
---

# 单元测试设计：assets/counterexamples.json

## 执行件与前置

- 执行件：已实现（反证样本的校验与消费）。
- 前置：`assets/DESIGN-counterexamples.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-assets-counterexamples-01 | schema 合法 | JSON 可解析，键集齐全（id/criterion/target/inject/expectFail） | 已落地 |
| UT-assets-counterexamples-02 | 成对报告 | 反证集与机械判据集双向对账，缺任一侧即失败（R25） | 已落地 |
| UT-assets-counterexamples-03 | 判据不沉默 | 每条反证注入后，对应判据报出违规 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
