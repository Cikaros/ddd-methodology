# 工具面改造契约

对象文件：`scripts/install.sh`、`scripts/install.bat`、`scripts/uninstall.sh`、`scripts/uninstall.bat`、`scripts/ref-check.js`、新增 `scripts/roster-check.js`、`README.md`、`CHANGELOG.md`。

## 1. 安装脚本的 skill 段改造

现状：四个脚本均把 skill 路径硬编码为 `ddd-methodology` 单一目录，单次复制、单条检查、单目录删除。新增 skill 后无法随装随卸。

改造为清单驱动。

1. 在 `install.sh` 与 `install.bat` 中新增 skill 清单，取值为目录名数组，本轮为 `ddd-methodology`、`ddd-rebuild`、`ddd-refactor`。
2. 安装循环遍历该清单，逐个复制 `skill/<名>` 到 `$PI_HOME/skills/<名>`。
3. 存在性检查与 `--check` 输出逐项覆盖清单内每个 skill，各自一行状态。
4. 卸载循环遍历同一清单，逐个移除对应目录。
5. 卸载只移除清单内的目录，不得递归删除整个 `skills/` 目录，防止误删用户自有 skill。该白名单语义须在脚本注释中写明。
6. `install.bat` 与 `uninstall.bat` 的新增内容须保持纯 ASCII，不得含中文，避免 cmd 解析错乱。

## 2. 新增 roster-check.js

理由：`ref-check.js` 现为 448 行，接近 500 行阈值。本轮新增 skill 清单校验，若内联将使行数进一步逼近上限。故把清单类校验抽为独立库，同时降低 `ref-check.js` 行数。

`scripts/roster-check.js` 契约如下。

1. 导出两个函数：代理清单校验与 skill 清单校验。
2. 代理清单校验的判据与 `ref-check` 现有 C5 逐项等价，即 `agents/ddd-*.md` 文件集合与声明文件中的代理名集合双向一致。
3. skill 清单校验的判据为新定义，即 `skill/*/SKILL.md` 的实际目录集合，与安装脚本声明的 skill 清单、`README.md` 结构树声明三者双向一致。
4. 声明文件集合：代理清单沿用 `ref-check` 现有常量；skill 清单为 `scripts/install.sh`、`scripts/install.bat`、`README.md`。
5. 出参为漂移项数组，字段与 `ref-check` 现有漂移项一致。
6. 文件头注释说明目标与范围，并写明不包含：文件遍历之外的语义判断、其他校验项。
7. 仅供 `ref-check` 调用，不提供 CLI。

## 3. ref-check.js 改造

1. C5 改为 require `roster-check.js` 的代理清单校验函数，删除其内联实现。
2. 新增 C11 skill 清单一致性，调用 `roster-check.js` 的 skill 清单校验函数。
3. 校验项由十项变为十一项。
4. 交付后 `ref-check.js` 行数须低于 430 行。
5. 文件头与输出契约同步更新，末行结论与退出码语义不变。

## 4. 安装清单

`roster-check.js` 为库文件，须加入 `install.sh` 与 `install.bat` 的 scripts 段固定文件清单，顺序与 `README.md` 结构树一致。

它不列入 `spec` 的脚本消费契约表，理由同 `decision-tables.js`，即它是库而非 CLI，无独立输出契约。

## 5. README.md 更新

1. 仓库结构树补 `skill/ddd-rebuild/` 与 `skill/ddd-refactor/` 两个目录，以及 `scripts/roster-check.js` 与 `references/templates-rebuild.md`。
2. 安装内容一节补两个 skill，并说明它们随装随卸。
3. 使用一节新增一段，说明两个 skill 由用户显式调用、模型不会自动选中，给出调用形式。

```
/skill:ddd-rebuild     存量重建
/skill:ddd-refactor    定向重构
```

4. 版本管理一节补 `roster-check` 的一句话职责。

## 6. CHANGELOG.md

新增 v2.6.0 条目，记录新增两个 skill、规范新增存量重建节、四个模板、安装脚本清单化、C11 校验，以及验证结论与回溯点约束。

## 7. 变更记录要求

上述文件均被触碰或被新增。`roster-check.js` 的消费方为 `ref-check`，验证手段为 `ref-check` 的 C5 与 C11 实跑，满足声明面铁律。
