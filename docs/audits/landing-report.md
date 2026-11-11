# 代码落地报告（设计 → 实物）

> 对象：按 `docs/ddd/**` 49 份文件级设计逐件落地。属**临时报告**（登记 `docs/temp.jsonl`）。
> 结论：**34 份文件级设计全部落地**；离线自测 **80/80 通过**；类型检查 0 错。

## 一、落地清单（按模块）

| 模块 | 实物 | 对应设计 |
|---|---|---|
| `assets/` | commands(15)/gates/rules/memory/bottom-lines/role-tools/board/profiles/injection-slices/languages/variant-contract-schema + `lang-<id>.json`×12 | 12 份 |
| `src/lib/` | registry/paths/gates/router/guard/memory/board（纯函数，只依赖标准库） | 7 份 |
| `src/` | index.ts（server part）/ rpc.ts（契约）/ tui.tsx（tui part） | 3 份 |
| `scripts/` | selftest.mjs（离线自测）/ board.mjs（看板唯一写入器） | 2 份 |
| `agents/` | 10 个角色 md | 2 份（模板 + consolidator，其余同构实例） |
| `skills/` | ddd-methodology / frontend-variant-contract / dev-tools / lang\<id\>×12 | 18 份 |

## 二、机械验收读数

| 项 | 读数 |
|---|---|
| 类型检查 `tsc --noEmit` | 0 错 |
| 离线自测 `node --experimental-strip-types scripts/selftest.mjs .` | **80/80 通过** |
| 设计件 `landed: true` | 49/49（target 均存在） |
| 测试件 `landed: true` | 49/49 |
| 用例编号 | 131，全局唯一，0 重复 |
| 用例「待落地」行 | 0 |
| `R19`（`landed: true` 只在 `frozen`） | 通过（98/98 frozen） |

## 三、离线自测覆盖面（§十二 手段①）

1. **注册面**：mock ctx 断言 `id: ddd`、命令/技能/hook/RPC 已注册，逐条跑通每个命令与 RPC，cleanup 可运行。
2. **纯函数断言**：registry/paths/gates/router/guard/memory/board 的判据（含 `na ≠ pass`、反饥饿、孤儿、收尾判据）。
3. **assets 基线**：schema 合法、单点权威（commands.json ↔ registry 投影一致）、取值域。
4. **内容层契约**：角色 10/10 齐备且 `mode: subagent`、只读角色无写工具、role-tools 双向一致、技能 frontmatter 合法。
5. **看板唯一写入器**：`board.mjs` 端到端（append-only / 准入拒 / 非法转移拒 / 派生一致 / 手改检出 / 无看板 na / 无归属收口）。
6. **自测入口自身**：退出码 0/1/2 语义自证。

## 四、诚实界定（未做/待核）

- **真跑层（需模型）** 未做：端到端「模型调用某工具」属 §十二 手段③，需显式指示模型，非本轮范围。
- **TUI 交互** 为增强（非承重）：`@opentui/solid`/`solid-js` 为 peer，运行期由宿主解析；离线仅验其不破坏 server part。
- **看板命令经注入 + `scripts/board.mjs`** 落地；命令 handler 内的子代理派发留待真跑层验证（Q3 两路并行）。

## 五、结论

- 设计树 34 份文件级设计**全部落地**，机械验收全绿；设计件保持 `frozen`，`landed` 与「落地」列已如实更新。
- 下一步：`/ddd-test` → `/ddd-validate` → **代码冻结检查点**（含冻结即归并 M12）。
