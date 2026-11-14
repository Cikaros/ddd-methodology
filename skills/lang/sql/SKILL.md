---
name: lang-sql
description: SQL（关系数据库） 语言规范：检测到 SQL（关系数据库） 代码时载入。默认基线 项目 SQL 方言/官方数据库文档；机械取值见 assets/lang-sql.json。
---

# lang-sql（SQL（关系数据库） 语言规范）

## 何时载入

检测到 **SQL（关系数据库）** 源文件（或任务显式涉及该语言）时，由宿主 `skill` 工具按需加载本技能。**不常驻**。

## 基线

- 默认基线：`项目 SQL 方言/官方数据库文档`（上游指南**只引用、不拷入**）。
- 项目可覆盖基线并在 `references/project-overrides.md` 登记理由（避免「基线 vs 项目」两处打架）。

## 注意

Redis 不是 SQL 方言：Redis 操作遵循 `skills/dev-tools/references/database.md`，关系型数据库操作请结合 PostgreSQL / ClickHouse 等对应 Skill。

## 核心约定（判断式，非机械阈值）

- **命名与结构**：遵循基线指南的命名与文件/包组织约定。
- **惯用法**：优先语言惯用写法；不自造与生态冲突的模式。
- **错误处理**：区分可恢复与不可恢复；不吞异常、不空catch。
- **依赖与构建**：关联工具见 `assets/skills-catalog.json`（单点权威） 的 `tools`（构建/包管理/测试/格式化）。

## 导航（按需 read）

- `references/google-style.md`：基线指南的引用与要点导航。
- `references/project-overrides.md`：项目对基线的覆盖及理由。

> **正文不写具体阈值**（缩进/行宽/引号/严格度）——读 `assets/lang-sql.json`；格式化/lint 交宿主。
