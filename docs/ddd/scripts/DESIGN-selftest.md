---
doc: design
level: file
target: scripts/selftest.mjs
status: draft
landed: false
covers: [selftest]
depends: [src/index.ts, src/lib/registry.ts]
updated: 2026-11-11
---

# 文件设计：scripts/selftest.mjs（离线自测入口）

## 定位与边界

- **职责**：**无模型、无网络**地加载 server part，用 mock `ctx` 断言「setup 注册了什么」并逐条跑通每个命令/RPC。
- **边界内**：mock 上下文、断言、退出码。
- **边界外**：真宿主端到端（需模型）；盘面门禁读取。

## 对外暴露接口

命令行：`node --experimental-strip-types scripts/selftest.mjs <插件目录> [--verbose]`
退出码：`0` 全过；`1` 有失败；`2` 用法/入口错。

## 需引入的依赖

- Node 标准库：`node:fs`、`node:path`、`node:url`。
- **不引入** `@opencode/plugin`（用 mock 替代）；入口由插件自己 import。

## 调用的模块能力及接口

- 读插件 `package.json` 的 `exports["."]` 定位 server 入口。
- mock：`ctx.command.transform`、`ctx.skill.transform`、`ctx.session.hook/prompt`、`ctx.rpc.register`、`ctx.storage.*`。

## 断言清单（须覆盖）

- `default` 导出存在、`id === "ddd"`、`setup` 为函数。
- 注册了命令/技能/至少一个 hook/一个 RPC。
- 每条命令：有 `execute`、名带 `ddd-` 前缀。
- 每个 RPC：handler 可跑通并返回值。
- cleanup 可运行。

## 已知约束

- 入口 `.ts` 用 `--experimental-strip-types` 直接跑；相对 `./x.ts` 说明符须可解析。
- 这是 §十二「三种验证手段」的**无模型**那层；真跑层另计。
