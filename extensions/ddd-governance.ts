/**
 * DDD 结构治理运行时守卫
 *
 * 目标：为 DDD 项目补充过程拦截，机械判定结构粒度与测试分离两类门槛，覆盖声明式门禁覆盖不到的过程。
 * 范围：仅当 ctx.cwd 下存在 docs/gates 或声明的设计树根时激活，设计树根缺省回退 docs/design；对普通项目静默，所有处理函数立即返回 undefined。
 *
 * 判定编号摘要，与规范「结构与契约的演进治理」节的守卫判定表逐项一致：
 * - H-1 粒度守卫。触发点：tool_call 的 write/edit。判定条件：估算写入后行数超 500 行。动作：拦截，理由含文件路径、就近 DESIGN 路径与拆解要求。
 * - H-2 测试分离守卫。触发点：tool_call 的 bash。判定条件：命令属窄口径的全量测试调用形态，且 docs/.ddd-state.json 的 lastStage 为 g5-int。动作：拦截，指明全量测试的唯一主体是 ddd-tester。
 * - H-3 义务覆盖守卫。触发点：tool_call 的 write/edit。判定条件：目标为源码文件、任务树已启用，而该文件所属接缝的节点文件缺失或该文件未被任何义务节点覆盖。动作：拦截，理由含节点文件路径与登记方式。覆盖边界：源目录内 DESIGN 组织不在覆盖内，设计树根取 ARCHITECTURE 的声明值，缺省回退 docs/design。
 * - H-4 门禁清零守卫。触发点：tool_call 的 write/edit。判定条件：目标为 docs/gates/ 下的门禁记录，且任务树存在未闭合义务节点。动作：拦截，理由含未闭合节点所在文件与逐项核销要求。
 *
 * 键关系：G5_INT_STAGE 的值为状态文件阶段键集合中的单键，即 docs/.ddd-state.json 的 doneStages 枚举成员之一；ref-check 的 C4 与 --fix 据此比对并单向校验其属于该集合，脚本不改本文件，值变更须人工处理。
 *
 * 阈值承载：基础能力 300 行与文档 200 行阈值由 `code-health` 度量与审计承接，本守卫只拦代码文件 500 行。
 * 运行时例外：文件内显式声明「运行时例外」者放行，未声明不适用。
 *
 * 未设收尾守卫：agent_before_settle 的事件仅含 type、outcome、entries、continue、context，不含回复
 * 文本，无法机械判定报告是否缺节；结构治理回执的强制由代理输出契约与声明式门禁承接。
 *
 * 生效范围：根会话、后台子代理，以及 frontmatter 显式声明 extensions 的前台子代理；未声明的前台子代理不加载 ambient 扩展，本守卫对其不生效。
 * 任何处理函数内的异常一律捕获后返回 undefined 并记警告，守卫自身错误不得阻断正常工具。
 * 依据：规范「粒度与独立性」节、「实现与测试分离」节与「结构与契约的演进治理」节。
 */

import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { notifyUser } from "./lib/notify.ts";
import { describeError, readText } from "./lib/shared.ts";

// 设计树根解析复用脚本侧唯一实现，避免守卫与脚本两套口径；解析失败回退默认根 docs/design
let designRootResolver = null;
try {
	const requireFromExtension = createRequire(import.meta.url);
	designRootResolver = requireFromExtension("../skills/ddd-methodology/scripts/design-root.js").absoluteDesignDir;
} catch {
	designRootResolver = null;
}

// 设计树根的绝对路径：以项目 ARCHITECTURE 的声明为源，解析实现与脚本侧同源；取不到时用默认值
function designRootAbs(root) {
	if (typeof designRootResolver === "function") {
		try {
			const resolved = designRootResolver(root);
			if (resolved && typeof resolved.dir === "string" && resolved.dir !== "") return resolved.dir;
		} catch {
			// 解析异常按默认根处理
		}
	}
	return join(root, "docs", "design");
}

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
	pi.on("before_agent_start", (event, ctx) => {
		const obligations = loadOpenObligations(ctx);
		if (!obligations) return;
		const sections = event.systemPromptOptions?.sections;
		if (!sections) return;
		sections[OBLIGATION_SECTION_NAME] = obligations;
	});

	pi.on("tool_call", async (event, ctx) => {
		try {
			if (!isDddProject(ctx && ctx.cwd)) return undefined;
			const toolName = event && event.toolName;
			if (toolName === "write" || toolName === "edit") {
				const granularity = checkGranularity(event, ctx);
				if (granularity) return granularity;
				const coverage = checkObligationCoverage(event, ctx);
				if (coverage) return coverage;
				return checkGateRecordClearance(event, ctx);
			}
			if (toolName === "bash") return checkFullTestCommand(event, ctx); // H-2
			return undefined;
		} catch (error) {
			notifyUser(ctx, `[ddd-governance] tool_call 判定异常，已放行：${describeError(error)}`, "warning");
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

// 就近 DESIGN 取两种组织方式中先命中者：源目录自身的 DESIGN.md，与声明的设计树根下的镜像路径。
function nearestDesignPath(cwd, absPath) {
	const root = resolve(cwd);
	let dir = dirname(resolve(absPath));
	while (dir === root || dir.startsWith(root + sep)) {
		const rel = dir === root ? "" : dir.slice(root.length + 1);
		const candidates = [join(dir, "DESIGN.md")];
		candidates.push(join(designRootAbs(root), rel, "DESIGN.md"));
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

// ---- H-3 义务覆盖守卫 ----

// 节点文件路径：由声明的设计树根推 docs/board 下的同构路径；不在设计树内返回 null，
// 源目录内 DESIGN 组织因此不在写入强制覆盖内，该边界见规范守卫表 H-3 行的当前覆盖列
function nodesPathFor(designPath, cwd) {
	const root = resolve(cwd);
	const rel = relative(designRootAbs(root), dirname(designPath));
	if (rel.startsWith("..")) return null;
	return join(root, "docs", "board", rel, "NODES.md");
}

// 覆盖判定：节点表覆盖范围列须等于目标相对路径，或以该值为目录前缀，避免子串误命中
function coversFile(nodeText, relFile) {
	for (const line of nodeText.split("\n")) {
		if (!line.trim().startsWith("|")) continue;
		const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
		if (cells.length < 6 || !cells[0] || cells[0] === "节点编号" || /^-+$/.test(cells[0])) continue;
		const coverage = cells[5].replace(/`/g, "").replace(/\/$/, "");
		if (!coverage) continue;
		if (relFile === coverage || relFile.startsWith(coverage + "/")) return true;
	}
	return false;
}

function checkObligationCoverage(event, ctx) {
	const input = (event && event.input) || {};
	const rawPath = input.path ?? input.file_path ?? input.filePath;
	if (typeof rawPath !== "string" || rawPath === "") return undefined;
	const absPath = resolve(ctx.cwd, rawPath);
	if (!isSourceFile(absPath)) return undefined;
	if (!existsSync(join(resolve(ctx.cwd), "docs", "board"))) return undefined; // 任务树未启用即放行
	const designPath = nearestDesignPath(ctx.cwd, absPath);
	if (!designPath) return undefined;
	const nodesPath = nodesPathFor(designPath, ctx.cwd);
	if (!nodesPath) return undefined;
	const nodeText = readText(nodesPath);
	const relFile = relative(resolve(ctx.cwd), absPath).split(sep).join("/");
	if (nodeText === null) {
		return {
			block: true,
			reason: [
				`[H-3 义务覆盖守卫] 任务树已启用但缺少节点文件：${nodesPath}`,
				`就近 DESIGN：${designPath}`,
				"按规范「接口先行与冻结」节的义务核销条，先在节点文件中登记义务节点并写明覆盖范围，再写代码。",
			].join("\n"),
		};
	}
	if (coversFile(nodeText, relFile)) return undefined;
	return {
		block: true,
		reason: [
			`[H-3 义务覆盖守卫] 目标文件未被任何义务节点覆盖：${relFile}`,
			`节点文件：${nodesPath}`,
			"在节点文件中补一条义务节点，覆盖范围列写该文件路径，状态置为进行中并写承接方后重试。",
		].join("\n"),
	};
}

// ---- H-4 门禁清零守卫 ----

// 未闭合义务节点：扫 docs/board 下全部节点文件，取类型为义务且状态为未开始或进行中者
function collectOpenObligations(root) {
	const boardDir = join(root, "docs", "board");
	if (!existsSync(boardDir)) return null;
	const open = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) { walk(full); continue; }
			if (entry.name !== "NODES.md") continue;
			const text = readText(full) || "";
			for (const line of text.split("\n")) {
				if (!line.trim().startsWith("|")) continue;
				const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
				if (cells.length < 5 || !cells[0] || cells[0] === "节点编号" || /^-+$/.test(cells[0])) continue;
				if (cells[2] !== "义务") continue;
				if (cells[4] === "未开始" || cells[4] === "进行中") {
					open.push(`${relative(root, full).split(sep).join("/")} ${cells[0]}（${cells[4]}）`);
				}
			}
		}
	};
	walk(boardDir);
	return open;
}

function checkGateRecordClearance(event, ctx) {
	const input = (event && event.input) || {};
	const rawPath = input.path ?? input.file_path ?? input.filePath;
	if (typeof rawPath !== "string" || rawPath === "") return undefined;
	const root = resolve(ctx.cwd);
	const rel = relative(root, resolve(root, rawPath)).split(sep).join("/");
	if (!rel.startsWith("docs/gates/")) return undefined;
	const open = collectOpenObligations(root);
	if (!open || open.length === 0) return undefined;
	return {
		block: true,
		reason: [
			`[H-4 门禁清零守卫] 任务树存在 ${open.length} 项未闭合义务节点，不得写入门禁记录：${rel}`,
			...open.slice(0, 5),
			"按规范「接口先行与冻结」节的义务核销条逐项核销，未完项转债务并具名承接后再过门。",
		].join("\n"),
	};
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
	const root = resolve(cwd);
	if (existsSync(join(root, "docs", "gates"))) return true;
	return existsSync(designRootAbs(root));
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

// ---- 看板注入 ----

const OBLIGATION_SECTION_NAME = "ddd_open_obligations";

// 启动时注入未闭合节点，使子代理不必依赖记忆；任务树未启用或已清空时不注入
function loadOpenObligations(ctx) {
	try {
		const cwd = ctx && ctx.cwd;
		if (typeof cwd !== "string" || cwd === "") return null;
		const open = collectOpenObligations(resolve(cwd));
		if (!open || open.length === 0) return null;
		return ["任务树未闭合义务节点，逐条核销后方可过门：", ...open].join("\n");
	} catch {
		return null;
	}
}