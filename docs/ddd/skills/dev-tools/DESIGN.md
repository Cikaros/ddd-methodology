---
doc: design
level: group
target: skills/dev-tools
status: frozen
landed: false
covers: [dev-tools]
updated: 2026-11-11
---

# 分组设计：skills/dev-tools（常用开发工具使用规范技能）

## 目录定位与边界

- **职责**：常用开发工具的**用法与判断**约定（非工具机械默认值）。
- **边界内**：跨工具通用约定（提交粒度、分支、验证前置）与单工具用法。
- **边界外**：工具自身的机械默认值（由工具配置承担）；格式化/lint 的机械执行（宿主 `formatter`/规则）。

## 目录规划

| 文件/目录 | 一句话职责 |
|---|---|
| `SKILL.md` | 何时载入＋跨工具通用约定 |
| `references/` | 单工具用法（分组设计见 `references/DESIGN.md`） |

## 载入方式

**不常驻**：router 在检测到相应工具/任务时注入（R62）。

## 依赖方向

只引用术语表与 `assets/`；不依赖实现。

## 状态

`draft`。