# 变更记录

本文件记录 pi package 形态的版本变更，版本号与仓库根 `package.json` 的 `version` 对应，采用三段式语义化版本；本包经 `pi install` 安装，例如 `pi install git:github.com/Cikaros/ddd-methodology`。方法论规范版本 v1.0 至 v2.21 的演进史已归档至 `docs/internal/history/spec-changelog.md`，属内部档案，不作为公开内容。

## 0.2.0 - 2026-11-03

- **破坏性**：删除 `scripts/install.sh`、`install.bat`、`uninstall.sh`、`uninstall.bat`，模型配比的应用与撤回改由 `/ddd-models` 命令承担；对应撤除 `ref-check` 的 C13 与 C18 两项校验，校验项由十九项收为十七项。
- **修正**：机械证据覆盖率的判据不识别工具名形态致其恒报零，已修正；证据源命名在门禁表中与其余门不一致，已对齐。
- **内部**：消除两处真重复实现，抽取扩展共享模块；若干处与实际不符的规范与结构描述已修正。
- **新增规则**：全局规则块增第 8 条，要求派发任务书凡涉及删除、重构、合并者先核验处置前提。

## 0.1.2 - 2026-11-03

- **迁移脚本**：下一步安装提示改为从 `package.json` 的 `version` 动态读出，不再硬编码版本号，随发版自动更新；读取失败降级为不带版本的命令并提示自行确认。
- **安装示例**：README 与 STRUCTURE.md 的安装示例不再写具体版本号，改为跟随默认分支；固定版本的写法在 README「版本管理」节以占位符说明。

## 0.1.1 - 2026-11-03

- **安装文档**：README 安装段落补充网络提示，说明 pi 经 HTTPS clone `github.com`，通道不通时可改用 SSH 重写地址。

## 0.1.0 - 2026-11-03

- **pi package 形态**：仓库根 `package.json` 声明 `pi.extensions`、`pi.skills` 与 `pi-subagents.agents`，可经 `pi install` 安装。
- **许可**：新增 `LICENSE`，MIT 协议。
- **文档分层**：`docs/` 按读者分层为 `guide`、`reference`、`internal`，内部产物不再随公开仓发布。
- **版本体系**：切换为包语义化版本，历史规范版本 tag 全部废弃，从 `v0.1.0` 重新起步。
- **全局规则交付方式**：删除 `scripts/merge-append-system.js`；全局规则不再由脚本按标记区块合并入用户全局文件，改由 `extensions/ddd-context.ts` 在会话启动时以 `sections.ddd_global_rules` 注入。
- **检索纪律**：全局规则块纳入检索纪律，派发任务书内的检索须限定在明确目录内并带路径参数，禁止不带路径的检索与全盘扫描；单条命令超时即放弃，换用更窄检索面。
- **安装职责收敛**：`scripts/install.sh`、`install.bat`、`uninstall.sh`、`uninstall.bat` 的复制安装职责删除，收敛为仅承担模型配比；skill、子代理与扩展的安装与移除交由 `pi install` 与 `pi remove` 承担。
- **运行时扩展**：新增四个扩展，`ddd-context.ts` 注入全局规则并探测 `pi-subagents` 前置依赖，`ddd-tools.ts` 把甲类机械校验注册为六个 `ddd_*` 工具，`ddd-governance.ts` 仅在含 `docs/design` 或 `docs/gates` 的项目内拦截越阈值写入与全量测试误跑，`ddd-models.ts` 以 `/ddd-models` 命令提供模型配比的用户触发入口。
- **签名级符合性校验**：新增 `ddd_span_check` 与 `scripts/span-check.js`，把 DESIGN 契约签名与代码侧导出符号三态比对；所需解析器按需装到用户固定位置，入口为 `/ddd-parser-install`，首期覆盖 TypeScript、JavaScript、Python、Java、Go、Rust。
