---
name: tool-github-actions
description: GitHub Actions 工作流、权限与供应链安全；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# GitHub Actions 工作流

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. workflow 使用最小 permissions，第三方 action 固定可信版本。
2. 缓存键与 lockfile/工具版本一致。
3. 私密信息使用 secrets/OIDC，不输出到日志。

## 常见反例

- pull_request_target 执行不可信 PR 代码
- 把 secrets 写到 artifact 或 echo

## 可执行验证（先检测是否安装及配置）

- `actionlint .github/workflows/*.yml（已安装时）`
- `PR 中观察真实 CI job 结果`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
