---
doc: design
level: group
target: skills/dev-tools/references
status: draft
landed: false
covers: [dev-tools-references]
updated: 2026-11-11
---

# 分组设计：skills/dev-tools/references

## 目录定位与边界

- **职责**：单工具的使用约定（按需加载）。
- **边界内**：git、包管理器、formatter/linter、测试运行器、CI、容器、shell。
- **边界外**：工具安装与机械默认值。

## 目录规划

| 文件 | 一句话职责 |
|---|---|
| `git.md` | 提交/分支/历史改写约定（破坏性操作指向守卫层） |
| `package-manager.md` | npm/pnpm/yarn/pip/venv/cargo 等的锁文件与版本纪律 |
| `build.md` | 构建链路：javac/maven/gradle、gcc/g++/make、nasm、android gradle/adb |
| `formatter-linter.md` | 何时跑、跑什么、失败如何自纠（对接宿主 `formatter`） |
| `testing.md` | 各语言测试运行器（vitest/jest/pytest/junit）用法与失败定位 |
| `database.md` | `mysql` 客户端与 `redis-cli` 的只读/危险操作边界 |
| `shell.md` | sh/zsh/bash/pwsh 的用法边界（破坏性命令交宿主扫描器） |
| `ci.md` | 流水线约定与门禁接线 |
| `containers.md` | 容器使用边界 |

## 依赖方向

只引用术语表与 `assets/languages.json` 的 `tools` 关联；不复制工具手册全文。

## 状态

`draft`。