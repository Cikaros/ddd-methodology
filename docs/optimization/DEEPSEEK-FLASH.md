# DeepSeek V4.1 Flash 使用与调优说明

## 选择模型

在 OpenCode 中选择已有配置的 DeepSeek 提供商及 `deepseek-flash` 模型。模型由宿主选择，本插件不干预密钥或请求地址。DeepSeek 官方在 2026-10-17 更新 V4.1 Flash-1017 时明确说明仍调用 `deepseek-flash`，2026-11-13 新增了应用 API 能力。模型或 API 兼容差异应以官方实时文档为准：<https://api-docs.deepseek.com/updates/>。

## 插件自动行为

- 检测 `ev.model`，必要时参考宿主公开的 `ev.options.model` 或插件只读选项 `model`。
- Flash 插件额外状态上下文默认 950（轻任务）或 1450（实施/测试/评审/修 bug）字符，其他模型约 1800 / 2450 字符；不包含你自己输入、OpenCode 原有系统指令、Skills 全文或工具真实回显。
- 一次 context hook 最多注入一条 `[ddd:runtime]` 状态文本：相位、意图、可恢复派发检查点、切片文件路径、待办概要、经验及损坏证据警报；证据异常优先于一般经验。
- 角色职责仍来自 `agents/<role>.md`，命令按需指示去读技能文件全文，不在每轮大段重复。
- 项目关键文档按阶段、允许路径和小额 Token 估算预算选择证据片段；关联版本改变的记忆会被降权或失效，绝不把文档引用当作程序完成证明。
- 项目文件只当数据引用；必须由实际文件、工具执行和门禁结果决定完成状态，不允许模型通过自述“已完成”伪造门禁。

## 可选设置

若 OpenCode 安装方式支持给本插件传 options，可设置 `contextBudgetChars` 为 300–8000 内整数，覆盖**插件额外上下文**预算。常规情况下建议保持默认，因为缩得太低可能隐藏必要的看板条目，放得太高可能重复消耗模型注意力。

## 推荐的验证节奏

先完成 `/ddd-intent` 和设计冻结，再小批次 `/ddd-implement` → `/ddd-test` → `/ddd-validate`。当有阻塞项、缺陷或变更时，更新相应文件并重新跑门禁；不要把“回答顺畅”视为代码正确性。使用 `node --experimental-strip-types scripts/validate.mjs --root <项目根> --check` 查看无写入门禁读数，发布前加 `--release` 检查所有判据并实际运行匹配项目语言的常规测试（Node/npm、Go、Rust、Python、Maven、Gradle）。

## 安全和兼容性

不自动修改 reasoning、temperature、工具协议或服务商密钥；旧版的工具调用仍由 OpenCode 驱动。原版声明 Node >=20，但 CLI 在本次重构中明确要求 Node >=22.19.0，以支持直接加载现有 TypeScript 源文件。使用前先进行真实宿主联调。

## 2.0.0 真模型评测边界

`node scripts/eval.mjs --baseline before.jsonl --candidate after.jsonl` 只处理同一批任务、同一模型的真实观测记录，不能自行产生模型执行结果。工具失败率、完成时长、token 与验收成功率的变化必须由真实 OpenCode/DeepSeek 会话测得。

## 运行时指标与验收边界（2.0.2）

`src/lib/trace-store.mjs` 仅存储任务 ID 摘要、观察到的模型 ID、工具调用计数、匿名工具 ID 哈希、实际宿主报告的 Token 使用和实际测试验收状态；不保存原始用户提示词或工具输出。宿主未提供的数据字段保持 `null`。导出完整样本的命令见 README 的 `workflow.mjs metrics --export`。

`src/lib/workflow-controller.ts` 只有在 OpenCode 发出执行完成事件后转为待验证，随后由明确的项目测试操作进入 verified。真实 OpenCode 版本是否提供这里依赖的所有执行/用量事件，需要在目标安装环境逐项核对。**当前尚无真实模型 A/B 数据，不宣称加速或准确率提升已经实测成立。**
