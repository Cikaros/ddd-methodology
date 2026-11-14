---
doc: design
level: file
target: src/lib/memory-policy.ts
status: frozen
landed: true
covers: [selectApplicableMemory]
updated: 2026-11-14
---

# 文件设计：src/lib/memory-policy.ts — 版本绑定记忆筛选

## 定位与边界

优先按 project scope 筛选；源码 revision 改变和已过期的记忆不得注入；未绑定源码的历史经验只作未验证提示。

## 输入输出与约束

公开能力：`selectApplicableMemory`。错误必须可见；不得把不存在的测试、模型结果或过期证据当作通过。保留 Hermess 文档先行约束和原命令入口。

## 验证要点

旧版记忆兼容、失效时间和版本错配。详见 `tests/rc.test.mjs` 与原有自测；真实宿主联调另列为发布前置条件。

## 2.0.2 全局集成约束

项目权威文档修订摘要独立于任务阶段；同时允许已有证据文件 SHA 绑定的旧记录在对应文档未变更时继续使用。
