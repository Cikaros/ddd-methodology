---
doc: unit-tests
level: file
target: src/tui.tsx
status: frozen
landed: true
depends: [src/DESIGN-tui.md]
updated: 2026-11-11
---

# 单元测试设计：DESIGN-tui.md

## 执行件与前置

- 执行件：已实现（对应 `src/tui.tsx`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-src-tui-01 | 导出面齐全 | 可访问 Plugin.define | 已落地 |
| UT-src-tui-02 | 正常路径 | 合法输入 → 契约输出 | 已落地 |
| UT-src-tui-03 | 失败/边界语义 | RPC 不通时降级为 toast，不抛 | 已落地 |
| UT-src-tui-04 | §9.5 分职责 | dialog 只做输入采集（select/prompt）；放行走 RPC/`assert`，不在 TUI 弹确认闸机 | 已落地 |
| UT-src-tui-05 | 取消语义 | dialog 返回 `undefined` 不直接中止流程 | 已落地 |
| UT-src-tui-06 | keymap 工厂纯 | `layer(factory)` 的工厂无副作用、可重复调用 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
