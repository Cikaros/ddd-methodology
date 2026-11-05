---
name: tool-bash
description: 宿主 bash 工具的易错用法与本方法论脚本调用约定，承载命令超时、cd 前缀归一、跨平台差异、外链探测纪律与脚本调用五条。当在 implement、g5-int、test-execute、defect-fix 节点用 bash 跑命令、设置命令超时、跨平台执行、探测外链或调用 skills/ddd-methodology/scripts/ 下脚本时读本技能。
---

# 宿主 bash 易错用法与脚本调用

条款正文在本文件。本技能只收模型易误用或反直觉的条目，通用 shell 用法不收录。

## 何时用

1. 以 bash 执行可能耗时或挂起的命令，需决定是否设命令超时、设多大时。
2. 命令以 `cd … &&` 前缀组合，或需确认该前缀是否影响守卫判定时。
3. 命令需跨平台执行，尤其 Windows 下 Git Bash 的路径形态与命令名差异显现时。
4. 探查外链或远端资源，需决定不可达时如何处置时。
5. 调用 `skills/ddd-methodology/scripts/` 下的机械证据脚本与编排脚本时。

## 做什么

1. 命令超时：网络访问、依赖安装、构建、等待输入一类可能挂起或耗时的命令，须显式设命令超时；短命令保留默认。超时是宿主 bash 工具的命令级参数，不得用 shell 内 `timeout` 命令或后台计时器自造截止，也不得以轮询等待替代，与「卡死防护不自研计时器」一致。
2. `cd … &&` 前缀：守卫判定全量测试形态前先做命令归一，剥掉单层 `cd <目录> && ` 前缀与环境变量赋值，再匹配形态。故该前缀不改变归一后的判定，`cd <目录> && npm test` 与裸命令同判。归一后仍含串联、管道、重定向或命令替换者一律放行，此留白不得当作绕过测试分离纪律的通道。
3. 跨平台差异：以 Windows 下的 Git Bash 为坑位。路径一律用正斜杠、盘符写作 `/c/...`，反斜杠在 bash 中是转义符；含空格路径须加引号。命令名有差异：`which` 对 `where`、`cat` 对 `type`、`rm` 对 `del`、`cp` 对 `copy`、`mv` 对 `move`；`npm`、`pnpm` 一类在 Windows 上由 `.cmd` 包装，跨平台脚本中按需写全称。
4. 外链探测纪律：以 bash 访问外链不可达时，标注待核验并说明未取到证据，不得重试、不得等待、不得以推断代替结论。此条为真实实施教训，沿用探查类节点的外链要求。
5. 脚本调用约定：本方法论脚本位于 `skills/ddd-methodology/scripts/`。机械证据脚本以项目根绝对路径作参数，即 `root` 传被开发项目根的绝对路径。编排脚本以子代理工具的 workflow 参数调用，形如 `subagent({ workflow: "<包根>/skills/ddd-methodology/scripts/ddd-workflow.js", args: { root: "<项目根绝对路径>" } })`，不得直接 `node` 执行：脚本运行于无 `require` 与 `fs` 的沙箱，唯一数据通道是冻结的 `args`。

## 不做什么

1. 不收通用 shell 语法、常用命令与模型已熟知的用法。
2. 不承载守卫的判定实现，那在运行时守卫里定义一处，本条只说明其归一行为。
3. 不承载语言级脚本规范，那些属 `lang-shell` 与 `lang-powershell`。
4. 不定义机械证据脚本的输出形态与退出码语义，那属 ddd-methodology 的机械门禁节。
5. 不以本技能正文替代派发任务文本，关键规则须内联进派发任务。

## 条款与来源对照表

| 本技能条款 | 来源 |
|---|---|
| 第 1 条命令超时与不自研计时器 | DESIGN-scheduling.md 第七节 |
| 第 2 条 cd 前缀与命令归一 | DESIGN-extensions.md 第二节（H-2 守卫） |
| 第 3 条跨平台差异 | DESIGN-skills.md 第六节 |
| 第 4 条外链探测纪律 | DESIGN-scheduling.md 第七节 |
| 第 5 条脚本调用约定 | DESIGN-scheduling.md 第六节；DESIGN-skills.md 第六节 |
| 技能形态与落点 | DESIGN-skills.md 第七、八节；DESIGN-scheduling.md 第五节 |
