---
name: tool-kubernetes
description: Kubernetes 清单、部署和变更控制；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# Kubernetes 清单

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. 明确 namespace、资源请求/限制、探针及滚动发布。
2. 密钥从 Secret/外部密钥系统注入，不存明文。
3. 生产变更先 dry-run/diff，再执行，留回滚路径。

## 常见反例

- 默认命名空间误操作
- 将 readiness 与 liveness 混为一谈

## 可执行验证（先检测是否安装及配置）

- `kubectl apply --dry-run=client -f <path>`
- `helm lint <chart>`
- `kubectl diff -f <path>（需授权集群）`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
