---
doc: design
level: file
target: src/index.ts
status: frozen
landed: true
covers: [Plugin.define, setupRuntime]
depends: [src/runtime.ts]
updated: 2026-11-14
---

# 文件设计：src/index.ts — OpenCode 入口

## 定位与边界

入口仅对 OpenCode `Plugin.define({id:"ddd", setup: setupRuntime})` 做适配，不再承担命令注册、上下文拼接、证据判据、事件总线或业务写入。所有装配在 `src/runtime.ts`；命令在 `src/lib/command-dispatcher.ts`；context 在 `src/lib/context-service.ts`。

## 对外暴露接口

`default` 为插件定义，`id === "ddd"`；复用当前 `.`, `./rpc`, `./tui` 包导出路径。维护所有 15 个既有 `/ddd-*` 命令，不静默重命名入口。

## 用例与风险

UT-src-index-01〜08 由原版 `scripts/selftest.mjs` 模拟宿主执行；真实 OpenCode SDK/API 联调仍是发布前的必要验证。
