---
name: lang-android
description: Android (Kotlin/Java) 语言规范：检测到 Android (Kotlin/Java) 代码时载入。默认基线 official:android-style@rev-2024-04-01；机械取值见 assets/lang-android.json。
---

# lang-android（Android (Kotlin/Java) 语言规范）

## 何时载入

检测到 **Android (Kotlin/Java)** 源文件（或任务显式涉及该语言）时，由 router 经 `assets/injection-slices.json` 注入本切片。**不常驻**。

## 基线

- 默认基线：`official:android-style@rev-2024-04-01`（上游指南**只引用、不拷入**）。
- 项目可覆盖基线并在 `references/project-overrides.md` 登记理由（避免「基线 vs 项目」两处打架）。

## 核心约定（判断式，非机械阈值）

- **命名与结构**：遵循基线指南的命名与文件/包组织约定。
- **惯用法**：优先语言惯用写法；不自造与生态冲突的模式。
- **错误处理**：区分可恢复与不可恢复；不吞异常、不空catch。
- **依赖与构建**：关联工具见 `assets/languages.json` 的 `tools`（构建/包管理/测试/格式化）。

## 导航（按需 read）

- `references/google-style.md`：基线指南的引用与要点导航。
- `references/project-overrides.md`：项目对基线的覆盖及理由。

> **正文不写具体阈值**（缩进/行宽/引号/严格度）——读 `assets/lang-android.json`；格式化/lint 交宿主。
