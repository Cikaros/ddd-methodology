# docs 目录分层

本目录按「读者是谁」分层，各层职责与可见性如下。

## guide/ —— 面向使用者

面向方法论的**使用者**：白皮书文档（`ddd-methodology-whitepaper.docx` 与 `.pdf`），
用于理解分治式设计驱动开发方法论的整体理念与流程。

## internal/ —— 面向维护者

维护者内部产物层，包含：

- 度量 JSON：`check-coverage.json`、`debt-history.json`、`debts.json`、`health.json`、`metrics.json`
- `refactor/`：重构设计与过程记录
- `history/`：规范演进史与历史设计归档

该层已由根目录 `.gitignore` 的 `docs/internal/` 条目排除，**不随公开仓库发布**，
仅供本地维护参考。
