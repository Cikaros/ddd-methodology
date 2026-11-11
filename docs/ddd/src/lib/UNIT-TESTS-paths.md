---
doc: unit-tests
level: file
target: src/lib/paths.ts
status: frozen
landed: true
depends: [src/lib/DESIGN-paths.md]
updated: 2026-11-11
---

# 单元测试设计：DESIGN-paths.md

## 执行件与前置

- 执行件：已实现（对应 `src/lib/paths.ts`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-src-lib-paths-01 | 导出面齐全 | 可访问 packageRoot、projectRoot、packagePath、projectPath、within | 已落地 |
| UT-src-lib-paths-02 | 正常路径 | 合法输入 → 契约输出 | 已落地 |
| UT-src-lib-paths-03 | 失败/边界语义 | 非法输入或对象不存在时按失败语义返回（block/visible/na 不混淆） | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
