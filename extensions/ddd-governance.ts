/**
 * DDD 结构治理运行时守卫
 *
 * 目标：为 DDD 项目补充过程拦截，机械判定结构粒度与测试分离两类门槛，覆盖声明式门禁覆盖不到的过程。
 * 范围：仅当 ctx.cwd 下存在 docs/design 或 docs/gates 时激活；对普通项目静默，所有处理函数立即返回 undefined。
 *
 * 判定编号摘要，与规范「结构与契约的演进治理」节的守卫判定表逐项一致：
 * - H-1 粒度守卫。触发点：tool_call 的 write/edit。判定条件：估算写入后行数超 500 行。动作：拦截，理由含文件路径、就近 DESIGN 路径与拆解要求。
 * - H-2 测试分离守卫。触发点：tool_call 的 bash。判定条件：命令属窄口径的全量测试调用形态，且 docs/.ddd-state.json 的 lastStage 为 g5-int。动作：拦截，指明全量测试的唯一主体是 ddd-tester。
 *
 * 阈值承载：基础能力 300 行与文档 200 行阈值由 `code-health` 度量与审计承接，本守卫只拦代码文件 500 行。
 * 运行时例外：文件内显式声明「运行时例外」者放行，未声明不适用。
 *
 * 未设收尾守卫：agent_before_settle 的事件仅含 type、outcome、entries、continue、context，不含回复
 * 文本，无法机械判定报告是否缺节；结构治理回执的强制由代理输出契约与声明式门禁承接。
 *
 * 生效范围：根会话与后台子代理；前台子代理不加载 ambient 扩展，故本守卫对其不生效。
 * 任何处理函数内的异常一律捕获后返回 undefined 并记警告，守卫自身错误不得阻断正常工具。
 * 依据：docs/analysis/method-versioning-governance.md 的硬门禁节；规范「粒度与独立性」节、「实现与测试分离」节、「结构与契约的演进治理」节。
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const GRANULARITY_LINE_LIMIT = 500;
const RUNTIME_EXCEPTION_MARK = "运行时例外";
const STATE_FILE = "docs/.ddd-state.json";
const G5_INT_STAGE = "g5-int";

const SOURCE_EXTENSIONS = new Set([
	"ts", "tsx", "js", "jsx", "mjs", "cjs", "vue", "svelte",
	"py", "go", "rs", "java", "kt", "kts", "cs", "rb", "php", "swift", "scala", "dart", "lua",
	"c", "h", "cc", "cpp", "cxx", "hpp", "csx", "m", "mm", "sql", "sh", "ps1",
]);

// 全量测试调用形态：只收整仓命令的窄口径写法，带文件参数、含管道或串联的形态一律不判定。
const FULL_TEST_COMMANDS = [
	/^(?:npm|pnpm|yarn)\s+(?:run\s+)?test$/i,
	/^node\s+--test$/i,
	/^(?:jest|vitest)\s+run$/i,
	/^pytest$/i,
	/^python\d?(?:\.\d+)?\s+-m\s+pytest$/i,
	/^go\s+test\s+\.\/\.\.\.$/i,
	/^cargo\s+test$/i,
	/^mvn\s+(?:-\S+\s+)*test$/i,
	/^dotnet\s+test$/i,
	/^bun\s+test$/i,
	/^deno\s+test$/i,
];

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		try {
			if (!isDddProject(ctx && ctx.cwd)) return undefined;
			const toolName = event && event.toolName;
			if (toolName === "write" || toolName === "edit") return checkGranularity(event, ctx); // H-1
			if (toolName === "bash") return checkFullTestCommand(event, ctx); // H-2
			return undefined;
		} catch (error) {
			warn(ctx, `tool_call 判定异常，已放行：${describeError(error)}`);
			return undefined;
		}
	});
}

// ---- H-1 粒度守卫 ----

function checkGranularity(event, ctx) {
	const input = (event && event.input) || {};
	const rawPath = input.path ?? input.file_path ?? input.filePath;
	if (typeof rawPath !== "string" || rawPath === "") return undefined;
	const absPath = resolve(ctx.cwd, rawPath);
	if (!isSourceFile(absPath)) return undefined;
	const projected = estimateProjectedLines(absPath, input);
	if (typeof projected !== "number") return undefined;
	if (projected <= GRANULARITY_LINE_LIMIT) return undefined;
	// 规范「粒度与独立性」节的运行时例外须在文件内显式声明；声明即放行，未声明不适用。
	if (typeof input.content === "string" && input.content.includes(RUNTIME_EXCEPTION_MARK)) return undefined;

	const designPath = nearestDesignPath(ctx.cwd, absPath);
	return {
		block: true,
		reason: [
			`[H-1 粒度守卫] 写入后约 ${projected} 行，越过 ${GRANULARITY_LINE_LIMIT} 行粒度阈值：${absPath}`,
			designPath ? `就近 DESIGN：${designPath}` : "未找到就近 DESIGN，请补齐设计文档后再拆解。",
			"规范「粒度与独立性」节要求超 500 行的单文件必须拆解，被多模块依赖的基础能力独立成文件并配套独立单元测试；受平台约束无法拆解者须在文件头显式声明运行时例外。",
			"拆解不得超出 DESIGN 预判，超出属设计偏离走 B 级。规范依据：规范「粒度与独立性」节与「结构与契约的演进治理」节。",
		].join("\n"),
	};
}

function estimateProjectedLines(absPath, input) {
	if (typeof input.content === "string") return countLines(input.content);
	// edit 的输入为 { path, edits: [{ oldText, newText }] }，必须按数组逐条累计增减，否则守卫对编辑路径失效。
	if (Array.isArray(input.edits)) {
		const current = readText(absPath);
		if (typeof current !== "string") return null;
		let lines = countLines(current);
		for (const item of input.edits) {
			if (!item || typeof item.newText !== "string") continue;
			const removed = typeof item.oldText === "string" ? countLines(item.oldText) : 0;
			lines += countLines(item.newText) - removed;
		}
		return Math.max(0, lines);
	}
	// 单字段形态兼容：落点不存在或读不到时按片段低估，只会少拦不会误伤。
	if (typeof input.newText !== "string") return null;
	const incoming = countLines(input.newText);
	const current = readText(absPath);
	if (typeof current !== "string") return incoming;
	const removed = typeof input.oldText === "string" ? countLines(input.oldText) : 0;
	return Math.max(0, countLines(current) - removed) + incoming;
}

// 就近 DESIGN 取两种组织方式中先命中者：源目录自身的 DESIGN.md，与 docs/design 下的镜像路径。
function nearestDesignPath(cwd, absPath) {
	const root = resolve(cwd);
	let dir = dirname(resolve(absPath));
	while (dir === root || dir.startsWith(root + sep)) {
		const rel = dir === root ? "" : dir.slice(root.length + 1);
		const candidates = [join(dir, "DESIGN.md")];
		candidates.push(join(root, "docs", "design", rel, "DESIGN.md"));
		for (const candidate of candidates) {
			if (existsSync(candidate)) return candidate;
		}
		if (dir === root) break;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

// ---- H-2 测试分离守卫 ----

function checkFullTestCommand(event, ctx) {
	const input = (event && event.input) || {};
	if (typeof input.command !== "string") return undefined;
	const normalized = normalizeCommand(input.command);
	if (normalized === null) return undefined;
	if (!FULL_TEST_COMMANDS.some((pattern) => pattern.test(normalized))) return undefined;
	if (readLastStage(ctx.cwd) !== G5_INT_STAGE) return undefined;
	return {
		block: true,
		reason: [
			`[H-2 测试分离守卫] 命令「${normalized}」属全量测试调用形态，当前阶段 lastStage 为 ${G5_INT_STAGE}。`,
			"全量测试的唯一主体是 ddd-tester，G5-INT 与 C 级修复阶段禁止执行全量测试套件。",
			"请改跑所负责接缝的自测，或把全量执行留给 ddd-tester 在测试执行阶段单独串行启动。",
			"规范依据：规范「实现与测试分离」节。",
		].join("\n"),
	};
}

function normalizeCommand(command) {
	let cmd = command.trim().replace(/\s+/g, " ");
	if (cmd === "") return null;
	const cdPrefix = /^cd [^&|;]+ && (.+)$/.exec(cmd);
	if (cdPrefix) cmd = cdPrefix[1].trim();
	cmd = cmd.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s&|;]+ )+/, "").trim();
	// 串联、管道、重定向、子命令替换等形态无法判断是否整仓，一律放行。
	if (cmd === "" || /[&|;`$<>]/.test(cmd)) return null;
	return cmd;
}

function readLastStage(cwd) {
	const text = readText(join(resolve(cwd), STATE_FILE));
	if (typeof text !== "string") return null;
	try {
		const state = JSON.parse(text);
		return state && typeof state.lastStage === "string" ? state.lastStage : null;
	} catch {
		return null;
	}
}

// ---- 共用助手 ----

function isDddProject(cwd) {
	if (typeof cwd !== "string" || cwd === "") return false;
	return existsSync(join(cwd, "docs", "design")) || existsSync(join(cwd, "docs", "gates"));
}

function isSourceFile(filePath) {
	const name = filePath.split(/[\\/]/).pop() || "";
	const dot = name.lastIndexOf(".");
	if (dot <= 0) return false;
	return SOURCE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

function countLines(text) {
	if (typeof text !== "string" || text === "") return 0;
	const trimmed = text.replace(/\n+$/, "");
	return trimmed === "" ? 0 : trimmed.split("\n").length;
}

function readText(path) {
	try {
		return existsSync(path) ? readFileSync(path, "utf8") : null;
	} catch {
		return null;
	}
}

function warn(ctx, message) {
	try {
		if (ctx && ctx.hasUI && ctx.ui && typeof ctx.ui.notify === "function") {
			ctx.ui.notify(`[ddd-governance] ${message}`, "warning");
		} else if (ctx && typeof ctx.log === "function") {
			ctx.log(`[ddd-governance] ${message}`);
		}
	} catch {
		// 记警告本身失败不得升级为错误
	}
}

function describeError(error) {
	if (error && typeof error.message === "string") return error.message;
	return String(error);
}
