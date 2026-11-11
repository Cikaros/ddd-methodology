---
name: frontend-variant-contract
description: 变体契约奠基（第 0 步）：UI 生成前把「合法变化空间」枚举穷尽、量化封顶、写入机器可读契约，使后续生成被限制在有限且可枚举的设计空间内。首次接入 UI 开发时载入。
---

# frontend-variant-contract（变体契约奠基 · 第 0 步）

## 何时用

在**首次接入 UI 开发**或项目奠基时，于 `/ddd-arch`（架构就位）阶段载入。**纯原型/一次性页面**显式跳过（自由度优先）并在需求里登记「跳过」。它**不是**另立一套前端体系，而是 ddd 的一个随包技能 + 一个**项目登记门禁**。

## 五步

1. **枚举变化维度**：主题模式／品牌租户／密度／强调色／圆角风格，每维**封闭枚举**（写入 `docs/variant-contract.json` 的 `dimensions`）。
2. **影响范围**：每维声明 `allowedTokenLayer` 与 `forbiddenCrossEffects`；不支持组合入禁止清单。
3. **固化为机器可读契约**：五维＋范围＋反模式；`theme-config` 由其**重放**生成。
4. **变体入口唯一**：切换只在应用 shell；组件只消费语义 token，不接受风格发明参数（`customColor`/`style`）。
5. **确定性审计**：检测多处写入点、未声明值、非法风格 props → 落为**项目登记门禁**。

## 反模式

- 开放区间而非封闭枚举；「30 秒说不出场景」的维度即应封死。
- 组件直接读主题 / 接受 `data-theme` 分支 → 违反入口唯一。
- 把 token 层级（Primitive/Semantic/Component）上升为 ddd 全局机制——它只是**技能内部知识**。

## 与 ddd 的对齐

- **单点权威（M10）**：变体取值只在 `docs/variant-contract.json` 写一次；`docs/ARCHITECTURE.md` 与技能正文一律**引用不复写**。
- **派生物由重放生成**：`theme-config` 禁手改；与契约重放不一致即失败。
- **失败语义两类分开**：`token 值违规`（硬编码颜色等）与`变体契约违规`（越界变化）**各给独立 remedy**。

> 字段结构（schema）在 `assets/variant-contract-schema.json`；项目取值在 `docs/variant-contract.json`。导航：`references/spec-dimensions.md`、`references/spec-impact-scope.md`、`references/spec-single-entry.md`、`references/spec-audit.md`。
