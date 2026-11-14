> **历史文档（2.0.0 阶段）**：本报告对应 2.0.0 阶段的二轮收尾，其“Release Candidate”表述已由后续 v2.0.1 / v2.0.2 迭代取代。**当前发布版本与最新状态以 [2.0.2 发布报告](V2.0.2-INTEGRATION-REPORT.md) 为准。**

# ddd-methodology 2.0.0：既定规划功能补齐与可用性报告

本报告对应在原版 1.0.8 和 2.0.0 初始候选基础上的**第二轮收尾**。不修改 Hermess 的目标：文档为唯一权威；需求/设计/测试树同构；变更流、门禁、看板机械执法。保留 15 个 `/ddd-*` 命令、12 个 Agents、Skills、TUI、RPC。**不是声称已经通过真实 OpenCode / DeepSeek 线上验收的正式版本。**

## 对照之前规划的 8 个方向

| 方向 | 本次实现 | 验证边界 |
|---|---|---|
| Agent 执行闭环 | `workflow-store.mjs` + `workflow-controller.ts`：prepared / dispatched / running / awaiting_verification / verified / failed；实测成功才提供签名指纹 | 宿主实际事件名称必须实机验证 |
| 动态上下文 | `context-service.ts` + `evidence-retrieval.mjs` + `model-policy.ts`：按阶段抽取可读证据，并控制插件自身的预算和内容 | Token 预算为本地估算，不替代宿主 Tokenizer |
| 门禁证据 | 统一证据与 G1–G6 判据；`executable-verifier.mjs` 实测 npm/Go/Rust/Python/Maven/Gradle 脚本，指纹前后核对 | 自定义框架无法自动识别时返回 unverified，不假通过 |
| 真实模型评测 | `trace-store.mjs` 记录宿主可见指标，`workflow.mjs metrics --export` 导出可用观测；`scripts/eval.mjs` 支持成对样本对比 | 不能在无网络/凭据环境制造真实 A/B 结论 |
| 运行时可靠性 | 入口拆分、诊断记录、共享跨进程文件锁、严格 JSONL、只读校验与并发回归 | 事件订阅失效时不能断言会自动恢复，需人工 reconcile |
| 记忆/任务恢复 | 版本与阶段相关记忆筛选，复发与衰减事务化；检查点保存，恢复不自动重跑可能重复执行的命令 | 原始提示词/工具输出不落盘，恢复需要实际工作区和人工核对 |
| 多 Agent 交接 | `agent-handoff.ts` 结构化交接任务目标、可验收条件、证据与分工；关联子 Agent 会话 | 具体的 Agent 独立评审仍由真实宿主保证 |
| 工作流与 TUI/RPC | `workflow` / `workflowVerify` / `workflowClose`，`/ddd-tui-workflow`，CLI 显式验证与失败关闭；原命令保留 | CLI/TUI/RPC 的真正宿主交互尚未联调 |

## 质量守则

- 任何会话 `session.execution.succeeded` 只会进入 `awaiting_verification`，不会直接进入 `verified`。
- `verified` 必须来自实际执行的项目测试，具备通过的退出码和与源码绑定的 SHA-256 指纹。
- 项目不提供可识别测试时为 `unverified`，不通过模型自述补齐。
- 旧看板/记忆 JSONL 损坏时拒绝继续写入，不隐式把坏数据当空。
- 新的状态与指标文件放在 `.ddd/state`，不记录原始用户提示词、工具参数或工具输出。
- 执行记录不能凭推断重放：人工确认执行已结束后才能 reconcile。

## 复验清单

```bash
# 在此插件源代码根目录执行；必须先安装真实依赖
npm ci
npm run check
npm run typecheck
npm test
npm pack --dry-run --json

# 在单独的测试业务项目里：
node --experimental-strip-types <plugin>/scripts/workflow.mjs status --root . --session <sessionID>
node --experimental-strip-types <plugin>/scripts/workflow.mjs verify --root . --session <sessionID> --ack-run-tests
```

离线回归测试分为原版自测 163 项、首轮重构回归 18 项、2.0 回归 15 项、本轮功能补齐 22 项（合计 **218**）。测试的数值须以最后执行日志为准；文档不预先替代测试结果。设计树快照对应补齐模块，所有文件级设计必须有测试设计。

## 与生产可用之间仍存在的外部验收

1. 在联网环境安装官方 `@opencode/plugin`，使用真实 OpenCode 宿主打开 **安装后的包**，验证 server/tui/rpc 注册、会话钩子、事件名称与权限回调。测试替身不代表官方 SDK。
2. 在配置好 DeepSeek Flash 凭据的 OpenCode 中，做同批真实任务 A/B；验证中断恢复、阶段证据检索、失败可见性与 Token 统计是否来自真实宿主。
3. 在一个非测试业务项目里执行 `/ddd-init` → 需求/设计 → 测试 → 验收的完整流程；安装遇到版本/事件兼容问题时需修复后再认定为正式可用。

因此交付状态是：**既定源码重构范围已实现的 Release Candidate；离线验证可确认后续测试结果，真实宿主与模型行为尚未获实证。**
