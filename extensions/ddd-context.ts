/**
 * 会话上下文扩展
 *
 * 目标：让会话与子代理拿到必要上下文，并确认运行前提成立。其一，把包内全局规则注入系统提示的一个 section；
 *   其二，启动时探测 pi-subagents 的 subagent 工具是否可用，缺失则大声报错但不阻断启动。
 * 范围：仅 before_agent_start 的 section 注入与 session_start 的依赖探测两项。
 * 不包含：子代理工具白名单、机械校验工具注册（见同目录 ddd-tools.ts）、结构治理守卫（见同目录 ddd-governance.ts）。
 *
 * 注入方式：以 `sections.ddd_global_rules` 就地叠加。返回 replacement systemPrompt 会摧毁 section 机制并使 prompt 缓存失效，故严禁。
 * 规则正文在会话开始时读盘一次并缓存，其后每轮只读缓存，不在每轮重复读盘；文件缺失或读取失败一律静默跳过。
 *
 * 生效范围：根会话与后台子代理；前台子代理不加载 ambient 扩展，本扩展对其不生效。
 * 依据：设计 N-3 与 N-6。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SECTION_NAME = "ddd_global_rules";
const SUBAGENT_TOOL = "subagent";
const GLOBAL_RULES_FILE = fileURLToPath(new URL("../global/APPEND_SYSTEM.md", import.meta.url));
const PI_SUBAGENTS_INSTALL = "pi install npm:pi-subagents";

// 规则正文缓存：undefined 表示尚未加载，null 表示文件缺失或读取失败，字符串为剥离标记后的正文
let rulesCache: string | null | undefined;

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		loadRules(); // 会话开始时读一次盘，供整个会话复用
		probeSubagent(pi, ctx);
	});

	pi.on("before_agent_start", (event) => {
		const body = loadRules();
		if (!body) return;
		const sections = event.systemPromptOptions?.sections;
		if (!sections) return;
		sections[SECTION_NAME] = body;
	});
}

// 读盘一次并缓存：文件缺失或读取失败一律返回 null，绝不抛错阻断会话
function loadRules(): string | null {
	if (rulesCache !== undefined) return rulesCache;
	rulesCache = readRulesBody();
	return rulesCache;
}

function readRulesBody(): string | null {
	try {
		const body = stripNonBody(readFileSync(GLOBAL_RULES_FILE, "utf8"));
		return body === "" ? null : body;
	} catch {
		return null;
	}
}

// 剥离标记行与其它非正文注释，只留规则正文；单行与跨行 HTML 注释一并去除
function stripNonBody(text: string): string {
	const kept: string[] = [];
	let inComment = false;
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (inComment) {
			if (trimmed.includes("-->")) inComment = false;
			continue;
		}
		if (trimmed.startsWith("<!--")) {
			if (!trimmed.includes("-->")) inComment = true;
			continue;
		}
		kept.push(line);
	}
	return kept.join("\n").trim();
}

// 前置依赖探测：优先 getAllTools，不可用退回 getActiveTools；两者皆无则无法判定，保持静默
function probeSubagent(pi: ExtensionAPI, ctx: unknown): void {
	const names = collectToolNames(pi);
	if (names === null || names.includes(SUBAGENT_TOOL)) return;
	notify(
		ctx,
		`缺少前置依赖 pi-subagents：未探测到 ${SUBAGENT_TOOL} 工具，子代理派发不可用。请运行「${PI_SUBAGENTS_INSTALL}」安装后重启 pi。`,
	);
}

function collectToolNames(pi: ExtensionAPI): string[] | null {
	try {
		if (typeof pi.getAllTools === "function") {
			const tools = pi.getAllTools();
			if (Array.isArray(tools)) {
				return tools
					.map((tool) => (tool && typeof tool === "object" ? (tool as { name?: unknown }).name : tool))
					.filter((name): name is string => typeof name === "string");
			}
		}
	} catch {
		// getAllTools 不可用则退回 getActiveTools
	}
	try {
		if (typeof pi.getActiveTools === "function") {
			const names = pi.getActiveTools();
			if (Array.isArray(names)) return names.filter((name): name is string => typeof name === "string");
		}
	} catch {
		return null;
	}
	return null;
}

function notify(ctx: unknown, message: string): void {
	try {
		const ui = (ctx as { ui?: { notify?: (text: string, type?: string) => void } } | undefined)?.ui;
		if (ui && typeof ui.notify === "function") ui.notify(message, "error");
	} catch {
		// 报错本身失败不得升级为会话中断
	}
}
