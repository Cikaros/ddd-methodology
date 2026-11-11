# 影响范围与禁止交叉（spec-impact-scope）

## 每维两字段

- `allowedTokenLayer`：该维允许影响的 token 层级（Primitive／Semantic／Component）。
- `forbiddenCrossEffects`：该维**禁止**交叉影响的范围。

## 组合

- 允许的组合须有**完整映射**（每个合法组合都能推出完整 token 值）。
- 不支持的组合写入 `forbiddenCombinations`，并给 reason。

## token 层级（仅作前端内部知识）

Primitive → Semantic → Component 三层**只是技能内部知识**，**不上升为 ddd 机制**。组件只消费 **Semantic** token；Primitive 变更只经 shell 层。

> 字段结构以 `assets/variant-contract-schema.json` 为准。
