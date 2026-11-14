---
name: lang-kotlin
description: Kotlin 空安全、协程与 JVM/Android 构建；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# Kotlin 空安全

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. 使用可空类型与 sealed 类型明确状态。
2. 协程必须遵守 structured concurrency 与取消传播。
3. JVM/Android 中平台类型需做边界校验。

## 常见反例

- GlobalScope/无主协程泄漏
- suspend 与阻塞 I/O 混用

## 可执行验证（先检测是否安装及配置）

- `./gradlew test（Gradle 项目）`
- `./gradlew lint（存在该任务时）`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
