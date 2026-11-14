---
name: dev-tools
description: 常用开发工具使用规范：git、现代包管理器、构建、质量、测试、CI/CD、容器编排、接口、数据工具与观测。检测到相应工具/任务时载入（不常驻）。
---

# dev-tools（常用开发工具使用规范）

## 何时用

当任务涉及**具体工具操作**——提交/分支、依赖安装、构建、格式化/lint、跑测试、CI、容器、shell、`mysql`/`psql`/`clickhouse-client`/`mongosh`/`redis-cli`——时载入。本技能**不常驻**，由 router 检测到相应工具/任务时注入（R62）。

## 跨工具通用约定

- **提交粒度**：一个逻辑变更一个提交；提交信息写「为什么做/本次不做/怎么算做对」三要素。
- **验证前置**：提交/推送前先跑无模型自测与类型检查；真跑层另计。
- **分支策略**：特性分支短生命周期；破坏性历史改写仅限未推送分支。
- **破坏性命令的处置**：`git push --force`、`rm -rf` 等的形态判断**交宿主内置 shell 扫描器**（fail-closed）；本技能只写**用法与判断**，不复制工具默认值，不作命令黑名单。

## 单工具导航（按需 read）

- `references/git.md`：提交/分支/历史改写约定。
- `references/package-manager.md`：npm/pnpm/yarn/pip/venv/cargo 的锁文件与版本纪律。
- `references/build.md`：javac/maven/gradle、gcc/g++/make、nasm、android gradle/adb。
- `references/formatter-linter.md`：何时跑、跑什么、失败如何自纠（对接宿主 `formatter`）。
- `references/testing.md`：vitest/jest/pytest/junit 用法与失败定位。
- `references/database.md`：`mysql` 客户端与 `redis-cli` 的只读/危险操作边界。
- `references/shell.md`：sh/zsh/bash/pwsh 的用法边界。
- `references/ci.md`：流水线约定与门禁接线。
- `references/containers.md`：容器、Kubernetes 与基础设施安全。
- `references/observability.md`：API 调试、可观测性与 CLI 工具。
- `references/messaging.md`：消息队列、契约和配置语法。

> 机械取值（缩进/行宽/引号）不在此技能，落 `assets/lang-<id>.json`；格式化/lint 的机械执行交宿主。
