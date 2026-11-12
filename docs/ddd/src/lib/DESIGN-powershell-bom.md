---
doc: design
level: file
target: src/lib/powershell-bom.ts
status: frozen
landed: true
covers: [needsUtf8Bom, withUtf8Bom, hasUtf8Bom]
depends: [assets/commands.json]
updated: 2026-11-12
---

# 文件设计：src/lib/powershell-bom.ts（.ps1 源码 BOM 适配）

## 1. 定位与边界

- **职责**：判定「**PowerShell 脚本（`.ps1`）且含非 ASCII**」的文件应带 **UTF-8 BOM**，并提供加 BOM 的纯函数；供写钩子机械补 BOM。
- **边界内**：**纯函数**——判定与字符串变换。
- **边界外**：何时/是否施加（`src/index.ts` 的 `tool.execute.before`）；开关（options）。

## 2. 背景（已实测，非转述）

| 项 | 实测真值 |
|---|---|
| 根因 | **PowerShell 5.1 读 `.ps1` 源码时，无 BOM 即按 ANSI/GBK 解码**；文件为 UTF-8 无 BOM 且含中文 → 常量与语法皆错（报 `Missing closing ')'` 等） |
| 修不了 | `chcp 65001`、`[Console]::OutputEncoding=UTF8`、`$OutputEncoding=UTF8`、`-Command` 调用**均无效**（解析早于运行） |
| 唯一机械修法 | 文件**带 UTF-8 BOM**（`EF BB BF`）→ PS 5.1 正确解码 ⇒ 中文正常 |
| 写钩子可行 | 宿主 `write` 工具**保留内容开头的 BOM**；`tool.execute.before` 可改 `event.input`（`write` 的字段＝`path`/`content`，实测） |

> 与「控制台输出编码适配」（`shell-encoding.ts`）是**两个不同根因**：那个治「运行期输出显示」，本件治「源码解析」。二者互补。

## 3. 对外暴露接口

| 导出 | 契约 |
|---|---|
| `isPowerShellScript(path)` | 是否 `.ps1`（大小写不敏感） |
| `hasUtf8Bom(text)` | 文本是否已以 U+FEFF 开头 |
| `needsUtf8Bom(path, content)` | `.ps1` 且含非 ASCII 且**尚无** BOM → true |
| `withUtf8Bom(content)` | 在内容最前加 `\uFEFF`（幂等：已有则不重复） |

## 4. 需引入的依赖

无（纯函数；标准库字符串操作）。

## 5. 调用的模块能力及接口

被 `src/index.ts` 的 `tool.hook("execute.before")` 调用：`write` 且 `needsUtf8Bom(path, content)` → `ev.input.content = withUtf8Bom(content)`。

## 6. 已知约束

- **只针对 `.ps1`**：其它扩展名一律不动（避免给 `.js`/`.json` 等误加 BOM）。
- **只对含非 ASCII**：纯 ASCII 脚本无需 BOM（PS 5.1 亦能正确解析）。
- **幂等**：已带 BOM 不重复加。
- **可关**：由 `options.powershellUtf8`（复用同一开关）控制。
- **覆盖边界（诚实）**：只能拦**模型经 `write`/`edit` 工具**写文件这一路径；由 `shell`（`Set-Content`/`Out-File`）或**外部进程（node 脚本等）**直接落盘的 `.ps1` 不在拦截范围——那属「约定」层（`skills/dev-tools/references/shell.md`）。

## 状态

本件为 `frozen`；与实物（`src/lib/powershell-bom.ts`）对账一致。
