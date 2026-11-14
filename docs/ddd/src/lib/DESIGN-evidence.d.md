---
doc: design
level: file
target: src/lib/evidence.d.mts
status: frozen
landed: true
covers: [ProjectState, collectProjectEvidence]
updated: 2026-11-14
---

# 文件设计：src/lib/evidence.d.mts

## 定位与边界

为 JavaScript 证据采集接口提供 TypeScript 形态声明，不复制任何判定逻辑。

## 对外暴露接口

运行时入口仍由 evidence.mjs 提供，声明文件只有类型、无副作用。

## 需引入的依赖

依赖 gates.ts 的 ProjectState；为 src/index.ts 引入证据口提供静态接口。

## 调用的模块能力及接口

遵循方法论的文档先行原则；可机械验证的断言必须基于当前实物。业务语义无法通过静态扫描证明时不声称通过。
