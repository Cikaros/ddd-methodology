---
doc: design
level: group
target: skills/lang/references
status: frozen
landed: false
covers: [lang-references]
updated: 2026-11-11
---

# 分组设计：skills/lang/<id>/references（语言参考）

## 目录定位与边界

- **职责**：每语言实例的按需参考——基线引用与项目覆盖。
- **边界内**：上游指南引用（链接/版本/复核日）、项目覆盖理由。
- **边界外**：上游全文（不拷入）；机械阈值（`assets/lang-<id>.json`）。

## 目录规划（每实例同构）

| 文件 | 一句话职责 |
|---|---|
| `google-style.md` | 该语言基线指南的引用与要点导航（无 Google 版时指向官方/事实标准） |
| `project-overrides.md` | 项目对基线的覆盖及理由 |

## 依赖方向

只引用外部指南与 `assets/lang-<id>.json`；不复制正文。

## 状态

`draft`。