---
doc: unit-tests
level: file
target: scripts/selftest.mjs
status: frozen
landed: true
depends: [scripts/DESIGN-selftest.md]
updated: 2026-11-13
---

# 单元测试设计：DESIGN-selftest.md

## 执行件与前置

- 执行件：已实现（对应 `scripts/selftest.mjs`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-scripts-selftest-01 | 注册面断言 | mock ctx 下断言 setup 注册了什么 | 已落地 |
| UT-scripts-selftest-02 | 退出码语义 | 全过 0 / 失败 1 / 用法错 2 | 已落地 |
| UT-scripts-selftest-03 | 锁文件版本同步 | `package-lock.json` 两处根版本 = `package.json`（发布须同步锁文件） | 已落地 |
| UT-scripts-selftest-04 | 变更流版本一致 | 最新变更流记录版本 = `package.json` 版本（三处一致，R31） | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
