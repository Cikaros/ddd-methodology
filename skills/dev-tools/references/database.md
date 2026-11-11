# 数据库客户端使用约定

## mysql

- 只读探查优先：`mysql -e "SELECT ..."`；结构用 `SHOW CREATE TABLE` / `information_schema`。
- **危险操作**（`DROP`/`TRUNCATE`/无 `WHERE` 的 `UPDATE`/`DELETE`、`ALTER` 大表）走守卫层，须显式确认。
- 生产库凭据不入版本控制；连接串勿写入受控件。

## redis-cli

- 只读：`GET`/`KEYS`（大库慎用 `KEYS`，用 `SCAN`）/`INFO`/`TTL`。
- **危险操作**（`FLUSHALL`/`FLUSHDB`/`DEL` 大批量/`CONFIG SET`）走守卫层。

## 通用

- 「零影响行」与「无判定对象」是两个读数，不得混同。
- 不在权威件里写连接串或宿主绝对路径（R15）。
