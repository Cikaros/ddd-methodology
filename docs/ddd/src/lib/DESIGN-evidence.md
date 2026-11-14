---
doc: design
level: file
target: src/lib/evidence.mjs
status: frozen
landed: true
covers: [collectProjectEvidence, scanDesignTree, readJsonlStrict, EvidenceError]
updated: 2026-11-14
---

# 文件设计：src/lib/evidence.mjs

## 定位与边界

通过项目实物生成 G1–G6 状态，拒绝从旧报告或硬编码中取得通过判定。

## 对外暴露接口

只读设计树、需求、架构、落地目标、看板、变更流；输出可追溯状态、误差和诊断。

## 需引入的依赖

Node fs/path、assets/commands.json；对接 scripts/validate.mjs、scripts/snapshot.mjs 和 src/index.ts 的 RPC。

## 调用的模块能力及接口

遵循方法论的文档先行原则；可机械验证的断言必须基于当前实物。业务语义无法通过静态扫描证明时不声称通过。
