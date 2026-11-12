/**
 * src/lib/powershell-bom.ts —— .ps1 源码 BOM 适配（环境适配，可关）。
 *
 * 背景（已实测）：PowerShell 5.1 读 `.ps1` 源码时，**无 BOM 即按 ANSI/GBK 解码**；
 * UTF-8 无 BOM 且含中文的脚本 → 常量与语法皆错（报 `Missing closing ')'`）。
 * `chcp`/`OutputEncoding`/`$OutputEncoding`/`-Command` **均无效**（解析早于运行）；
 * **唯一机械修法**：文件带 UTF-8 BOM（`EF BB BF`）。
 *
 * 边界：纯函数（判定与字符串变换）；只依赖标准库。
 * 落点：由 `src/index.ts` 的 `tool.hook("execute.before")` 调用（拦 write 的 content）。
 * 覆盖边界：只拦「模型经 write/edit 工具写文件」；shell/外部进程直接落盘者不在拦截范围（属约定层）。
 */

const BOM = "\uFEFF";

/** 是否 PowerShell 脚本（.ps1，大小写不敏感）。 */
export function isPowerShellScript(path: string | undefined | null): boolean {
  return typeof path === "string" && /\.ps1$/i.test(path);
}

/** 文本是否已以 UTF-8 BOM（U+FEFF）开头。 */
export function hasUtf8Bom(text: string | undefined | null): boolean {
  return typeof text === "string" && text.charCodeAt(0) === 0xfeff;
}

/** 是否需要补 BOM：`.ps1` 且含非 ASCII 且尚无 BOM。 */
export function needsUtf8Bom(path: string | undefined | null, content: string | undefined | null): boolean {
  if (!isPowerShellScript(path)) return false;
  if (typeof content !== "string") return false;
  if (hasUtf8Bom(content)) return false;
  // 含非 ASCII（码点 > 0x7F）才需 BOM；纯 ASCII 无需。
  return /[^\x00-\x7F]/.test(content);
}

/** 在内容最前加 UTF-8 BOM（幂等：已有则不重复）。 */
export function withUtf8Bom(content: string): string {
  return hasUtf8Bom(content) ? content : BOM + content;
}
