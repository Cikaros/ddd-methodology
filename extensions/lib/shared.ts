/**
 * 扩展共享小工具
 *
 * 目标：收敛四个扩展各自的重复小工具，承载包根解析、状态文件相对路径、脚本执行超时、pi.exec 退出码归一、错误描述与安全读文本六项，供扩展复用。
 * 范围：只放与宿主及具体扩展无关的纯工具；无默认导出，不挂接任何事件、不注册工具与命令。
 * 不包含：各扩展的入口与注册逻辑（见同目录上层的 ddd-context、ddd-governance、ddd-tools、ddd-resources 四个文件）。
 *
 * 发现面：本文件位于 extensions/ 的子目录 lib/ 且该目录无 index.ts，pi 只把 extensions/ 下的一层 .ts/.js 文件与含
 *   index.ts 或 index.js 的子目录当作扩展入口（见 pi 文档 extensions 的 Add it to Pi 节），故本文件不会被当作入口加载。
 * 依赖：只用 node 内建模块，不引入宿主包，故任何扩展均可安全导入。
 * 依据：设计 R4 与 N1。
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// 本文件位于 <包根>/extensions/lib/ 下，故自 import.meta.url 回退两级即包根；消费方按同一值拼 skills/ddd-methodology/scripts/ 下的脚本路径
export const PACKAGE_ROOT = fileURLToPath(new URL("../..", import.meta.url));
// 状态文件相对路径：注入矩阵的节点键、H-2 的当前阶段与未完成项采集均据此定位，本常量为唯一声明处
export const STATE_FILE_REL = join("docs", ".ddd-state.json");
// 脚本执行的统一超时：既有可用性冒烟的网络请求，也有机械校验的长任务，留足预算，超时一律按执行失败处理
export const EXEC_TIMEOUT_MS = 120_000;

// 宿主 pi.exec 的返回形态：字段一律可选，按需读取；与退出码归一函数配套，供扩展统一解析执行结果
export type ExecResult = { code?: unknown; stdout?: unknown; stderr?: unknown; error?: unknown };

// 退出码归一：取脚本真实退出码 code，未执行或未正常返回一律为 null，使各扩展的「执行失败」判定口径一致
export function exitCodeOf(result: ExecResult | undefined): number | null {
	return result && typeof result.code === "number" ? result.code : null;
}

// 错误描述：优先取 error.message，其余一律 String(error)，避免把异常对象原样拼进用户可见文本
export function describeError(error: unknown): string {
	if (error && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message;
	return String(error);
}

// 安全读文本：文件缺失或读取失败一律回 null 绝不抛错；守卫估算行数与状态文件读取共用同一读取口径
export function readText(path: string): string | null {
	try {
		return existsSync(path) ? readFileSync(path, "utf8") : null;
	} catch {
		return null;
	}
}
