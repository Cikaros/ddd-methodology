<!-- 派生视图，由 scripts/defects.mjs replay 生成；禁手改 -->
# 已知问题（known-issues）

open=0 / total=8

| id | severity | status | area | title |
|---|---|---|---|---|
| DEF-0001 | med | resolved | docs/ddd | 目录级设计件正文残留 draft 标记（§六.4） |
| DEF-0002 | high | resolved | scripts | scripts 承重承接超越文件级实证（M1/M2/M3/M9/M10） |
| DEF-0003 | high | resolved | src | M5 意图确认阻塞原语未落地 |
| DEF-0004 | med | resolved | assets | M11 项目对接规范七字段未落地 |
| DEF-0005 | high | resolved | agents | 随包 agents/ 真宿主不可发现（宿主 AgentEditor 无 add；未落盘 .opencode/agents） |
| DEF-0006 | high | resolved | src | /ddd-init 骨架生成与 Q3 派发（session.create→switchAgent）无文件级设计与实现 |
| DEF-0007 | high | resolved | src | src/index.ts 用 process.execPath 启动 scaffold（真宿主里是 opencode 自身）→ /ddd-init 报「异常」 |
| DEF-0008 | med | resolved | scripts | scripts/scaffold.mjs 同样以 process.execPath 启动 materialize/snapshot |
