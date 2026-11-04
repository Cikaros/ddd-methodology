/**
 * 模型配比命令扩展
 *
 * 目标：以 slash 命令提供模型配比的用户触发入口，使使用者不必记包内脚本路径。
 * 范围：只注册一个命令 ddd-models，把用户参数转交 scripts/apply-models.js 的对应子命令，并原样呈现其输出。
 * 不包含：配比的选择、应用、校验与撤回逻辑——见下两处边界。
 *
 * 边界一：本文件只提供用户入口，不承载任何配比应用逻辑。
 * 边界二：配比逻辑的唯一实现是 scripts/apply-models.js；此处只调用它，不另写一份，以免两处实现漂移。
 *
 * 仅用户触发：不注册为工具，不挂接任何 pi.on 事件，模型无法自动调用；未知参数由脚本自身给出可用选项，
 * 故此处只转交、不内联配比名清单。
 * 脚本路径由共享模块（lib/shared.ts）解析出的包根拼出，不依赖调用方传入，不硬编码绝对路径。
 * 依据：设计 N-13。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { notifyUser } from "./lib/notify.ts";
import { EXEC_TIMEOUT_MS, PACKAGE_ROOT, describeError, exitCodeOf, type ExecResult } from "./lib/shared.ts";

// 脚本位于共享模块解析出的包根之 scripts/ 下，位置不硬编码，也不随本文件层级而变
const SCRIPT_PATH = join(PACKAGE_ROOT, "scripts", "apply-models.js");
// 脚本自身的子命令关键字：命中即原样转交，其余首个参数按配比名处理而前置 apply；此处只列关键字，不列配比名
const SUBCOMMANDS = new Set(["apply", "verify", "clear", "list", "status"]);

export default function (pi: ExtensionAPI) {
	pi.registerCommand("ddd-models", {
		description: "应用或查看模型配比：/ddd-models <配比>、/ddd-models list、/ddd-models status、/ddd-models clear",
		handler: async (args, ctx) => {
			await runModels(pi, ctx, args);
		},
	});
}

// 参数转交：首个非空词为脚本子命令则原样透传，否则按配比名前置于 apply；无参数时交脚本自身给出用法
function buildSubcommand(raw: unknown): string[] {
	const tokens = normalizeArgs(raw).split(/\s+/).filter(Boolean);
	if (!tokens.length) return [];
	if (SUBCOMMANDS.has(tokens[0])) return tokens;
	return ["apply", ...tokens];
}

// 参数形态随宿主版本而异，字符串与数组一并归一为空格分隔文本
function normalizeArgs(raw: unknown): string {
	if (Array.isArray(raw)) return raw.map(String).join(" ");
	return raw === undefined || raw === null ? "" : String(raw);
}

async function runModels(pi: ExtensionAPI, ctx: unknown, raw: unknown): Promise<void> {
	if (!existsSync(SCRIPT_PATH)) {
		notifyUser(ctx, `[ddd-models] 配比脚本缺失：${SCRIPT_PATH}。请确认该文件随包发布，且位置可由包根解析。`, "error");
		return;
	}
	let result: ExecResult | undefined;
	try {
		result = (await pi.exec("node", [SCRIPT_PATH, ...buildSubcommand(raw), "--repo", PACKAGE_ROOT], { timeout: EXEC_TIMEOUT_MS })) as ExecResult;
	} catch (error) {
		notifyUser(ctx, `[ddd-models] 执行失败：${describeError(error)}`, "error");
		return;
	}
	const exitCode = exitCodeOf(result);
	const stdout = result && typeof result.stdout === "string" ? result.stdout : "";
	const stderr = result && typeof result.stderr === "string" ? result.stderr : "";
	const body = [stdout, stderr].filter((part) => part.trim() !== "").join("\n");
	// 脚本输出原文呈现，不改写其内容；非零退出码另起失败提示
	const ok = exitCode === 0 && !(result && result.error);
	const text = ok
		? body.trimEnd() || "[ddd-models] 完成，脚本无输出。"
		: `[ddd-models] 失败（退出码 ${exitCode ?? "未正常返回"}）。\n${body.trimEnd()}`;
	notifyUser(ctx, text, ok ? "info" : "error");
}
