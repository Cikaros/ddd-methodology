---
name: lang-javascript
description: JavaScript 语言规范：检测到 JavaScript 代码时载入。参考上游风格与项目配置；机械取值见 assets/lang-javascript.json。
---

# lang-javascript（JavaScript 语言规范）

## 何时载入

检测到 **JavaScript** 源文件（或任务显式涉及该语言）时，由宿主 `skill` 工具按需加载本技能。**不常驻**。

## 基线

- 参考上游风格指南（以项目实际版本为准）。
- 项目可覆盖基线并在 `references/project-overrides.md` 登记理由（避免「基线 vs 项目」两处打架）。

## 核心约定（判断式，非机械阈值）

- **命名与结构**：遵循基线指南的命名与文件/包组织约定。
- **惯用法**：优先语言惯用写法；不自造与生态冲突的模式。
- **错误处理**：区分可恢复与不可恢复；不吞异常、不空catch。
- **依赖与构建**：关联工具见 `assets/skills-catalog.json`（单点权威） 的 `tools`（构建/包管理/测试/格式化）。

## 导航（按需 read）

- `references/google-style.md`：基线指南的引用与要点导航。
- `references/project-overrides.md`：项目对基线的覆盖及理由。

> **正文不写具体阈值**（缩进/行宽/引号/严格度）——读 `assets/lang-javascript.json`；格式化/lint 交宿主。
