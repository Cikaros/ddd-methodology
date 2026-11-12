---
doc: design
level: file
target: src/lib/shell-encoding.ts
status: frozen
landed: true
covers: [powershellEncodingPrefix, isPowerShellShell]
depends: [assets/commands.json]
updated: 2026-11-12
---

# 文件设计：src/lib/shell-encoding.ts（PowerShell 输出编码适配 · 环境适配）

## 1. 定位与边界

- **职责**：为 **Windows PowerShell** 生成一段**命令前缀**，把 `[Console]::OutputEncoding` / `InputEncoding` 设为 UTF-8，消除「PS 按 GBK 输出、宿主按 UTF-8 读」导致的**中文乱码**。
- **边界内**：**纯函数**——判定是否 PowerShell、返回前缀字符串。
- **边界外**：注入与否、注入到哪（`src/index.ts` 的 `shell.hook("create.before")`）；开关（`ctx.options`）。

## 2. 背景（已实测，非转述）

| 项 | 实测真值 |
|---|---|
| 根因 | PowerShell 5.1 默认按 **GBK(cp936)** 输出（`d6 d0 ce c4`）；宿主按 **UTF-8** 解码 → 乱码 |
| 可修 | `[Console]::OutputEncoding=[Text.Encoding]::UTF8` 即令输出为 UTF-8 字节（`e4 b8 ad …`） |
| 落点真值 | `shell.hook("create.before")` 的 `ev.shell` = `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.EXE`；`ev.command` 可变 |
| 安全性 | 前缀**保留退出码**；**无 stdout 噪音**；多行/分号/管道命令均正常 |

> 这是**环境适配**，非方法论职责；故作为**可关**的补充项，默认仅 Windows 生效。

## 3. 对外暴露接口

| 导出 | 契约 |
|---|---|
| `isPowerShellShell(shell)` | 判定该 shell 是否 PowerShell／pwsh（大小写不敏感；匹配 `powershell` 或 `pwsh`） |
| `powershellEncodingPrefix()` | 返回**单行、无输出噪音、保留退出码**的 PowerShell 前缀（去重可判） |

**前缀形态**（键为**幂等可判**：若命令已含 `ddd:utf8` 标记则不重复注入）：

```
# 幂等标记：$env:DDD_UTF8 或注释
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;try{[Console]::InputEncoding=[System.Text.Encoding]::UTF8}catch{};  # ddd:utf8
```

> 前缀**不含**会打印到 stdout/stderr 的语句；`InputEncoding` 用 `try/catch` 包裹（重定向 stdin 下自证不抛错）。

## 4. 需引入的依赖

无（纯函数；只依赖标准库字符串操作）。

## 5. 调用的模块能力及接口

被 `src/index.ts` 的 `shell.hook("create.before")` 调用：`if (isPowerShellShell(ev.shell) && enabled) ev.command = prefix + ev.command`。

## 6. 已知约束

- **只对 PowerShell**：bash/zsh/sh/Linux/macOS **一律不动**（`isPowerShellShell` 返回 false）。
- **可关**：由 `ctx.options.powershellUtf8`（默认 `true`）控制；关闭即完全不注入。
- **幂等**：命令已含标记（`ddd:utf8`）时不重复注入。
- **不改语义**：前缀只设编码，不动工作目录、不改命令本身；**保留退出码**。
- **不绕扫描器**：走 `shell.create.before`（宿主「改 shell 命令」正门），**不经** `tool.execute.before`（后者会绕开宿主内置 shell 扫描器）。

## 状态

本件为 `frozen`；与实物（`src/lib/shell-encoding.ts`）对账一致。
