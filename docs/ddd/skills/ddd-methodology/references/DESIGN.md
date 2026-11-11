---
doc: design
level: group
target: skills/ddd-methodology/references
status: frozen
landed: true
updated: 2026-11-11
---

# 分组设计：skills/ddd-methodology/references（规范散件）

## 目录定位与边界

- **职责**：按需加载的**规范散文**——把「可读但不可机械判定」的语义写清，判据编号指回权威处。
- **边界内**：需求/设计/测试/变更/规则五类规范的判断式部分。
- **边界外**：取值与编号的**具体值**（落 `assets/` 或 `docs/OUTLINE-DESIGN.md`，本组只引用）。

## 目录规划

| 文件 | 一句话职责 |
|---|---|
| `spec-requirements.md` | 需求四问、澄清记录结构、冻结判断面 |
| `spec-design.md` | 设计树落点、frontmatter 用法、对账语义 |
| `spec-test.md` | 用例合格形态、编号唯一、落地凭据 |
| `spec-change.md` | 变更流三字段语义、版本与收尾纪律 |
| `spec-rules.md` | 执行规则三态、盲区叙述 |

## 依赖方向

只引用 `docs/GLOSSARY.md` 术语与 `assets/`、概要设计的权威处；不定义具体取值。

## 状态

本件为 `frozen`；与上级设计件及实物对账一致。
