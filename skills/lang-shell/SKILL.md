---
name: lang-shell
description: Shell 语言技能，只承载 shellcheck 判不了或反直觉的语义条目，可机械判定的条目落 assets 配置基线。当节点为 detail-design、implement 或 defect-fix 且涉及 .sh 或任何脚本文件，需要决定 set -e 策略、可移植性目标、shebang、管道子 shell 作用域、trap 清理、函数作用域与退出码判断时读本技能。
---

# Shell 语义约束与配置资产

本技能只收不可机械判定或反直觉的条目：`set -euo pipefail` 的使用与局限、可移植性目标择一、shebang 择一、管道子 shell 的变量作用域、`IFS`/`read` 解析、`trap` 清理、函数内作用域、诊断输出通道、命名约定、只读保护、文件头注释、`main` 封装与退出码判断。未加引号展开（SC2086）、命令替换引号（SC2046）、`cd` 未判成败（SC2164）、`$@`/`$*` 与 `$(())/$[]` 等可机械判定的条目一律落入 `assets/shellcheckrc` 与 ShellCheck 默认规则集，本正文不重述。

## 何时用

1. 在 detail-design、implement、defect-fix 节点撰写或修改 shell 脚本，需要决定错误处理策略、可移植性目标或进程清理时。
2. 判断一个 shell 条目该由 shellcheck 机械拦还是只能靠人判断时。
3. 需要落地 Shell 配置基线，或核对某条目是否已被基线覆盖时。

## 做什么

1. **`set -euo pipefail` 的使用与局限**：脚本开头通常启用严格模式，但 `set -e` 在条件上下文、`&&`/`||` 左操作数、命令替换与管道非末段中不触发退出，故关键失败仍须显式判断，不得仅靠 `set -e` 兜底。（官方出处：Bash 手册 `set` 内建，https://www.gnu.org/software/bash/manual/bash.html#The-Set-Builtin ；shellcheck SC2310 https://www.shellcheck.net/wiki/SC2310 ）
2. **可移植性目标择一**：脚本在项目内择一目标——POSIX `sh` 可移植，或 `bash` 扩展可用；择一后不得混用非目标特性，用 `shellcheck` 的 `shell=` 声明目标。（官方出处：POSIX Shell 命令语言，https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html ）
3. **shebang 择一**：需可移植用 `#!/bin/sh`；需特定解释器用 `#!/usr/bin/env bash` 一类经 `env` 解析 PATH 的形式。shebang 与第 2 条的可移植性目标一致，普通脚本不使用 SUID/SGID 位。（官方出处：Bash 手册「调用 Bash」，https://www.gnu.org/software/bash/manual/bash.html#Invoking-Bash ；Google Shell 风格指南 https://google.github.io/styleguide/shellguide.html#suid-sgid ）
4. **管道子 shell 的作用域**：管道每段在子 shell 执行，其中对变量的赋值不外泄到父 shell；需在父 shell 保留结果时改用进程替换、`while read` 重定向或临时文件。（官方出处：Bash 手册「管道」，https://www.gnu.org/software/bash/manual/bash.html#Pipelines ）
5. **`IFS` 与 `read` 解析**：按行读取用 `while IFS= read -r line`，`IFS=` 保留首尾空白、`-r` 禁反斜杠转义；按字段拆分前显式设 `IFS` 并在用后复原。（官方出处：POSIX `read` 工具，https://pubs.opengroup.org/onlinepubs/9699919799/utilities/read.html ）
6. **`trap` 清理**：临时文件、锁与后台进程须在 `trap` 中于 `EXIT`（及需要时的 `INT`/`TERM`）清理解除，避免异常退出遗留副作用。（官方出处：POSIX Shell 命令语言 `trap`，https://pubs.opengroup.org/onlinepubs/9699919799/utilities/V3_chap02.html#trap ）
7. **函数内变量声明为局部**：函数内变量用 `local` 限定作用域，否则默认污染全局；无 `local` 多数检查器不报，属易漏项。（官方出处：Google Shell 风格指南「局部变量」，https://google.github.io/styleguide/shellguide.html#use-local-variables ）
8. **诊断信息走 STDERR**：错误与诊断信息输出到 STDERR（`>&2` 或 `printf ... >&2`），面向管道的数据才走 STDOUT；混流会污染下游消费。（官方出处：Google Shell 风格指南「STDOUT 与 STDERR」，https://google.github.io/styleguide/shellguide.html#stdout-vs-stderr ）
9. **命名约定分清作用域**：函数与普通变量用小写加下划线，环境变量与常量用全大写加下划线；两类命名混用会让「可导出」与「局部」边界模糊。（官方出处：Google Shell 风格指南「命名约定」，https://google.github.io/styleguide/shellguide.html#naming-conventions ）
10. **只读变量加保护**：项目级常量与不应改写的变量用 `readonly` 或 `declare -r` 声明，防止误赋值；只读保护非默认，模型易省。（官方出处：Google Shell 风格指南「常量、环境变量与只读变量」，https://google.github.io/styleguide/shellguide.html#constants-environment-variables-and-readonly-variables ）
11. **文件头注释具名**：脚本文件头注释说明用途、作者与依赖（含 `bash`/工具版本要求），供后续读者与自动化判定运行前提；无检查器，模型易缺。（官方出处：Google Shell 风格指南「文件头」，https://google.github.io/styleguide/shellguide.html#file-header ）
12. **主逻辑封装进 `main`**：主逻辑封装进 `main` 函数并在文件末尾调用，便于测试与按需 source；平铺直写的顶层副作用难以复用。（官方出处：Google Shell 风格指南「main」，https://google.github.io/styleguide/shellguide.html#main ）
13. **退出码直接内联判断**：判断命令成败直接内联——`if cmd; then` 或 `case`，不迂回写成 `if [ $? -eq 0 ]`；后者易被中间命令污染且检查器只部分覆盖。（官方出处：shellcheck SC2181，https://www.shellcheck.net/wiki/SC2181 ）

## 不做什么

1. 不写变量引用加引号、命令替换加引号、`cd` 成败判断、命令存在性判断、`$@`/`$*` 细分、`$(())/$[]` 升级与 `-a`/`-o` 连词，那些是机械可判定条目，只在 `assets/shellcheckrc` 与 ShellCheck 默认规则集定义一次。
2. 不承载宿主 bash 工具的易错用法与项目脚本调用约定，那些属 tool-bash。
3. 不承载 PowerShell 条目，那些属 lang-powershell。
4. 不收录模型已下意识遵守的通用写法。
5. 不以本技能替代派发任务文本。
