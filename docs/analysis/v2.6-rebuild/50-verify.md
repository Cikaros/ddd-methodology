# 验证与验收契约

## 1. 机械验证

| 顺序 | 命令 | 期望 |
|---|---|---|
| 1 | `node scripts/ref-check.js .` | 十一项通过，末行 `RESULT: pass`，退出码 0 |
| 2 | `bash scripts/install.sh --check` | 三个 skill 各一行状态，scripts 段含 `roster-check` |
| 3 | `node scripts/code-health.js .` | 无超限项，无相对恶化，末行 `RESULT: report` |
| 4 | `node scripts/governance-check.js .` | `verdict: ok` |
| 5 | `node --check scripts/roster-check.js` 与 `node --check scripts/ref-check.js` | 语法通过 |

## 2. 结构验证

| 项 | 判定 |
|---|---|
| 两个 skill 目录存在且各含 `SKILL.md` | 目录与文件存在 |
| 两个 `SKILL.md` 的 frontmatter 含 `disable-model-invocation: true` | 逐字命中 |
| 两个 `SKILL.md` 的一级标题集合与契约一致 | 逐项命中 |
| `spec` 新增节编号为 17，三级标题 17.1 至 17.7 齐备 | 逐项命中 |
| `templates-rebuild.md` 四个模板节齐备 | 逐项命中 |
| `templates.md` 末尾有指向 `templates-rebuild.md` 的指针 | 逐字命中 |
| `ref-check.js` 行数低于 430 | 行数统计 |

## 3. 代理验收

| 代理 | 验收内容 | 期望结论 |
|---|---|---|
| ddd-doc-sync | 巡检新增 skill、规范新增节、模板新增文件与安装脚本声明的一致性 | 漂移清单为空，或仅存与本轮无关项 |
| ddd-auditor | 审计本轮新增声明的消费方与验证手段，含两个 skill、四个模板、`roster-check.js` | 无新增无消费方声明 |

两份报告由根会话按建议归档名落盘至 `docs/audits/`。

## 4. 实机验证

`disable-model-invocation` 的「模型不自动选中」无法离线判定，须由用户在一次会话中确认。

验证方式：不使用 `/skill:name` 触发，观察模型是否会自动读取这两个 skill 的正文。期望为不自动读取。

该验证列入交付说明，由用户执行。离线只校验 frontmatter 字段存在。

## 5. 验收标准到证据映射

| AC | 证据 |
|---|---|
| AC-1 不自动选中 | 结构验证的 frontmatter 项加实机验证 |
| AC-2 前置检查完备 | 契约核对加人工核查 `SKILL.md` 前置检查节 |
| AC-3 回溯点持久化 | 模板字段核对 |
| AC-4 锚点冻结门不可跳过 | `SKILL.md` 人工门节核对加规范条款核对 |
| AC-5 废弃声明完整 | 模板核对加 auditor 报告 |
| AC-6 等价性以 AC 全量回归 | 规范条款核对 |
| AC-7 skill 清单一致 | 机械验证第 1 项与第 2 项，即 C11 与 `--check` |
| AC-8 既有流程未削弱 | 机械验证第 3 项与第 4 项，加十一项校验全通过 |

## 6. 风险与回退

| 风险 | 防护 |
|---|---|
| 安装脚本清单化误删用户自有 skill | 卸载只按白名单逐目录移除，不递归删除 `skills/` 目录 |
| `install.bat` 含非 ASCII 导致 cmd 解析错乱 | 新增内容保持纯 ASCII |
| 新增 skill 削弱既有自动路由 | `disable-model-invocation` 隔离，既有 skill 与本方法论流程不变 |
| `ref-check` 行数逼近阈值 | 清单校验抽为 `roster-check.js`，交付后行数须低于 430 |
| 规范新增节影响既有引用 | C1 复算节标题集合，全量校验回归 |
| 两个 skill 的规范依赖断链 | 引用采用绝对路径，与该仓库既有代理写法一致；安装脚本保证 `ddd-methodology` 一并安装 |

## 7. 版本收尾

1. `CHANGELOG.md` 新增 v2.6.0 条目。
2. 结构健康度量写入 `docs/health.json`。
3. 打 tag `v2.6.0`。
4. 重跑安装脚本同步部署面，`--check` 复验三个 skill 与 `roster-check`。
