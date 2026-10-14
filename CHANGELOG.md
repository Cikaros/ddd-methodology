# 变更记录（CHANGELOG）

## v1.5（2026-10-14）
- 规范：核心文件（SKILL.md、references、agent 定义）移除所有"版本/增补"类元信息表述，运行时内容保持纯净；变更记录统一收敛至本文件。
- 功能：实现主题 A——workflow 加速档支持缺陷自动路由轮次：测试执行后发现 C/D 级缺陷自动派发修复并重测（最多 2 轮，超限抛出交由根会话升级用户）；A/B 级缺陷始终中断 workflow 返回根会话仲裁。
- 安装脚本无变化。

## v1.4（2026-10-14）
- 增补 process-details.md：B 多模块并行实现策略（互斥接缝/一接缝一writer/集成收口）、C 需求变更流程（变更单/版本化追加/AC 双向追溯圈定影响）、D 二次开发细则强化（现状分析报告格式+对齐检查清单）、E 质量门禁（G1–G6 阶段门）。
- SKILL.md 新增门禁与需求变更章节；ddd-architect、ddd-decomposer 职责同步。

## v1.3（2026-10-14）
- 修复 workflow 脚本：沙箱无 process，改用 args.root 传项目根并加守卫；runs.run 改为 key,params 签名。
- 修复 SKILL.md 加速档调用路径（改为 <skill目录>/workflows/ddd-workflow.js）。
- 新增独立卸载脚本 uninstall.sh/uninstall.bat；安装/卸载改为固定 7 文件名清单防误删；install 支持 --check；幂等覆盖更新；bat 加 chcp 65001。
- install.sh 重写时丢失 workflows 复制步骤的回归缺陷已修复（sh/bat 均补回）。

## v1.2（2026-10-14）
- 补充 workflow 加速档：workflows/ddd-workflow.js 固定阶段自动编排；纳入安装脚本与 README。

## v1.1（2026-10-14）
- 首次实现：pi Skill（SKILL.md + references 三件套）+ 7 个子代理定义 + 文档模板库 + 缺陷四级路由细则 + 安装/卸载脚本（bat/sh）。

## v1.0（2026-10-14）
- 方法论规范最终版：决策点 1–9 全部确认（代理0 验收标准制定者、缺陷四级路由、DESIGN.md 模板字段、就近加载+上溯、横切规范集中、2 轮终止条件、实现形式为 Skill+agents+可选 workflow、DESIGN.md 粒度、二次开发现状分析仅限缺文档项目）。
