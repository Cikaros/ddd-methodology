---
doc: design
level: file
target: agents/ddd-consolidator.md
status: draft
landed: false
covers: [agent]
updated: 2026-11-11
---

# 文件设计：agents/ddd-consolidator.md（归并子代理）

## 定位与边界

- **职责**：**冻结即归并**（M12）专用子代理。按模块/目录**隔离**处理一块：剔产物内联的变更记录痕迹，把该块重构成最终形态。
- **边界内**：一块产物的表述形态重构。
- **边界外**：跨块协调（由主会话派发）；契约语义变更（**禁止**）。

## 对外暴露接口

- frontmatter：`description`、`mode: subagent`、可选 `model`、`permissions`（只读 + 目标块写）。
- 正文：归并工作说明。

## 需引入的依赖

无（纯 Markdown 代理定义）。

## 调用的模块能力及接口

- 由宿主 `subagent` 工具按 `mode: subagent` 触发。
- 读：该块当前产物、该块变更流**切片**（只读）、该块冻结契约。

## 已知约束（关键）

- **输入面限定**：只看该块目标形态 + 该块变更流切片 + 该块冻结契约；**不得**带入全量历史（防上下文污染漂移）。
- **归并不改契约语义**：归并前后对接口签名与 frontmatter **逐字**对账；差异只允许出现在非契约叙述。
- **只删产物内联痕迹，不删权威变更流**（`docs/CHANGELOG.jsonl` 不碰）。
