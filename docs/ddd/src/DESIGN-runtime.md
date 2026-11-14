---
doc: design
level: file
target: src/runtime.ts
status: frozen
landed: true
covers: [setupRuntime(ctx)]
updated: 2026-11-14
---

# 文件设计：src/runtime.ts — 服务端组装与生命周期

## 定位与边界

注册 commands、skills、prompt/context/tool/permission/shell hooks 与 RPC。配置在 setup 时只读取一次；服务实例以 dispose 逆序销毁。

## 可执行行为契约

安装 SDK 的宿主注册面保持一致；可选宿主能力失败记录诊断、不伪装成运行成功；门禁调用 gate-evaluator，禁止再造独立判据。

## 对外暴露接口

`setupRuntime(ctx)`。本文件由调用侧注入依赖，不私自更改项目方法论与模型请求协议。

## 实施与反例

Mock 宿主 15 命令 + Skills + RPC 可注册；cleanup 及 prompt/context 语义由 selftest 检验。

## 2.0.0 收尾契约（2026-11-14）

**OpenCode 插件运行时装配**：CLI/RPC 共享门禁数据；注册原命令/技能/权限/提示词；消费 execution/usage 等宿主事件，暴露工作流 RPC、验证操作；失败写入诊断而不伪造成功。

## 2.0.1 补充

提示钩子保存技能 ID 而非完整原始用户文本；技能注册继续走 `ctx.skill.transform`，项目物化还支持 OpenCode 原生发现路径。

## 2.0.2 全局集成约束

prompt 仅保存任务提示 ID；context 请求实时查询项目 Skills；RPC 提供统一 overview 视图，继续使用真实状态和门禁来源。
