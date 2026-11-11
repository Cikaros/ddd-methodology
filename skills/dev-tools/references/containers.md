# 容器使用约定

## 用法边界

- 构建：`docker build -t <tag> .`；运行：`docker run --rm -it <tag>`。
- 组合：`docker compose up -d` / `down`；状态 `docker compose ps`、日志 `logs -f`。
- 清理：`docker system prune` 属破坏性动作，走守卫层。

## 纪律

- 镜像与产物是**派生件**，不入版本控制的权威件。
- 挂载宿主目录时用仓库相对或显式路径，不把宿主绝对路径写进受控件（R15）。
- 容器内跑测试须与本地同构，避免「本地过、CI 挂」。
