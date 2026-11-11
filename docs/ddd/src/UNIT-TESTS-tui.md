---
doc: unit-tests
level: file
target: src/tui.tsx
status: frozen
landed: false
depends: [src/DESIGN-tui.md]
updated: 2026-11-11
---

# 单元测试设计：DESIGN-tui.md

## 执行件与前置

- 执行件：待实现（对应 `src/tui.tsx`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-src-tui-01 | 导出面齐全 | 可访问 Plugin.define | 待落地 |
| UT-src-tui-02 | 正常路径 | 合法输入 → 契约输出 | 待落地 |
| UT-src-tui-03 | 失败/边界语义 | 非法输入或对象不存在时按失败语义返回（block/visible/na 不混淆） | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
