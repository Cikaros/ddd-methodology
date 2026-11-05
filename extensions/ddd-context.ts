/**
 * 会话上下文扩展
 *
 * 目标：让会话与子代理拿到必要上下文，并确认运行前提成立。其一，把包内全局规则注入系统提示的一个 section；
 *   其二，启动时探测 pi-subagents 的 subagent 工具是否可用，缺失则大声报错但不阻断启动；
 *   其三，启动时比对宿主 pi 版本与本包声明的支持范围，不匹配则提示一次，取不到版本即静默跳过；
 *   其四，before_agent_start 内读状态文件取当前节点、读注入矩阵取该节点所在行，注入任务引导 section。
 * 范围：before_agent_start 的全局规则与任务引导两项 section 注入、session_start 的依赖探测与版本比对各一项。
 * 不包含：子代理工具白名单、机械校验工具注册（见同目录 ddd-tools.ts）、结构治理守卫（见同目录 ddd-governance.ts）、技能选取与技能集裁剪（见同目录 ddd-resources.ts）。
 *
 * 任务引导 section 与技能注入同源，均由 lib/injection.ts 按节点键取行；本扩展只取引导文本，不承担技能选取。
 *
 * 注入方式：以 `sections.ddd_global_rules` 就地叠加。返回 replacement systemPrompt 会摧毁 section 机制并使 prompt 缓存失效，故严禁。
 * 规则正文在会话开始时读盘一次并缓存，其后每轮只读缓存，不在每轮重复读盘；文件缺失或读取失败一律静默跳过。
 *
 * 生效范围：根会话与后台子代理；前台子代理不加载 ambient 扩展，本扩展对其不生效。
 * 依据：设计 N-3 与 N-6；版本比对本轮需求见 docs/COMPATIBILITY.md。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { notifyUser } from "./lib/notify.ts";
import { type ExecResult, exitCodeOf } from "./lib/shared.ts";
import { checkVersionInRange } from "./lib/version-range.ts";
import { buildTaskGuidance, computeNodeInjection, extractTaskText } from "./lib/injection.ts";

const SECTION_NAME = "ddd_global_rules";
const GUIDANCE_SECTION_NAME = "ddd_task_guidance";
const SUBAGENT_TOOL = "subagent";
const GLOBAL_RULES_FILE = fileURLToPath(new URL("./rules/global-rules.md", import.meta.url));
const PI_SUBAGENTS_INSTALL = "pi install npm:pi-subagents";
// 声明范围的载体：包根 package.json 的 pi 对象下，键名以 ddd 前缀隔离 pi 自有字段
const PACKAGE_MANIFEST = fileURLToPath(new URL("../package.json", import.meta.url));
const DECLARED_PI_VERSION_KEY = "dddSupportedPiVersion";
// 版本探测的短超时：探测为后台任务，超时或拿不到输出均按取不到处理
const VERSION_PROBE_TIMEOUT_MS = 10_000;

// 规则正文缓存：undefined 表示尚未加载，null 表示文件缺失或读取失败，字符串为剥离标记后的正文
let rulesCache: string | null | undefined;

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		loadRules(); // 会话开始时读一次盘，供整个会话复用
		probeSubagent(pi, ctx);
		void checkPiVersion(pi, ctx); // 版本比对与会话启动无依赖，不 await，避免探测拖慢启动
	});

	pi.on("before_agent_start", (event, ctx) => {
		const sections = event.systemPromptOptions?.sections;
		if (sections) {
			const body = loadRules();
			if (body) sections[SECTION_NAME] = body;
		}
		injectTaskGuidance(event, ctx);
	});
}

// 任务引导 section：读状态文件取节点、读矩阵取行，与技能注入同源；节点、矩阵或缺节任一缺失即不注入，不报错
export function injectTaskGuidance(event: { systemPromptOptions?: { sections?: Record<string, unknown> } }, ctx: unknown): void {
	try {
		const sections = event?.systemPromptOptions?.sections;
		if (!sections) return;
		const cwd = (ctx as { cwd?: unknown } | undefined)?.cwd;
		const injection = computeNodeInjection(typeof cwd === "string" ? cwd : "", extractTaskText(event));
		if (!injection) return;
		const guidance = buildTaskGuidance(injection.node, injection.skills);
		if (guidance) sections[GUIDANCE_SECTION_NAME] = guidance;
	} catch {
		// 引导注入异常一律降级为不注入，不阻断启动
	}
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
	notifyUser(
		ctx,
		`缺少前置依赖 pi-subagents：未探测到 ${SUBAGENT_TOOL} 工具，子代理派发不可用。请运行「${PI_SUBAGENTS_INSTALL}」安装后重启 pi。`,
		"error",
	);
}

// 宿主 pi 版本与本包声明范围的比对：提示层，唯一依赖未文档化运行时途径，故任何一步失败均静默跳过，不报错、不阻断。
// 权威对应关系在 docs/COMPATIBILITY.md，取不到版本不损权威层，故降级无损。
async function checkPiVersion(pi: ExtensionAPI, ctx: unknown): Promise<void> {
	try {
		const declared = readDeclaredRange();
		if (!declared) return;
		const detected = await detectPiVersion(pi);
		if (!detected) return;
		if (checkVersionInRange(detected, declared) !== "out-of-range") return;
		notifyUser(ctx, `本包实测支持的 pi 版本为 ${declared}，当前检测到 pi ${detected}。版本对应关系与建议动作见 docs/COMPATIBILITY.md。`, "warning");
	} catch {
		// 有意降级：取不到版本、解析失败或比对异常均静默跳过，权威信息在 docs/COMPATIBILITY.md，降级无损
	}
}

// 版本获取按序尝试两条运行时途径，任一成功即止；两条都失败回 null，由调用方静默跳过（有意降级）
async function detectPiVersion(pi: ExtensionAPI): Promise<string | null> {
	// 首选：宿主包未文档化的运行时导出 VERSION。不依赖文件系统、PATH 与子进程，故为首选；导出缺失或形状不符即转次选。
	try {
		const mod = (await import("@earendil-works/pi-coding-agent")) as { VERSION?: unknown };
		if (typeof mod.VERSION === "string" && mod.VERSION.trim() !== "") return mod.VERSION.trim();
	} catch {
		// 未文档化导出不可用，转次选途径
	}
	// 次选：pi --version。依赖 process.execPath 指向 pi 本体这一未文档化的 Bun 单文件打包事实；npm 安装形态下 execPath 为 node，该途径失效。
	try {
		const result = (await pi.exec(process.execPath, ["--version"], { timeout: VERSION_PROBE_TIMEOUT_MS })) as ExecResult;
		const stdout = result && typeof result.stdout === "string" ? result.stdout : "";
		if (exitCodeOf(result) === 0) {
			const version = stdout.trim().split(/\s+/).pop() ?? "";
			if (version !== "") return version;
		}
	} catch {
		// 次选失败，回 null
	}
	return null;
}

// 声明范围取包内 package.json 的 pi 自建键，缺失或形状非法一律回 null
function readDeclaredRange(): string | null {
	try {
		const manifest = JSON.parse(readFileSync(PACKAGE_MANIFEST, "utf8")) as { pi?: Record<string, unknown> };
		const value = manifest?.pi?.[DECLARED_PI_VERSION_KEY];
		return typeof value === "string" && value.trim() !== "" ? value : null;
	} catch {
		return null;
	}
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
