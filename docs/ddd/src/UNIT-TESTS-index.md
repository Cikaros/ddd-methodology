---
doc: unit-tests
level: file
target: src/index.ts
status: frozen
landed: true
depends: [src/DESIGN-index.md]
updated: 2026-11-13
---

# 单元测试设计：DESIGN-index.md

## 执行件与前置

- 执行件：已实现（对应 `src/index.ts`）。
- 前置：本件依赖的设计件见 frontmatter `depends`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-src-index-01 | 导出面齐全 | 可访问 Plugin.define、setup | 已落地 |
| UT-src-index-02 | 正常路径 | 合法输入 → 契约输出 | 已落地 |
| UT-src-index-03 | 失败/边界语义 | 非法输入或对象不存在时按失败语义返回（block/visible/na 不混淆） | 已落地 |
| UT-src-index-06 | 相位读写同键 | 写 `ddd:phase:<sid>` 与 context hook 读取键一致（防相位切片静默失效） | 已落地 |
| UT-src-index-07 | 同会话指令投影 | `same` 路径指令显式带入角色「约束」节（〖硬约束〗）与切片全文指针（按需读）；无角色命令不产硬约束块 | 已落地 |
| UT-src-index-08 | 核心纪律含反压缩条款 | 逐项交付（不以摘要代替）、即修或追踪（不以「建议后续」收尾） | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
