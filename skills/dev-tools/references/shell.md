# shell 使用约定

## 跨 shell

- `sh`/`zsh`/`bash`：脚本首行 shebang；用 `set -euo pipefail`（bash/zsh）。
- `pwsh`（PowerShell）：`$ErrorActionPreference = 'Stop'`；路径用引号包裹。

## Windows PowerShell 编码（两个**不同**根因，勿混淆）

1. **控制台输出编码**（治「运行期输出显示乱码」）：PS 5.1 默认按 GBK 输出，宿主按 UTF-8 读 → 乱。
   修：`[Console]::OutputEncoding=[System.Text.Encoding]::UTF8`（本插件经 `shell.create.before` 自动注入，`options.powershellUtf8` 可关）。
2. **`.ps1` 源码编码**（治「脚本语法/常量乱」）：PS 5.1 读 `.ps1` **无 BOM 即按 ANSI/GBK 解码**；UTF-8 无 BOM 且含中文 → 常量与语法皆错（报 `Missing closing ')'` 等）。
   修：**`.ps1` 须存为 UTF-8 带 BOM**。
   - 本插件对**模型经 `write`/`edit` 工具**新建/修改的 `.ps1`（含非 ASCII）自动补 BOM（`options.powershellUtf8` 可关）。
   - **不覆盖**：由 `shell`（`Set-Content`/`Out-File`/`>`）或**外部进程**（node 脚本等）直接落盘的 `.ps1`——那些路径须自行保证带 BOM（`Set-Content -Encoding utf8BOM`，或写文件时前置 `\uFEFF`）。
- 三条运行时设置（`chcp 65001`、`[Console]::OutputEncoding`、`$OutputEncoding`）**修不了第 2 类**（解析早于运行）。

## 用法边界

- 破坏性命令（`rm -rf`、`git push --force`、批量删除、管道到 shell）**交宿主内置 shell 扫描器**（fail-closed）；本技能不建命令黑名单。
- 无法安全分析的动态命令由宿主**返回 scanner error 而非执行**。
- 超时由 `shell.create.before` 事件的 `timeout`（**毫秒**）控制。

## 纪律

- 工具以**具名**启动，不用 `process.execPath`（真宿主里是宿主自身）。
- 不在脚本里硬编码宿主绝对路径；受控件写仓库相对路径（R15）。
