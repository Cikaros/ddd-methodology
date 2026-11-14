---
name: tool-playwright
description: Playwright E2E、稳定定位与 CI 测试；仅在项目文件、依赖或用户任务匹配时按需加载。
---

# Playwright E2E

## 使用边界

此 Skill 是 **DDD 文档/验收流程中的技术参考**，不是新的门禁；项目明确的配置、框架版本和冻结设计优先。先检查仓库文件和锁文件，再选择命令。未验证的工具结果不得当成通过。若任务与本技术无关，不加载。

## 实施约束

1. 以 role/label/testid 做稳定 locator，避免依赖脆弱 DOM 层级。
2. 隔离测试数据并明确清理策略。
3. 失败保存 trace/screenshot 以便复现。

## 常见反例

- 使用硬 sleep 代替等待可观察状态
- 测试并行共享账号造成冲突

## 可执行验证（先检测是否安装及配置）

- `npx playwright test`
- `npx playwright show-report`

不要在没有依赖、配置或授权时假定命令成功；失败时保存 stderr、退出码和关联源码版本供 G5/G6 核验。

## 按需参考

- `references/operational.md`：适用情境、故障排查与外部文档。
