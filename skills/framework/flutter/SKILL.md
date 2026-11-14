---
name: framework-flutter
description: Flutter/Dart Widget、状态、布局与测试；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# Flutter/Dart Widget

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. Widget 组件尽量不可变，状态控制范围最小。
2. 业务模型与 Widget 渲染隔离。
3. 处理屏幕尺寸、无障碍、主题和异步生命周期。

## 常见反例

- BuildContext 跨 await 后使用
- 无界 ListView 或布局溢出

## 可执行验证（先检测是否安装及配置）

- `flutter analyze`
- `flutter test`
- `flutter build（按目标平台）`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
