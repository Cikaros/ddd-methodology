---
doc: unit-tests
level: file
target: src/lib/powershell-bom.ts
status: frozen
landed: true
depends: [src/lib/DESIGN-powershell-bom.md]
updated: 2026-11-12
---

# 单元测试设计：src/lib/powershell-bom.ts

## 执行件与前置

- 执行件：已实现（`src/lib/powershell-bom.ts`）。
- 前置：`src/lib/DESIGN-powershell-bom.md`。

## 用例

| 编号 | 名称 | 期望 | 落地 |
|---|---|---|---|
| UT-src-lib-powershell-bom-01 | 导出面齐全 | 可访问 `isPowerShellScript`/`hasUtf8Bom`/`needsUtf8Bom`/`withUtf8Bom` | 已落地 |
| UT-src-lib-powershell-bom-02 | 仅 .ps1 | `x.ps1`/`X.PS1` → true；`x.js`/`x.json`/`x` → false | 已落地 |
| UT-src-lib-powershell-bom-03 | 含非 ASCII 才需 | 纯 ASCII `.ps1` → false；含中文 `.ps1` → true | 已落地 |
| UT-src-lib-powershell-bom-04 | 幂等 | 已带 BOM → `needsUtf8Bom` false；`withUtf8Bom` 不重复加 | 已落地 |
| UT-src-lib-powershell-bom-05 | 加 BOM 形态 | 结果首字符为 U+FEFF（`\uFEFF`） | 已落地 |

> 编号全局唯一；未落地报「待落地」而非「缺陷」。
