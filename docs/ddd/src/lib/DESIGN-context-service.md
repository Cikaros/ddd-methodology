---
doc: design
level: file
target: src/lib/context-service.ts
status: frozen
landed: true
covers: [createContextHook(ctx,config), CORE_DISCIPLINE, foldMemory]
updated: 2026-11-14
---

# 文件设计：src/lib/context-service.ts — 请求级上下文调度

## 定位与边界

统一管理常驻纪律、角色工具白名单、相位切片、看板、记忆、可恢复执行摘要。

## 可执行行为契约

不改用户 prompt；项目证据作为数据处理；纪律只经 instructions.entry 或 system 之一注入；损坏证据显式提示。

## 对外暴露接口

`createContextHook(ctx,config), CORE_DISCIPLINE, foldMemory`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

旧版自测纪律单例、新版 Flash 动态预算与模型标识反例。

## 2.0.0 收尾契约（2026-11-14）

**动态上下文服务**：根据模型、相位和配置 profile 选择预算、冻结设计/需求摘要、记忆提示与工作流状态；稳定前缀且每个请求至多注入一次核心纪律，不更改 DeepSeek 请求协议。

## 2.0.1 补充

上下文只加入匹配的 Skill ID 提示，由模型通过宿主 skill 工具读取全文；不持久化原始用户提示词。

## 2.0.2 全局集成约束

子会话统一按父任务读取阶段、技能提示、记忆和检查点；内容证据错误显式加入上下文，不静默丢失；仍尊重模型预算。
