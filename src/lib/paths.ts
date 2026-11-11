/**
 * src/lib/paths.ts —— 包根 / 项目根解析（§8.7 路径纪律）。
 *
 * 边界：只依赖标准库。
 * 铁律：随包件取包根，项目件取项目根，二者不得混用同一拼接基准；
 * 缺失 ctx.location.directory 时报错而非静默回落（C-43 教训）。
 */

import { dirname, join, resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** 由 import.meta.url 上溯两级得包根（本文件位于 <包根>/src/lib/paths.ts）。 */
export function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..");
}

/** 取 ctx.location.directory；缺失即抛错，不回落。 */
export function projectRoot(location: { readonly directory?: string } | undefined | null): string {
  const dir = location?.directory;
  if (!dir || !String(dir).trim()) {
    throw new Error("paths: ctx.location.directory 缺失；拒绝回落（避免把件落到错误根）");
  }
  return resolve(String(dir));
}

/** 相对包根拼接（随包件）。 */
export function packagePath(rel: string): string {
  return join(packageRoot(), rel);
}

/** 相对项目根拼接（生成到使用者项目的件）。 */
export function projectPath(root: string, rel: string): string {
  return join(root, rel);
}

/** 候选是否在前缀内（归一化后按路径段判定，大小写不敏感以适配 Windows）。 */
export function within(prefix: string, candidate: string): boolean {
  const p = resolve(prefix);
  const c = resolve(candidate);
  if (p === c) return true;
  const relPath = relative(p, c);
  if (relPath === "") return true;
  if (relPath === ".." || relPath.startsWith(".." + sep) || isAbsolute(relPath)) return false;
  return true;
}
