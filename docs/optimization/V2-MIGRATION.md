# 从 1.0.8 / 1.x / 2.0.0 初始候选迁移到 2.0.0 RC

> **历史文档（2.0.0 阶段）**：迁移到最新版的步骤请见 [2.0.2 迁移指南](V2.0.2-MIGRATION.md)；本件保留 2.0.0 阶段的迁移说明。

1. **先备份**业务项目的 `docs/board/board.jsonl`、`docs/CHANGELOG.jsonl`、`docs/REQUIREMENTS.md` 与 `opencode.jsonc`。不要用插件源码覆盖业务项目。
2. **最低环境**：Node.js **>=22.19.0**。联网环境执行 `npm ci` 安装真实 `@opencode/plugin`，安装后运行 `npm run check && npm run typecheck && npm test`。本交付包不含本地模拟 SDK。
3. **不变接口**：15 个 `/ddd-*` 命令、12 个 Agents、Skills、`./tui`、`./rpc` 保持，沿用 `options.profile`、`powershellUtf8`、`contextBudgetChars`。
4. **看板事件更严格**：历史 JSONL 的坏行、倒序、非法状态转换会拒绝继续操作；`replay --check` 不写入文件。先备份并审查历史，不要静默修复。
5. **可恢复工作流**：派发状态保存在 `.ddd/state/workflows/`；模型/工具指标存在 `.ddd/state/traces/`，四问草稿存在 `.ddd/state/intent-draft.json`。建议 `.gitignore` 忽略 `.ddd/state/`。只有用户显式确认时才运行 `scripts/workflow.mjs verify`，实际测试成功才标记 `verified`。
6. **恢复原则**：重连后先 `workflow.mjs status --session ID`，不要无条件重放可能已执行的模型命令。确知宿主执行完成、但事件丢失时用 `reconcile --ack-execution` 转入待验证；无法证实时用 `close --ack-close --reason ...` 关闭。
7. **发布门禁**：`validate.mjs --release` 除 G1–G6 外，还要求 Node/npm、Go、Rust、Python、Maven 或 Gradle 能识别的实际测试通过，且源码指纹稳定。没有可识别测试时返回 `unverified`。测试可执行项目自定义脚本，先审查项目脚本。
8. **DeepSeek Flash**：保留宿主对供应商、密钥和模型的选择；上下文按阶段抽取允许的项目证据，版本不匹配记忆不会作为确定依据。实际 Token 使用量必须由宿主事件提供；不完整数据不能生成 A/B 样本。
9. **真实环境验收**：用真实 SDK 和 OpenCode 检查装载、`/ddd-init`、`/ddd-intent`、`/ddd-review`、`/ddd-board`、`/ddd-validate`、TUI、RPC、事件触发；再用相同任务对比 DeepSeek Flash。当前离线环境无法安装官方 SDK 或调用真实 DeepSeek，因此该项仍需用户实际环境验证。

完整内容见 [2.0 功能补齐报告](V2-COMPLETION-REPORT.md)。
