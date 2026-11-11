# formatter / linter 使用约定

## 何时跑

- **写后自动**：宿主 `formatter` 在 `write`/`edit`/`patch` 后自动格式化——不重造该层。
- **提交前**：跑一次 lint 与 format check，确保工作区干净。

## 跑什么

- 机械取值（缩进/行宽/引号/尾逗号/严格度）读 `assets/lang-<id>.json`；配置由项目 formatter 消费。
- 规则集与基线来源见 `assets/languages.json` 的 `baseline`。

## 失败如何自纠

- 格式失败：直接重跑 formatter 修正（可机械判定）。
- lint 失败：先读首条规则与位置，再改；多规则冲突以项目配置为准并登记覆盖理由。
- **Linter 即 Prompt**：每条规则失败须能给出**补救指令**。

## 不重造

- lint/格式的机械执行交宿主；本技能只提供约定与 `assets/` 基线。
