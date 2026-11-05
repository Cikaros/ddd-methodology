# docs 目录分层

本目录承载仓库文档，按「读者是谁」分层，各层职责与可见性如下。

## 包级文档

- `README.md`，本文件，docs 目录的索引。
- `COMPATIBILITY.md`，本包与宿主 pi 版本对应关系的单一权威，声明已实测覆盖的版本范围。

## internal/ —— 面向维护者

维护者内部档案层，包含：

- 度量 JSON：`check-coverage.json`、`debt-history.json`、`debts.json`、`health.json`、`metrics.json`
- `refactor-0.8.0/`：本轮改造设计文档树，属设计产出
- `refactor/`：历史重构设计
- `history/`：规范演进史与历史设计与审计归档

该层已由根目录 `.gitignore` 的 `docs/internal/` 条目排除，不随公开仓库发布，仅供本地维护参考。审计归档使用内部档案区，被开发项目使用项目内 `docs/audits/`，两侧不得混用。
