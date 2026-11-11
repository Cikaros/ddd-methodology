---
doc: design
level: file
target: skills/ddd-methodology/references/spec-rules.md
status: frozen
landed: false
covers: [spec-rules]
updated: 2026-11-11
---

# 文件设计：references/spec-rules.md（规则规范）

## 定位与边界

- **职责**：执行规则的**判断式**语义——三态落点（配置／`session.update`／`evaluate` hook）、失败语义三分、盲区叙述。
- **边界内**：语义与盲区散文叙述（**机器可读清单**在 `assets/rules.json` 的 `blindspots`）。
- **边界外**：规则取值（`assets/rules.json`）；命令串形态（宿主内置扫描器）。

## 对外暴露接口

Markdown 散文。

## 需引入的依赖

无。

## 调用的模块能力及接口

被 `ddd-validate` 与主技能引用。

## 已知约束

- 每条规则须落三态之一，否则是「纸老虎」。
- 不自建命令黑名单；形态交宿主扫描器（fail-closed）。
