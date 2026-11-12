/**
 * src/lib/shell-encoding.ts —— PowerShell 输出编码适配（环境适配，可关）。
 *
 * 背景（已实测，非转述）：PowerShell 5.1 默认按 GBK(cp936) 输出，而宿主按 UTF-8 解码 →
 * 中文乱码。设 `[Console]::OutputEncoding=[Text.Encoding]::UTF8` 即令输出为 UTF-8 字节。
 *
 * 边界：纯函数（判定是否 PowerShell、返回前缀字符串）；只依赖标准库。
 * 落点：由 `src/index.ts` 的 `shell.hook("create.before")` 调用（宿主「改 shell 命令」正门，
 * 不绕内置 shell 扫描器）；开关＝`ctx.options.powershellUtf8`（默认 true）。
 */

/** **幂等标记**：前缀自带该标记；调用方（及本件的 `hasEncodingPrefix`）据此判重，避免重复注入。 */
export const ENCODING_MARKER = "ddd:utf8";

/**
 * 判定该 shell 是否 PowerShell／pwsh（大小写不敏感）。
 * 例：`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.EXE` → true；`/bin/bash` → false。
 */
export function isPowerShellShell(shell: string | undefined | null): boolean {
  if (!shell) return false;
  return /(^|[\\/])(powershell|pwsh)(\.exe)?$/i.test(shell) || /(powershell|pwsh)(\.exe)?$/i.test(shell);
}

/**
 * 返回 PowerShell 编码前缀（**单行、无 stdout/stderr 噪音、保留退出码**）。
 * - 设 OutputEncoding（主修）与 InputEncoding（次修，try/catch 包裹：重定向 stdin 下不抛错）。
 * - 以注释携带**幂等标记** `ddd:utf8`。
 */
export function powershellEncodingPrefix(): string {
  return `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;try{[Console]::InputEncoding=[System.Text.Encoding]::UTF8}catch{}; # ${ENCODING_MARKER}`;
}

/** 命令是否已含编码前缀（幂等判重）。 */
export function hasEncodingPrefix(command: string | undefined | null): boolean {
  return typeof command === "string" && command.includes(ENCODING_MARKER);
}

/**
 * 幂等注入：**仅当** shell 是 PowerShell（`isEnabled` 由调用方按 options 传）且命令未含前缀时，
 * 在命令前拼上前缀；否则原样返回。纯函数，不读 options（保持本层零宿主依赖）。
 */
export function applyEncodingPrefix(shell: string | undefined | null, command: string, isEnabled: boolean): string {
  if (!isEnabled || !isPowerShellShell(shell) || hasEncodingPrefix(command)) return command;
  return `${powershellEncodingPrefix()}\n${command}`;
}
