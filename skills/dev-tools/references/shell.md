# shell 使用约定

## 跨 shell

- `sh`/`zsh`/`bash`：脚本首行 shebang；用 `set -euo pipefail`（bash/zsh）。
- `pwsh`（PowerShell）：`$ErrorActionPreference = 'Stop'`；路径用引号包裹。

## 用法边界

- 破坏性命令（`rm -rf`、`git push --force`、批量删除、管道到 shell）**交宿主内置 shell 扫描器**（fail-closed）；本技能不建命令黑名单。
- 无法安全分析的动态命令由宿主**返回 scanner error 而非执行**。
- 超时由 `shell.create.before` 事件的 `timeout`（**毫秒**）控制。

## 纪律

- 工具以**具名**启动，不用 `process.execPath`（真宿主里是宿主自身）。
- 不在脚本里硬编码宿主绝对路径；受控件写仓库相对路径（R15）。
