---
doc: design
level: file
target: src/lib/guard.ts
status: frozen
landed: true
covers: [evaluateBottomLines, BottomLine, Enforcement]
updated: 2026-11-11
---

# 文件设计：src/lib/guard.ts（底线守卫）

## 定位与边界

- **职责**：把 `assets/bottom-lines.json` 的底线映射到**机械执法点**（permission `deny`／tool hook／gate `block`），并产出带 remedy 的判定。
- **边界内**：底线→执法点的映射与判定。
- **边界外**：执法点的实际施加（`src/index.ts` / 门禁）；底线的**存在**（`assets/bottom-lines.json`）。

## 对外暴露接口

| 导出 | 形态 | 说明 |
|---|---|---|
| `BottomLine` | 类型 | `{ id, surface, action, resource, effect, remedy }` |
| `Enforcement` | 类型 | `"permission" | "tool-hook" | "gate"` |
| `evaluateBottomLines(input)` | `(input) => Verdict[]` | 逐条判定；`block` 带 remedy |
| `assertEnforceable(bl)` | `(bl) => string[]` | 无执法点的底线 → 报错（不是底线） |

## 需引入的依赖

无（纯函数；规则数据由调用方传入）。

## 调用的模块能力及接口

被 `src/index.ts`（`permission.hook("evaluate")`、`tool.hook`、门禁）调用。

## 已知约束

- **落不进执法点的不是底线**（R57）：`assertEnforceable` 必须拦下。
- 失败语义三分，`block`/`visible` 带 remedy（Linter 即 Prompt）。
- 能机械判定的底线**不得**只写进注入文本。