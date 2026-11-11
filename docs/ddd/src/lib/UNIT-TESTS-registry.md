---
doc: unit-tests
level: file
target: src/lib/registry.ts
status: frozen
landed: false
depends: [src/lib/DESIGN-registry.md]
updated: 2026-11-11
---

# 单元测试设计：DESIGN-registry.md

## 执行件与前置

- 执行件：待实现（对应 `src/lib/registry.ts`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-src-lib-registry-01 | 导出面齐全 | 可访问 COMMANDS、SKILLS、registrations、auditRegistrations | 待落地 |
| UT-src-lib-registry-02 | 正常路径 | 合法输入 → 契约输出 | 待落地 |
| UT-src-lib-registry-03 | 失败/边界语义 | 非法输入或对象不存在时按失败语义返回（block/visible/na 不混淆） | 待落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
