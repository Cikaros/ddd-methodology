<!-- 派生视图，由 scripts/change.mjs replay 生成；禁手改 -->
# CHANGELOG

## v1.0.0 · CHG-0001 · docs

- 时间：2026-11-11T11:09:01.316Z
- 为什么做：落地期补齐承重承接（F2/F3/F4）：M1/M2/M3/M9/M10 工具、M5 阻塞确认、M11 七字段、R25 反证、R36 缺陷册
- 本次不做：真跑层（需端到端模型）与 TUI dialog 备选路径不在本轮
- 怎么算做对：离线自测全过；声明面=实物面零缺口；drift-check/snapshot 零缺口
- 涉及：docs/ddd/scripts, docs/ddd/assets, src/index.ts, src/tui.tsx

## v1.0.0 · CHG-0002 · feat

- 时间：2026-11-11T12:06:15.381Z
- 为什么做：补齐真跑暴露的 F5/F7：随包 agents 物化（materialize）与项目骨架生成（scaffold）+ Q3 命令派发
- 本次不做：F6（插件命令能否以斜杠触发）仍待核；Q4 角色工具裁剪的真跑复验留待下一轮
- 怎么算做对：真跑下模型可见全部 10 个 ddd-* 角色并可派发；/ddd-init 落骨架且幂等；离线自测全过
- 涉及：scripts, docs/ddd/scripts, src/index.ts

## v1.0.0 · CHG-0003 · docs

- 时间：2026-11-11T12:53:04.331Z
- 为什么做：README 补充安装方式 C（Git 仓库规格）；并按裁决将 v1.0.0 tag 移至含该变更的提交（偏离 R31：不回写已发布版本组）
- 本次不做：不改 package.json 版本号（仍 1.0.0）；不升 1.0.1
- 怎么算做对：README 含方式 C（hosted/HTTPS/SSH、分支/标签/提交哈希、::path:）；远端 v1.0.0 指向最新提交
- 涉及：README.md

## v1.0.1 · CHG-0004 · fix

- 时间：2026-11-11T13:35:54.897Z
- 为什么做：修 C-43 同类缺陷：/ddd-init 用 process.execPath 启动 scaffold，真宿主里被当成 opencode 子命令而失败（显示帮助 reload/pair/serve）
- 本次不做：不改骨架内容与命令语义；仅改启动方式为 node 具名
- 怎么算做对：真宿主 /ddd-init 不再报异常且骨架真落盘；离线自测加 §8.7/C-43 守卫判据（UT-src-index-04）防回归
- 涉及：src/index.ts, scripts/scaffold.mjs, scripts/selftest.mjs, assets/counterexamples.json

## v1.0.2 · CHG-0005 · feat

- 时间：2026-11-11T15:09:43.610Z
- 为什么做：裁决 16 修订：命令派发由「两路并行（带角色即建会话）」改为「默认同会话 + 隔离例外（review/validate/consolidate）」；/ddd-arch 等不再另起会话；隔离例外建子会话时带 parentID
- 本次不做：不改命令名/参数/门禁语义；Q4 在同会话路径下按当前 agent 生效
- 怎么算做对：真跑 /ddd-design 不再产生 ddd/ddd-* 子会话；离线自测含「隔离例外恰为 3 条」断言
- 涉及：assets/commands.json, src/index.ts, docs/OUTLINE-DESIGN.md, docs/REQUIREMENTS.md

## v1.0.3 · CHG-0006 · fix

- 时间：2026-11-12T06:10:06.440Z
- 为什么做：M13 注入载体修正：纪律由「写主体正文+哨兵」改为 instructions.entry 键控注入（key=ddd.discipline，渲染 <context key>、不占轮次、用户不可见）；prompt hook 只做意图探测。修：键名冒号违反宿主正则、entry 可用时仍重复走 system 兜底
- 本次不做：切片/看板/记忆仍走 context hook 的 event.system（每请求动态）；不改其内容
- 怎么算做对：真跑：instructions.entries 含 ddd.discipline；模型在 <context key=ddd.discipline> 块内看到纪律；用户消息正文无哨兵/纪律；离线自测含键名正则与「只注入一处」断言
- 涉及：src/index.ts, docs/OUTLINE-DESIGN.md, docs/ddd/src/DESIGN-index.md

## v1.0.4 · CHG-0007 · feat

- 时间：2026-11-12T06:32:16.143Z
- 为什么做：环境适配补充项：Windows PowerShell 输出编码（GBK→UTF-8）消除中文乱码。落点为 shell.hook("create.before") 改 ev.command（宿主改 shell 命令正门，不绕内置扫描器），仅对 PowerShell 注入、可经 options.powershellUtf8 关闭
- 本次不做：不动 bash/zsh/Linux/macOS；不在 ddd 机制内新增承重项（属环境适配补充）
- 怎么算做对：真跑 echo '中文测试ABC' 输出不再乱码且命令回显不被污染；纯函数 ≥ 10 条断言通过；非 PowerShell 不注入
- 涉及：src/lib/shell-encoding.ts, src/index.ts, docs/OUTLINE-DESIGN.md, docs/ddd/src/lib/DESIGN-shell-encoding.md, docs/ddd/src/DESIGN-index.md

## v1.0.5 · CHG-0008 · fix

- 时间：2026-11-12T06:39:09.740Z
- 为什么做：修 DEF-0012：发布 v1.0.4 曾携带陈旧派生件 docs/maps/MAPS.md（内嵌 snapshot 计数 58/58/173，实际 59/59/179）。加发布门 npm run release（regen→check→typecheck→test）与派生顺序纪律（先 snapshot 再 map）
- 本次不做：不改 map/snapshot 算法；仅加门与顺序纪律
- 怎么算做对：npm run release 全绿；map check 不再因陈旧摘要失败；发布前派生件必同步
- 涉及：package.json, docs/ddd/scripts/DESIGN-map.md

## v1.0.6 · CHG-0009 · fix

- 时间：2026-11-12T06:48:30.340Z
- 为什么做：修 DEF-0013：派生报告含 wall-clock ts 且每次刷新 → 违反「可复算」，令 npm run release 永远脏。新增 scripts/report-io.mjs 幂等写入（内容不变保留旧 ts）；snapshot/drift-check/validate 改用之
- 本次不做：不改报告字段与判定逻辑；仅改写入策略
- 怎么算做对：npm run release 通过且工作区干净；同输入连跑两次报告逐字节相同；UT-scripts-report-io-01..05 通过
- 涉及：scripts/report-io.mjs, scripts/snapshot.mjs, scripts/drift-check.mjs, scripts/validate.mjs

## v1.0.7 · CHG-0010 · fix

- 时间：2026-11-12T07:48:43.131Z
- 为什么做：环境适配（第二个根因）：PS 5.1 读 .ps1 源码无 BOM 即按 GBK 解码 → 中文脚本语法/常量皆错。新增 powershell-bom.ts + 写钩子补 BOM；并写明配置约定（Set-Content -Encoding utf8BOM）
- 本次不做：不覆盖 shell/外部进程直接落盘的 .ps1（属约定层）；不改 .ps1 以外扩展名
- 怎么算做对：真跑：write 建含中文 .ps1 落盘带 BOM；经宿主 shell 执行输出正确中文；纯函数断言通过
- 涉及：src/lib/powershell-bom.ts, src/index.ts, skills/dev-tools/references/shell.md

## v1.0.7 · CHG-0011 · feat

- 时间：2026-11-12T07:48:43.168Z
- 为什么做：新增两个多模态协作子代理 ddd-vision-reader（视觉高思维，读设计稿）/ ddd-ui-diff（低成本，对照差异），纳入 ddd；角色为 agent 模板同构实例，可各配 model#variant
- 本次不做：不新增承重机制、不改门禁；技能仅补「设计稿对照」可选步骤
- 怎么算做对：真跑：主会话派发两子代理完成「读图→对照」，抓出真实差异；角色清单/role-tools/契约自测通过
- 涉及：agents/ddd-vision-reader.md, agents/ddd-ui-diff.md, assets/role-tools.json, skills/frontend-variant-contract/SKILL.md
