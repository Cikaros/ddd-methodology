---
name: lang-csharp
description: C# / .NET 异步、空安全和单元测试；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# C# / .NET 异步

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. 启用 nullable reference types 并处理 null 警告。
2. I/O 异步 API 正确传播 CancellationToken。
3. 依赖注入边界清晰，避免静态共享可变状态。

## 常见反例

- async void 无法观测异常
- ORM N+1 查询与同步阻塞

## 可执行验证（先检测是否安装及配置）

- `dotnet build`
- `dotnet test`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
