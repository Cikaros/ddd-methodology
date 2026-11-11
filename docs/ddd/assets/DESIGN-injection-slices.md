---
doc: design
level: file
target: assets/injection-slices.json
status: draft
landed: false
covers: [injection-slices]
depends: [src/lib/router.ts]
updated: 2026-11-11
---

# 文件设计：assets/injection-slices.json（注入切片映射）

## 定位与边界

- **职责**：**切片映射的唯一权威**——`(phase,intent) → sliceIds`。每片是「最小纪律/知识」的标识，正文在 `skills/**/references/`。
- **边界内**：映射与切片元数据（id、来源件、常驻?）。
- **边界外**：切片正文（引用）；选择逻辑（`src/lib/router.ts`）。

## 对外暴露接口

JSON：`{ "slices": [ { "id", "source", "when": { "phase?", "intent?" } } ] }`

| 字段 | 含义 |
|---|---|
| `id` | 切片标识（键控注入用 `ddd:<id>`） |
| `source` | 正文所在件（`skills/**/references/*.md` 或 `docs/**`） |
| `when.phase` | 触发的相位（可空＝任意） |
| `when.intent` | 触发的意图（可空＝任意） |

## 需引入的依赖

无。被 `src/lib/router.ts` 读入。

## 调用的模块能力及接口

router 据本件选择切片；`src/index.ts` 按键控注入。

## 已知约束

- **单点权威**：切片映射只在此件；技能正文不复写映射。
- 切片须**最小**；全文留 `references/`（渐进式披露）。