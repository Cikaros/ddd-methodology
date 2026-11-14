# 数据库操作与迁移

SQL 与 Redis 分离：MySQL / PostgreSQL / SQLite / ClickHouse 使用各自方言、客户端与事务模型；MongoDB 是文档数据库；Redis 是键值存储，不属于 SQL。常见客户端包括 mysql、psql、sqlite3、clickhouse-client、mongosh、redis-cli；图形客户端如 DBeaver 不能替代审计记录。迁移工具 Flyway、Liquibase、Alembic、Prisma Migrate、Drizzle Kit 按项目选用。

生产环境 DDL、TRUNCATE、DELETE、DROP、ALTER 前确认目标环境、权限、备份、回滚和影响范围；无 WHERE 的更新或删除应显式预警，未经授权不执行。ClickHouse 分布式/复制结构必须先确认拓扑和表引擎。数据库迁移测试使用独立测试库并保留 count/checksum 结果。

- 参考 https://www.postgresql.org/docs/ ; https://clickhouse.com/docs/ ; https://www.mongodb.com/docs/ ; https://redis.io/docs/latest/ ; https://documentation.red-gate.com/fd/
