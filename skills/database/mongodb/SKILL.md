---
name: database-mongodb
description: MongoDB 文档建模、索引与安全更新；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# MongoDB 文档建模

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. 按读写访问路径决定嵌入还是引用。
2. 更新操作带过滤条件并检查 matchedCount/modifiedCount。
3. 对集合索引、聚合管线和 schema 校验设置可观测验证。

## 常见反例

- 无过滤 updateMany/deleteMany
- 跨文档事务滥用或缺索引

## 可执行验证（先检测是否安装及配置）

- `mongosh --eval（优先只读 explain）`
- `运行项目 MongoDB 集成测试`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
