---
doc: unit-tests
level: file
target: src/lib/shell-encoding.ts
status: frozen
landed: true
depends: [src/lib/DESIGN-shell-encoding.md]
updated: 2026-11-12
---

# 单元测试设计：src/lib/shell-encoding.ts

## 执行件与前置

- 执行件：已实现（`src/lib/shell-encoding.ts`）。
- 前置：`src/lib/DESIGN-shell-encoding.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-src-lib-shell-encoding-01 | 导出面齐全 | 可访问 `isPowerShellShell`、`powershellEncodingPrefix` | 已落地 |
| UT-src-lib-shell-encoding-02 | 判定 PowerShell | 含 `powershell`／`pwsh` 的路径 → true（大小写不敏感） | 已落地 |
| UT-src-lib-shell-encoding-03 | 判定非 PowerShell | `bash`／`zsh`／`sh`／空 → false | 已落地 |
| UT-src-lib-shell-encoding-04 | 前缀无输出噪音 | 前缀不含会打印到 stdout/stderr 的语句 | 已落地 |
| UT-src-lib-shell-encoding-05 | 前缀设 UTF-8 | 含 `OutputEncoding` 与 `UTF8` | 已落地 |
| UT-src-lib-shell-encoding-06 | 幂等标记 | 前缀带标记，供调用方判重 | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
