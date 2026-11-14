---
name: lang-php
description: PHP Composer、类型边界和应用测试；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# PHP Composer

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. 启用 strict_types 和类型声明（在兼容项目约束下）。
2. 所有外部数据进行输入校验与输出编码。
3. 使用参数化查询，避免拼接 SQL。

## 常见反例

- 动态数组结构缺契约
- Composer 依赖与 PHP 运行版本不匹配

## 可执行验证（先检测是否安装及配置）

- `composer validate`
- `composer test（如 scripts 配置）`
- `vendor/bin/phpunit（如安装）`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
