# GitHub Actions 工作流 · 操作参考

## 发现与选择

项目已有的 `README`、配置文件和锁文件优先于默认值。命令执行前先确认当前工作目录、目标环境及权限；输出仅作为验证证据，不自动替代 DDD 的设计/测试树。

## 实施检查

1. workflow 使用最小 permissions，第三方 action 固定可信版本。
2. 缓存键与 lockfile/工具版本一致。
3. 私密信息使用 secrets/OIDC，不输出到日志。

## 排错优先级

- pull_request_target 执行不可信 PR 代码
- 把 secrets 写到 artifact 或 echo

1. 检查该项目使用的版本、包管理器和项目级脚本。
2. 最小化复现并记录退出码、关键错误和输入版本。
3. 改动对应的设计与测试，确认现象消失，必要时增加回归用例。

## 官方参考

- https://docs.github.com/en/actions

> 外部官方文档会变化，请以当前项目版本为准；本文件不宣称存在某个不存在的“官方固定修订版”。
