# 基于原版源码的重构评估与交付报告

> 基线：用户上传的 `ddd-methodology.7z`，`@cikaros/ddd-methodology@1.0.8`。
> 范围：原版完整源码（不是上次的独立替代候选版）。
> 状态：**已作为 v1.0.9 发布**；仍**未**在真实 OpenCode 服务 + DeepSeek API 上执行端到端联调。

## 1. 目标与不变项

不变：Hermess 2.0 方法论，文档唯一权威、三类入口、四级设计树/测试树、变更流、持久看板、记忆、六道门禁、TUI/RPC、15 个 `ddd-*` 命令、Agent/Skill 资产、原版配置文件。无自动改选模型、无劫持 OpenCode 推理协议。

核心变化不是为老代码叠加代理/规则，而是**改掉旧数据读取入口和判定来源**：

- `assets/commands.json` → `src/lib/registry.ts` → server 命令注册/角色/确认/派发。原先 `COMMAND_ROLE` 维护了与资产独立的第二份对应关系。
- 原设计树解析重复位于 `scripts/snapshot.mjs`、旧验证器：现在统一调用 `src/lib/evidence.mjs#scanDesignTree`，快照是派生件而非门禁可信来源。
- `scripts/validate.mjs` 与 RPC `gates` 统一从 `collectProjectEvidence` 读取实际文件，复用 `src/lib/gates.ts` 判定；不再把 `0`、`true` 当作占位成功。
- 原 `project(rows)` 是“可执行任务”投影，不能用于 G6 清空；新增 `projectAll(rows)` 用于完整未归档任务统计，保留原 `project` 行为供 UI。
- 由一次请求多条无上限上下文插入改成单条 `composeContext` 预算内状态，区分 Flash / 默认预算。

## 2. 已证实的原版缺陷与处理

| 原版风险 | 处理 | 验证 |
|---|---|---|
| G1 未决裁决硬编码 0 | 从需求文件裁决章节解析；节缺失时报证据错误 | 缺节/有未决反例 |
| G2 只按标题存在判断，易由空章节假通过 | 章节内容必须非占位、足量 | 空章节反例 |
| G3 同构失败/注册表失败硬编码 0 | 校验设计文档位置/目标/状态、目标是否存在、重复目标、命令实物差异 | 缺文件、越界、注册表漂移反例 |
| G4 与项目真实测试树脱节 | 文件级/分组级文档匹配、用例 ID 重复检查 | 缺用例反例 |
| G5 `schemaValid/whitelisted` 写死 true | 根据声明的 landed、真实文件大小、格式、语法和路径校验；未落地不得算 pass | 未落地、符号链接、无效格式反例 |
| G6 版本只读 2 处却要求 3 处 | 三处均从源文件读取（package/change/opencode pin） | 缺失钉版反例 |
| G6 看板过滤依赖导致漏算 | 统计全部未归档 task（含 blocked、done） | blocked 前驱反例 |
| JSONL 损坏被吞成“空记录” | `readJsonlStrict` 明确行号、长度和对象契约 | 损坏数据反例 |
| CLI `node` 直接加载 `.ts` 在 Node22.16 报错 | `npm` scripts 与嵌套测试加 `--experimental-strip-types` | 真实执行 npm test/check |
| 重复角色映射、提示注入 | 统一命令元数据，切片按引用注入，工具/附件由宿主维持 | 既有命令自测、预算测试 |
| RPC 看板读取错误返回空投影 | 抛出读取错误，由调用端显示 RPC 不可用 | 静态审查 + 既有 RPC 自测 |

## 3. DeepSeek V4.1 Flash 适配

- 正式 API 标识是 `deepseek-flash`；`DeepSeek-V4.1-Flash-1017` 沿用调用方式。参考 <https://api-docs.deepseek.com/updates/>（查验日期 2026-11-14）。
- `src/lib/model-policy.ts`: 识别宿主 `providerID/id`（含有 provider 别名、历史兼容名称），Flash 的插件**额外上下文**默认上限 1000 字符，其他模型 1700；`contextBudgetChars` 可设置为 300–8000 的整数。
- 优先保留**证据错误**，再分配切片位置、看板和经验摘要；将项目文件内容当作数据而非高权限指令。最大长度由模块统一控制，不修改用户输入正文。
- 命令提示以“阶段/角色 → 阅读路径 → 角色边界 → 用户要求（作为数据） → 执行前自检”组织，降低重复与最后一段指令遗失风险。
- 不覆盖 temperature、top_p、reasoning、tool_choice、model 名称或底层工具调用负载；避免为特定供应商制造新协议兼容故障。
- **准确度和流畅度改善属于设计目标，不是已验证性能结论**。尚无 API 基准任务的成功率/时延对照。

## 4. 完整性与兼容性

- 基于原始归档逐文件复制后重构；未移除原版 TUI、RPC、12 个 Agent、Skills、资产、scripts 和历史文档。
- 命令名称不变，`@cikaros/ddd-methodology` 包名不变；版本升为 `1.0.9`（原版基线 `1.0.8`），已同步三处版本声明（`package.json` / 变更流 / 使用者钉版）。此版本尚未通过真实宿主联调，发布它**不等于**已验证性能或行为增益。
- CLI 所需 Node 升至 **22.16+**（原版 `engines` 写 >=20 但核心 CLI 直接加载 TS 在 Node20/22 的普通运行方式并不可用）。OpenCode 内部的 TS 加载机制仍由宿主处理。
- 插件 options 新增可选 `contextBudgetChars`，未传时保持自动预算；`powershellUtf8`、`profile` 等原配置入口保留。
- `scripts/validate.mjs --check` 不写报告；`--release` 需要 G1–G6 全部 pass 且无证据错误。默认模式沿用“无 block 可推进”，所以 `na` 仍不算 pass。

## 5. 实际执行的验证

命令（在项目根）：

```bash
npm run snapshot
node --experimental-strip-types scripts/map.mjs replay .
npm run check
npm run typecheck
npm test
node --experimental-strip-types scripts/validate.mjs --root . --check
```

- 原版离线自测：**163/163 PASS**。
- 新增反例：**18/18 PASS**。
- 类型检查：**tsc --noEmit 通过**。此环境离线无官方 `@opencode/plugin@2.2.7` 安装，类型检查临时使用本地 SDK 类型 mock；该 mock 位于被忽略的 `node_modules`，**不包含在交付 ZIP 内**，不等价于真实 SDK 类型兼容验证。
- `npm run check`：设计快照 / 图集 / 变更流 / 缺陷登记 / 反漂移 **全部通过**。
- 本仓 G1/G3/G4/G5 为 pass，G2/G6 为 na，因为本仓没有用于展示本项目发布操作的完整架构和用户级活跃看板（`na ≠ pass`）。

## 6. 已知边界与后续真实联调

1. 不具备真实 OpenCode 宿主可用性测试条件，尚无法证明 TUI 的 RPC 交互、隔离子会话和所有宿主生命周期钩子在指定版本上完全正常。
2. G3/G5 的机器对账侧重文件结构、明确声明、格式和路径，**不能只靠静态扫描证明接口业务语义正确**；代码导出与文档逐项的 R20 深层语义对账仍需真实编译器/测试及人工审查，不能把 `G3 pass` 解读为形式化验证。
3. G5 对未知格式采取拒绝自动通过；新语言需将其受支持的具体文件格式纳入受控校验策略，并给出对应验收检查。
4. `npm install` 后应在真实官方 SDK 类型下再次跑 `npm run typecheck` 和全部测试；再在 OpenCode 里分别验证 Flash/非 Flash、被拒绝的阻塞节点、损坏看板、隔离审查及回退场景。
5. 应选择同一批公开/内部允许使用的任务，记录任务完成率、工具失败率、重复 token、首包时延与总时长，才能量化准确度和流畅度变化。
