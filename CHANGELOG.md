# 变更记录

本文件记录 pi package 形态的版本变更，版本号与仓库根 `package.json` 的 `version` 对应，采用三段式语义化版本；本包经 `pi install` 安装，例如 `pi install git:github.com/Cikaros/ddd-methodology@v0.1.0`。方法论规范版本 v1.0 至 v2.21 的演进史已归档至 `docs/internal/history/spec-changelog.md`，属内部档案，不作为公开内容。

## 0.1.1（2026-11-03）

- **安装文档**：README 安装段落补充网络提示，说明 pi 经 HTTPS clone `github.com`，通道不通时可改用 SSH 重写地址。

## 0.1.0（2026-11-03）

- **pi package 形态**：仓库根 `package.json` 声明 `pi.extensions`、`pi.skills` 与 `pi-subagents.agents`，可经 `pi install` 安装。
- **许可**：新增 `LICENSE`，MIT 协议。
- **文档分层**：`docs/` 按读者分层为 `guide`、`reference`、`internal`，内部产物不再随公开仓发布。
- **版本体系**：切换为包语义化版本，历史规范版本 tag 全部废弃，从 `v0.1.0` 重新起步。
- **跟进调整**：文档与校验脚本随 pi package 形态同步调整。
