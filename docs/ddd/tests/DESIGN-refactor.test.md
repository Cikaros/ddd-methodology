---
doc: design
level: file
target: tests/refactor.test.mjs
status: frozen
landed: true
covers: [refactor-test]
updated: 2026-11-14
---

# 文件设计：tests/refactor.test.mjs

## 定位与边界

重构反例回归，用临时项目检验真实门禁证据与 Flash 上下文限制。

## 对外暴露接口

18 个 node:test 反例及正例；不改动本包的设计和变更权威。

## 需引入的依赖

调用证据采集器与门禁纯函数；使用 Node 标准测试库。

## 调用的模块能力及接口

遵循方法论的文档先行原则；可机械验证的断言必须基于当前实物。业务语义无法通过静态扫描证明时不声称通过。
