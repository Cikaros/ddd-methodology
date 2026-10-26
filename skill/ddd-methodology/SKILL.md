---
name: ddd-methodology
description: 分治式设计驱动开发方法论。当用户要求按"ddd方法论""分治式设计驱动""DDD-Methodology"开发新项目或二次开发项目时使用。通过 12 个职责子代理与目录同构的分布式设计文档，降低子代理上下文负担，防止实现偏离设计。
---

# 分治式设计驱动开发

规范唯一权威源为 `references/spec.md`，产物模板见 `references/templates.md`。

## 知识加载规则

禁止整卷加载 references。知识按三层送达：

1. **代理侧内联**：关键规则已内联在各代理提示词正文，派发即完整送达，不受上下文压缩影响。
2. **流程内联标注**：根会话只在下文各步标注的时机加载对应章节。
3. **规范深读**：完整规则在 `references/spec.md`，由本 skill 广告与按需读取。

根会话常驻上下文为 `references/spec.md` 与本文件，其余按步骤加载。

## 流程

1. **需求采集**（ddd-requirements）：细化需求，与用户确认对齐，判定新建或二次开发，产出 REQUIREMENTS.md。
   > 加载：templates 的 REQUIREMENTS 节。
2. **验收标准**（ddd-acceptance）：需求转可执行 AC，产出 AC.md。过 G2。
   > 加载：templates 的 AC 节。
3. **架构设计**（ddd-architect）：产出 ARCHITECTURE.md，含技术环境、目录规划、横切规范、基础能力清单、改造影响评估、设计文档树根路径声明。过 G3。
   > 加载：templates 的 ARCHITECTURE 节；二次开发加读 spec §10；改造评估读 spec §11。
4. **分解设计**（ddd-decomposer）：产出目录同构文档树与签名级接口契约。过 G4。
   > 加载：templates 的 DESIGN 节；粒度与独立性读 spec §4。
5. **接口冻结**（ddd-interface-reviewer）：独立交叉评审，结论非 pass 则退回分解设计。过 G4.5。
   > 加载：spec §5。
6. **实现与测试规划并行**（ddd-implementer ∥ ddd-test-planner）：实现按就近 DESIGN，测试规划产出计划树。
   > 加载：templates 的 TEST_PLAN 节；并行接缝读 spec §6；测试分级读 spec §8。
7. **集成收口**（ddd-fixer）：构建与接缝核对，声明测试就绪，修集成问题。过 G5-INT。
   > 加载：spec §7。
8. **测试执行**（ddd-tester）：按计划执行，缺陷定级路由。
   > 加载：spec §3。路由知识已内联于该代理；仅争议时派 ddd-arbiter。
9. **声明面审计**（ddd-auditor）：全量核对消费方与验证手段，输出修剪清单。过 G6。
   > 加载：spec §12。

过门时按 templates 的门禁检查单填写，写入 `<项目根>/docs/gates/`。

## 根会话职责

只调度、仲裁与验收，不承担实现类工作。派 ddd-arbiter 处理定级争议，仅最终裁决与升级用户由你决定。同一缺陷超 2 轮强制升级用户。

## Workflow 加速档

需求明确且要求一键跑完全链时使用：

```
subagent({ workflow: "<skill目录>/workflows/ddd-workflow.js", args: { root: "<项目根绝对路径>" } })
```

前置条件为 12 个 `ddd-*` 代理已安装，未安装将导致派发失败。可选参数：`maxFixRounds` 默认 2，`stallTimeoutMs` 默认 300000 毫秒、下界 30000 毫秒。

脚本按上述流程推进并在 C/D 级缺陷上自动修复重测，A/B 级中断返回本会话。状态写入 `docs/.ddd-state.json`，schema 见 spec §13。

## 派发要求

每次派发须给出目标、cwd、权限边界、相关文档路径、验收标准、期望输出格式与停止条件。实现者任务须列明其负责目录的 DESIGN 路径，禁止要求整卷加载。多模块按互斥接缝并行，一个接缝一个 writer。
