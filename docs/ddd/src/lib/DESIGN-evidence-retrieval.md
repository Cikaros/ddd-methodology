---
doc: design
level: file
target: src/lib/evidence-retrieval.mjs
status: frozen
landed: true
covers: [selectEvidence]
updated: 2026-11-14
---

# 文件设计：src/lib/evidence-retrieval.mjs — 阶段证据最小检索

## 定位与边界

仅读取列入白名单的 docs/ 设计/需求文件，不扫描代码/环境变量/密钥；有界截断、校验符号链接、携带源 SHA。

## 输入输出与约束

公开能力：`selectEvidence`。错误必须可见；不得把不存在的测试、模型结果或过期证据当作通过。保留 Hermess 文档先行约束和原命令入口。

## 验证要点

按阶段检索、预算上界、越界文件与 symlink 拒绝。详见 `tests/rc.test.mjs` 与原有自测；真实宿主联调另列为发布前置条件。

## 2.0.2 全局集成约束

增加阶段无关的项目文档 SHA-256 修订，用于记忆过期判定；只读取受控方法论文档路径。
