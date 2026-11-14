---
name: framework-spring-boot
description: Spring Boot、事务、接口与集成测试；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# Spring Boot

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. Controller/Service/Repository 分层明确，DTO 与持久层实体分离。
2. 事务范围及回滚规则显式定义，避免长事务。
3. 配置以环境隔离，敏感值不提交；验证鉴权和数据边界。

## 常见反例

- 自调用导致 @Transactional 未生效
- JPA N+1、懒加载和分页问题

## 可执行验证（先检测是否安装及配置）

- `./mvnw test 或 mvn test`
- `./gradlew test（以项目为准）`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
