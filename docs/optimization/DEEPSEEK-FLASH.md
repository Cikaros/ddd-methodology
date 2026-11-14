# DeepSeek V4.1 Flash 使用与调优说明

## 选择模型

在 OpenCode 中选择已有配置的 DeepSeek 提供商及 `deepseek-flash` 模型。模型由宿主选择，本插件不干预密钥或请求地址。DeepSeek 官方在 2026-10-17 更新 V4.1 Flash-1017 时明确说明仍调用 `deepseek-flash`，2026-11-13 新增了应用 API 能力。模型或 API 兼容差异应以官方实时文档为准：<https://api-docs.deepseek.com/updates/>。

## 插件自动行为

- 检测 `ev.model`，必要时参考宿主公开的 `ev.options.model` 或插件只读选项 `model`。
- Flash 默认**插件额外状态上下文** 1000 字符，其他模型 1700 字符；不包含你自己输入、OpenCode 原有系统指令、Skills 全文或工具真实回显。
- 一次 context hook 最多注入一条 `[ddd:runtime]` 状态文本：相位、意图、切片文件路径、待办概要、经验及损坏证据警报。
- 角色职责仍来自 `agents/<role>.md`，命令按需指示去读技能文件全文，不在每轮大段重复。
- 项目文件只当数据引用；必须由实际文件、工具执行和门禁结果决定完成状态，不允许模型通过自述“已完成”伪造门禁。

## 可选设置

若 OpenCode 安装方式支持给本插件传 options，可设置 `contextBudgetChars` 为 300–8000 内整数，覆盖**插件额外上下文**预算。常规情况下建议保持默认，因为缩得太低可能隐藏必要的看板条目，放得太高可能重复消耗模型注意力。

## 推荐的验证节奏

先完成 `/ddd-intent` 和设计冻结，再小批次 `/ddd-implement` → `/ddd-test` → `/ddd-validate`。当有阻塞项、缺陷或变更时，更新相应文件并重新跑门禁；不要把“回答顺畅”视为代码正确性。使用 `node --experimental-strip-types scripts/validate.mjs --root <项目根> --check` 查看无写入门禁读数，发布前加 `--release` 检查所有判据。

## 安全和兼容性

不自动修改 reasoning、temperature、工具协议或服务商密钥；旧版的工具调用仍由 OpenCode 驱动。原版声明 Node >=20，但 CLI 在本次重构中明确要求 Node >=22.16，以支持直接加载现有 TypeScript 源文件。使用前先进行真实宿主联调。
