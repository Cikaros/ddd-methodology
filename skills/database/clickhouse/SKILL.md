---
name: database-clickhouse
description: ClickHouse MergeTree、分区、复制和导入；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# ClickHouse MergeTree

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. 先确认 local/Distributed 表、分片和复制拓扑再执行变更。
2. 写入与分区设计遵循 MergeTree 排序键和分区裁剪。
3. 大批量迁移分批校验数量、校验和及重复插入策略。

## 常见反例

- ON CLUSTER 权限不足时擅自推断所有节点一致
- TRUNCATE/DROP 等破坏性操作未经确认

## 可执行验证（先检测是否安装及配置）

- `clickhouse-client --query "SELECT version()"`
- `在测试库执行 EXPLAIN 与可回滚迁移`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
