---
doc: unit-tests
level: file
target: src/lib/router.ts
status: frozen
landed: true
depends: [src/lib/DESIGN-router.md]
updated: 2026-11-13
---

# 单元测试设计：DESIGN-router.md

## 执行件与前置

- 执行件：已实现（对应 `src/lib/router.ts`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-src-lib-router-01 | 导出面齐全 | 可访问 routeSlices、detectIntent、Phase、roleConstraints、sliceSources | 已落地 |
| UT-src-lib-router-02 | 正常路径 | 合法输入 → 契约输出 | 已落地 |
| UT-src-lib-router-03 | 失败/边界语义 | 非法输入或对象不存在时按失败语义返回（block/visible/na 不混淆） | 已落地 |
| UT-src-lib-router-04 | 角色约束投影 | 仅提取「约束」节条目；无该节返回空（不发明）；别节不混入 | 已落地 |
| UT-src-lib-router-05 | 切片来源 | 去重且可解析；未命中 id 忽略 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
