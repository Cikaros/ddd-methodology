> 历史文档：记录 2.0.0 初始候选的重构进展（196 项测试）。功能补齐与最终验证请以 [2.0 RC 补齐报告](V2-COMPLETION-REPORT.md) 为准。

# Hermess / ddd-methodology 2.0.0 重构与验证报告

- **日期**：2026-11-14
- **输入**：上传的完整 `ddd-methodology.7z`，原始工程版本 `1.0.8`；在上一轮 `ddd-methodology-optimized` 的统一证据重构基础上继续实施。
- **版本**：`@cikaros/ddd-methodology@2.0.0`（本地候选，未声称已经发布到 npm / GitHub）
- **不可改变的目标**：文档为唯一权威、设计树/测试树/变更流同构对账、持久看板、G1–G6 门禁；保留 15 个 ddd 命令、12 个代理、原 Skills、TUI/RPC、输入/验收流程。

## 1. 从纵向大入口改为职责分层

```
src/index.ts                   OpenCode server 插件声明（极薄入口）
  └─ src/runtime.ts            SDK 组装 / 注册 / cleanup
      ├─ lib/command-dispatcher.ts  权限确认、角色约束、同会话/隔离派发
      │   └─ lib/workflow-store.mjs 持久派发凭证（只证明已向宿主派发）
      ├─ lib/context-service.ts    项目证据/角色工具裁剪/Flash 上下文
      │   └─ lib/model-policy.ts    阶段预算 / 数据消毒 / 缓存友好前缀
      ├─ lib/gate-evaluator.ts     CLI / RPC 共用判据（G1–G6）
      │   └─ lib/evidence.mjs       实物证据采集（不信任旧报告）
      │       └─ lib/board-store.mjs / lib/jsonl.mjs
      ├─ lib/diagnostics.ts        可见、脱敏、限长诊断
      └─ rpc.ts / lib/intent-store.mjs  RPC 及四问草稿持久化
scripts/board.mjs              唯一写入器（锁内读-验-写-重放）
scripts/validate.mjs           机械门禁 + 显式发布可执行验证
scripts/eval.mjs               成对真实模型追踪数据聚合（不产生模拟模型结论）
```

原 `src/index.ts` 超过 500 行，包含多种不相关职责；现缩为 4 行的 OpenCode 声明，按模块边界通过 `src/runtime.ts` 组装。避免把角色名单、业务判据和上下文字符串都塞回插件入口。

## 2. 关键缺陷及修复原则

| 旧缺陷/风险 | 2.0 做法 | 反例 |
|---|---|---|
| 看板 `archive` 可对不存在的任务写事件 | 全量历史验证，目标必须存在且已 done/dropped | 空看板直接 archive → 失败 |
| `replay --check` 先重写视图导致伪通过 | `--check` 只读比较，明确报差异 | 人工篡改 BOARD.md，检查返回非零且不覆盖 |
| 多进程追加 JSONL 丢更新/重复 seq | 进程级独占锁，锁内读-验证-追加-重放；视图原子改名 | 7 个并行 add 产生 7 个不同 seq |
| CLI / RPC 各自采集 G1–G6，错误被误塞进 G6 | `evaluateProject()` 单一路径，将诊断按 G1–G6 归位 | 缺裁决章节只影响 G1 错误归属 |
| 命令派发中途丢失会话恢复依据 | 哈希会话文件 + prepared/dispatched/failed 事件 | 再次命令读到上次状态，明确无完成证明 |
| 隔离 prompt 已发送但凭证落盘失败可能重复回退 | 将子会话创建失败与 prompt 失败拆开，发送仅一次 | 成功隔离时无父会话重复发送 |
| 模型请求附加状态在每轮固定大段注入 | 阶段感知预算、去重切片路径、证据异常优先、固定首行 | Flash 上限/异常优先/前缀稳定测试 |
| G5 文件非空被误等同代码正确 | `--release` 强制执行 npm test（以及存在的类型检查/lint），验证期间比对源码指纹 | 没测试/unverified、测试失败、验证修改代码全部失败 |
| TUI 四问填写后未落盘 | `intentCapture` RPC 服务端校验和原子草稿保存 | 不会未经用户确认就冻结 REQUIREMENTS |
| 大量非关键 hook 静默 catch | 有限诊断汇聚、去重、脱敏、限长日志；权限异常仍 ask | error 去重、敏感词遮蔽 |

## 3. DeepSeek V4.1 Flash 适配

- 官方模型：`deepseek-flash`，V4.1 Flash-1017 仍沿用该 API 名称。参考 DeepSeek 官方更新日志 <https://api-docs.deepseek.com/updates/>（核对日期 2026-11-14）。
- 仅在宿主 `context` / ddd 命令内部生效，不修改模型提供商、密钥、temperature、reasoning mode、tool_choice 或网络格式。
- `contextBudget(ref, override, phase, intent)`：Flash 在意图/文档等轻任务默认约 **950 字符**，implement/test/review/validate/bugfix 默认约 **1450 字符**；其他模型约 1800 / 2450 字符。这些都是插件**额外上下文上限**，不等价于模型完整上下文，更不是精确 tokenizer 读数。用户仍可用 `contextBudgetChars=300..8000` 显式覆盖。
- 始终先提供证据异常、再给可恢复派发状态、阅读切片路径、在办看板和已验证经验。项目文档只作为数据，不能提升指令优先级。
- 使用稳定的 `[ddd:runtime]` 首行降低重复变化前缀的机会；缓存命中收益是待测假设，不是已测结果。

## 4. 发布门禁语义

`validate.mjs --check`：只收集/计算 G1–G6，不写报告或运行用户的 npm 脚本。默认 `validate.mjs` 沿用“block=0 可以继续工作，na 不算 pass”。

`validate.mjs --release`：首先要求 G1–G6 全为 pass；其次执行项目 `npm run test`，以及存在的 `typecheck`、`lint`。报告记录退出码与源码指纹；没有 npm test、命令失败、或验证过程中源码指纹变化，发布准备状态必须 false。真实脚本属于用户项目，**只在显式指定 `--release` 时执行**。对于非 Node 项目，当前版本不会自动运行 Maven/Gradle/Go 等工具链；须增加经项目确认的可执行适配后才能完成发布判定，不应绕过验证。

## 5. 验证及归属

- **163/163**：保留的原版 `scripts/selftest.mjs` 模拟宿主注册/命令/角色/Assets/工具链断言。
- **18/18**：上一轮重构 `tests/refactor.test.mjs` 的真实文件证据反例。
- **15/15**：2.0 新增 `tests/v2.test.mjs` 的看板事务、检查点、真正运行 npm test、RPC 草稿和上下文边界。
- **合计 196/196** 离线测试通过（用 `npm test` 一次复验）。
- `npm run typecheck`：**通过**，但本机无官方 OpenCode SDK 类型包，使用上次保留的本地临时 SDK 类型替身；该替身不打入 ZIP，**不能据此声明真实 SDK 类型兼容**。
- `npm run check`：设计树 **82/82**、覆盖缺口 0；地图、变更流、缺陷登记册、反漂移校验通过。
- 本仓 `validate --check` 的 G2/G6 仍为 na（插件仓本身不是一个冻结待发布的用户工程），不应声称本仓已达到发布门禁全 pass。
- 模型实测：本次未获取用户的 OpenCode 运行环境或 DeepSeek API 密钥；**未进行真实 DeepSeek 调用与 A/B 任务评测**。提供 `scripts/eval.mjs` 供导入同批任务的真实结果，不能用离线断言代替模型效果。

## 6. 剩余风险 / 未完成项

1. OpenCode 2.x SDK 在用户实际安装版本的类型、RPC/TUI 以及插件装卸生命周期尚需实机验证。部分 experimental API 可能与 mock 存在差异。
2. 多 Agent 独立评审由 OpenCode 宿主隔离子会话保证；本插件的模拟测试不是远端模型真的完成评审的证明。
3. 测试树“机械覆盖”无法证明真实业务语义正确；编译和测试运行只在发布模式执行，仍需人工验收。
4. `scripts/eval.mjs` 不自动调用模型，仅对相同 taskId、模型的真实验收观测做聚合；需采集真任务执行数据才能判断准确度和流畅度。
5. 附加状态字符预算不是官方 tokenizer；不能推导真实 token 成本或缓存收益。
6. 旧 1.x 看板如果由手工写入、不具备合法单调 seq、或存在无效 archive，2.0 会拒绝写入；应先留备份并人工审查历史，不自动修复或删除旧事件。

## 7. 运行命令

```bash
npm run regen
npm run check
npm run typecheck
npm test
node --experimental-strip-types scripts/validate.mjs --root . --check
node --experimental-strip-types scripts/eval.mjs --baseline before.jsonl --candidate after.jsonl
```

ZIP 保留完整源码、Agents、Skills、Assets 和历史文档；不包含本地 `node_modules`、密钥、检查点或构建缓存。
