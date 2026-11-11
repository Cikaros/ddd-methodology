<!-- 派生视图，由 scripts/change.mjs replay 生成；禁手改 -->
# CHANGELOG

## v2.0.0 · CHG-0001 · docs

- 时间：2026-11-11T11:09:01.316Z
- 为什么做：落地期补齐承重承接（F2/F3/F4）：M1/M2/M3/M9/M10 工具、M5 阻塞确认、M11 七字段、R25 反证、R36 缺陷册
- 本次不做：真跑层（需端到端模型）与 TUI dialog 备选路径不在本轮
- 怎么算做对：离线自测全过；声明面=实物面零缺口；drift-check/snapshot 零缺口
- 涉及：docs/ddd/scripts, docs/ddd/assets, src/index.ts, src/tui.tsx

## v2.0.0 · CHG-0002 · feat

- 时间：2026-11-11T12:06:15.381Z
- 为什么做：补齐真跑暴露的 F5/F7：随包 agents 物化（materialize）与项目骨架生成（scaffold）+ Q3 命令派发
- 本次不做：F6（插件命令能否以斜杠触发）仍待核；Q4 角色工具裁剪的真跑复验留待下一轮
- 怎么算做对：真跑下模型可见全部 10 个 ddd-* 角色并可派发；/ddd-init 落骨架且幂等；离线自测全过
- 涉及：scripts, docs/ddd/scripts, src/index.ts
