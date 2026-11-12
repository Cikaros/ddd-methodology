<!-- 派生视图，由 scripts/defects.mjs replay 生成；禁手改 -->
# 已知问题（known-issues）

open=0 / total=14

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
| DEF-0009 | high | resolved | src | instructions.entry 键名含冒号（ddd:phase/ddd:discipline）违反宿主键正则 ^[a-z0-9][a-z0-9._-]* → 纪律未写入 |
| DEF-0010 | med | resolved | src | 纪律注入重复：entry 可用时仍走 system 兜底（快照 seen=undefined 判断错） |
| DEF-0011 | med | resolved | src | 纪律经 prompt hook 注入用户消息正文（区别于 §19.3 键控/不占轮次）；退役 <!--ddd:core--> 哨兵 |
| DEF-0012 | med | resolved | docs/maps | 发布 v1.0.4 携带陈旧派生件 MAPS.md（内嵌 snapshot 摘要 58/58/173，实际 59/59/179）；发布流程漏跑 map replay |
| DEF-0013 | med | resolved | scripts | 派生报告含 wall-clock ts 且每次刷新 → 违反「可复算」，令 npm run release 永远脏工作区 |
| DEF-0014 | high | resolved | src | 第二个乱码根因：PS 5.1 读 .ps1 源码无 BOM 即按 GBK 解码；UTF-8 无 BOM 且含中文的脚本常量/语法皆错（chcp/OutputEncoding 均无效） |
