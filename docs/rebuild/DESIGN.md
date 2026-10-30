# 重建设计

> 状态：未执行。全量重建未落地，本轮实际执行的是 `docs/refactor/DESIGN.md` 的定向重构；本文件保留为发散段记录。下文目标结构，含根 `ARCHITECTURE.md`、`scripts/check/` 六模块、README 精简与 agents 七节骨架，均无对应产物，不构成对外声称。

本设计的输入为冻结锚点清单与本轮现状盘点。目标是按锚点整篇重写方法论本体与工具面，同时保持全部对外契约不变。

## 1. 目标结构

```
ddd-methodology/
├── ARCHITECTURE.md               # 新增，本仓库架构基线，声明各域职责与依赖方向
├── README.md                     # 精简，结构树由校验保证与实际一致
├── CHANGELOG.md                  # 保留，历史记录
├── .gitattributes                # 保留
├── global/APPEND_SYSTEM.md       # 保留，全局规则权威版
├── profiles/models.json          # 角色名改由 agents 目录派生
├── agents/                       # 12 份，统一七节骨架
├── extensions/ddd-governance.ts  # 保留，守卫逻辑不变
├── workflows/ddd-workflow.js     # 保留，角色名受校验
├── scripts/
│   ├── ref-check.js              # 薄调度层，加载各校验模块并汇总输出
│   ├── check/                    # 新增，校验实现按域拆分
│   │   ├── refs.js               # 引用与脚本名
│   │   ├── consts.js             # 阈值、阶段键、门号、守卫编号
│   │   ├── roster.js             # 代理与 skill 清单
│   │   ├── phrases.js            # 冻结短语
│   │   ├── tables.js             # 判定表默认分支
│   │   └── docs.js               # 文档树、孤儿、裸数字节、计数
│   ├── lib/                      # 新增，跨脚本共享实现
│   │   ├── text.js               # 文件读取、行号、漂移项构造
│   │   └── walk.js               # 目录遍历
│   ├── apply-models.js           # 角色清单改由 agents 目录读取
│   ├── code-health.js            # 改用 lib
│   ├── governance-check.js       # 改用 lib
│   ├── trace-check.js            # 改用 lib
│   ├── merge-append-system.js    # 保留
│   ├── fingerprint.js            # 保留
│   ├── design-root.js            # 保留
│   ├── install.sh / install.bat / uninstall.sh / uninstall.bat
├── skill/
│   ├── ddd-methodology/
│   │   ├── SKILL.md              # 加载规则与流程表按新规范文件组织更新
│   │   └── references/
│   │       ├── spec.md           # 索引、问题与解法、全局约定
│   │       ├── spec-role.md      # 角色与交接
│   │       ├── spec-gate.md      # 质量门禁、缺陷四级路由
│   │       ├── spec-design.md    # 粒度、接口冻结、并行、实现测试分离、阻塞防护
│   │       ├── spec-change.md    # 需求变更、二次开发、渐进式改造
│   │       ├── spec-declare.md   # 声明面、机械证据
│   │       ├── spec-govern.md    # 本仓库边界、状态文件、演进治理
│   │       ├── spec-rebuild.md   # 存量重建
│   │       ├── templates.md / templates-rebuild.md
│   ├── ddd-rebuild/SKILL.md      # 保留正文，仅同步引用路径
│   └── ddd-refactor/SKILL.md     # 同上
└── docs/                         # 保留，归档与证据
```

## 2. 规范拆分

单文件 431 行拆为八份，按域归并，每份控制在 200 行内。

| 文件 | 承载节 | 归属理由 |
|---|---|---|
| spec.md | 索引、§0 问题与解法、全局约定 | 入口与公共前提 |
| spec-role.md | §1 角色与交接 | 角色与派发 |
| spec-gate.md | §2 质量门禁、§3 缺陷四级路由 | 门禁与缺陷判定 |
| spec-design.md | §4 粒度与独立性、§5 接口先行与冻结、§6 并行实现与集成、§7 实现与测试分离、§8 测试阻塞防护 | 设计与实现约束 |
| spec-change.md | §9 需求变更、§10 二次开发、§11 渐进式改造 | 变更与改造 |
| spec-declare.md | §12 声明面可验证与修剪、§13 结构与注释的机械证据 | 声明与证据 |
| spec-govern.md | §14 本仓库适用边界、§15 状态文件、§16 结构与契约的演进治理 | 治理与状态 |
| spec-rebuild.md | §17 存量重建 | 重建场景 |

约定：

1. 节标题集合全局唯一，跨文件也不得重名。引用形式保持「节标题」节，不变更写法。
2. spec.md 作为索引入口，列出全部节标题与其所在文件，供按需加载。
3. 每份文件头部一句范围说明，写明承载的节与不包含什么。

## 3. 代理骨架

统一为七节，顺序固定：角色、输入、输出契约、职责、硬约束、内联规则、停止条件。

四处偏离的归并：auditor 的「审计范围」并入职责；doc-sync 的「巡检清单」并入职责；arbiter 的「仲裁裁决」并入输出契约；interface-reviewer 的职责前置。

frontmatter 口径统一：八个写入类代理显式声明 `acceptanceRole: writer` 与 `acceptance`，四个只读类代理显式声明 `acceptanceRole: read-only`。同时修正规范机械约束节中与实际不符的措辞。

## 4. 脚本分层

1. 新增 `scripts/lib/text.js`，承载文件读取、行号、漂移项构造，供 ref-check、各校验模块与 roster 共用，消除三份逐字重复。
2. 新增 `scripts/lib/walk.js`，承载目录遍历，供 code-health、governance-check、trace-check 共用。
3. 新增 `scripts/check/` 六个校验模块，`ref-check.js` 退为薄调度层，只做加载、执行、汇总与末行结论。此举同时解决 ref-check 429 行的阈值逼近。
4. 各模块各自的漂移项字段保持与现状一致，输出契约与退出码语义不变。

## 5. 清单来源

1. 代理名与 skill 名的运行时权威保持为目录本身，即 `agents/` 与 `skill/`。
2. `apply-models.js` 的 KNOWN_AGENTS 改为从 `agents/` 目录读取，消除一份可漂移副本。
3. `profiles/models.json` 的角色名改为生成或校验，以 `agents/` 为准。
4. 文档与沙箱内的副本，即规范角色表与 workflow 阶段绑定，保持内联并纳入机械校验，因为沙箱无文件系统且文档无生成通道。

## 6. 校验补全

在现十一项基础上补齐此前无机械覆盖的事实。

| 新增 | 内容 |
|---|---|
| 裸数字节引用 | 检出「与 16.1 契约指纹条」这类无节名字的裸编号引用 |
| README 结构树 | 结构树声明与实际文件树一致 |
| 文档孤儿 | docs 之外的活文档被引用情况 |
| 计数一致性 | 各文档中「12 个代理」等计数与实际一致 |
| 代理骨架 | 12 份代理的一级标题集合一致 |
| 版本条目 | CHANGELOG 最新条目版本与 tag 一致 |

## 7. 结构声明

新增 `ARCHITECTURE.md` 作为架构基线，声明各域职责、依赖方向与不变量。规范本仓库适用边界节的措辞同步更新，说明该文件是本仓库的结构声明，不作为被开发项目的架构文档，G1 至 G5 仍不适用。

## 8. 废弃与迁移

被替换的产物逐项进入废弃清单：原 `references/spec.md` 由 `spec.md` 与七份 `spec-*.md` 替代；原 `ref-check.js` 内联实现由 `ref-check.js` 与 `check/` 模块替代；原 `roster-check.js`、`decision-tables.js` 归入 `check/`。

旧版本留在回溯点，不在案保留。清理在验证与审计通过后执行。

## 9. 验证

1. `ref-check` 全项通过，含新增项。
2. `code-health` 无超限，`nearLimit` 下降。
3. `governance-check` verdict 为 ok。
4. `ddd-doc-sync` 巡检与 `ddd-auditor` 审计无阻断项。
5. 全部对外契约实测不变：脚本命令、退出码、安装参数、skill 调用、阶段键、门禁号。
6. 重装部署面并逐字比对。

## 10. 波次

| 波次 | 内容 | 写入者 |
|---|---|---|
| 1 | 规范拆分与引用更新 | 一个写入者独占 references 与引用方 |
| 2 | 代理骨架与 frontmatter 统一 | 一个写入者独占 agents |
| 3 | 脚本分层与校验补全 | 一个写入者独占 scripts |
| 4 | README 与 ARCHITECTURE | 一个写入者 |
| 5 | 验证与审计 | 校验脚本与两条只读链 |
| 6 | 废弃清理与基线重写 | 根会话 |

波次 1 与 2 可并行，波次 3 依赖波次 1 的节标题集合，波次 4 依赖前三者。
