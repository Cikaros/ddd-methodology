# 变体入口唯一（spec-single-entry）

## 铁律

- 变体切换**只发生在应用 shell 层**（唯一写入点）。
- 组件只消费**语义 token**；**不接受**「风格发明」参数（`customColor` / `style` / `data-theme` 分支等）。

## 判据

- 代码搜索中，主题/品牌写入点**仅 shell 一处**。
- 组件内**无** `data-theme` 分支、无硬编码颜色。

## 落点

- 变体入口唯一落为**项目规则**（须有执法点，见 spec-rules）；违反即由项目登记门禁 `block`。
