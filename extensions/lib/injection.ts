/**
 * 三维注入矩阵的纯逻辑与落点
 *
 * 目标：把注入矩阵的解析、按节点取行、三维解析与去重、语言维度解析收敛为一处实现，供 ddd-resources
 *   （写 systemPromptOptions.skills）与 ddd-context（写任务引导 section）共用，避免两处注入口径漂移。
 * 范围：矩阵文本解析、状态文件节点键解析、约束/语言/工具三维解析与去重、语言名与源文件扩展名映射、任务引导文本构造，
 *   以及矩阵与状态文件的读盘落点；矩阵落 skills/ddd-methodology/assets/injection-matrix.json。
 * 不包含：宿主事件形状的取字段（由各扩展自行取）、守卫判定（见同目录 guards.ts）、矩阵与技能清单的一致性校验（属域五脚本）。
 *
 * 语言维度两个取值标记语义：「项目语言栈」取架构声明中的全部语言；「任务涉及语言」取任务文本路径扩展名匹配到的语言，
 *   匹配不到即退回项目语言栈。语言取值在运行期解析为 lang-<语言> 技能名后按技能名去重。
 * 本文件位于 extensions/lib/，该目录无 index.ts，不被宿主当作扩展入口加载。
 * 依据：设计 DESIGN-extensions.md 第三节、DESIGN-scheduling.md 第五节。
 */

import { join } from "node:path";
import { PACKAGE_ROOT, readText } from "./shared.ts";

export const PROJECT_LANGUAGE_STACK = "项目语言栈";
export const TASK_LANGUAGE = "任务涉及语言";

export const MATRIX_PATH = join(PACKAGE_ROOT, "skills", "ddd-methodology", "assets", "injection-matrix.json");
export const STATE_REL = join("docs", ".ddd-state.json");
export const ARCHITECTURE_REL = "ARCHITECTURE.md";

// 任务文本候选字段：宿主 before_agent_start 事件形状未定，按序取第一个非空字符串，取不到即空串（语言维度退回项目语言栈）
const TASK_TEXT_FIELDS = ["prompt", "taskText", "task", "message", "text", "input"];

export function extractTaskText(event: unknown): string {
	if (!event || typeof event !== "object") return "";
	for (const field of TASK_TEXT_FIELDS) {
		const value = (event as Record<string, unknown>)[field];
		if (typeof value === "string" && value.trim() !== "") return value;
	}
	return "";
}

// 矩阵行：三维取值均为技能名列表，缺省视作空列表
export type MatrixRow = { constraint?: unknown; language?: unknown; tool?: unknown };
export type Matrix = Record<string, MatrixRow>;

// 六种语言与 DESIGN-skills.md 第二节同集；name 为归一语言名，skill 为语言技能名，extensions 为源文件扩展名
export const LANGUAGES: ReadonlyArray<{ name: string; skill: string; extensions: readonly string[] }> = [
	{ name: "python", skill: "lang-python", extensions: ["py"] },
	{ name: "java", skill: "lang-java", extensions: ["java"] },
	{ name: "javascript", skill: "lang-javascript", extensions: ["js", "jsx", "mjs", "cjs"] },
	{ name: "typescript", skill: "lang-typescript", extensions: ["ts", "tsx", "mts", "cts"] },
	{ name: "shell", skill: "lang-shell", extensions: ["sh", "bash", "zsh"] },
	{ name: "powershell", skill: "lang-powershell", extensions: ["ps1", "psm1", "psd1"] },
];

// 语言别名归一表：接受常见简写与 lang- 技能名，统一到 LANGUAGES 的 name
const LANGUAGE_ALIASES: Record<string, string> = {
	js: "javascript",
	ts: "typescript",
	pwsh: "powershell",
	ps1: "powershell",
	bash: "shell",
	sh: "shell",
	zsh: "shell",
};

function normalizeLanguageToken(token: string): string | null {
	const normalized = token.trim().toLowerCase().replace(/^lang-/, "");
	const name = LANGUAGE_ALIASES[normalized] ?? normalized;
	return LANGUAGES.some((lang) => lang.name === name) ? name : null;
}

function skillOfLanguage(name: string): string | null {
	const found = LANGUAGES.find((lang) => lang.name === name);
	return found ? found.skill : null;
}

// 维度取值归一为技能名数组：非数组或非字符串项一律剔除，避免矩阵形状异常导致注入污染
export function toSkillNames(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === "string" && item.trim() !== "")
		.map((item) => item.trim());
}

// 矩阵文本解析：缺失、非 JSON、非对象或空对象一律回 null，由调用方退回代理 frontmatter 的 skills
export function parseMatrix(text: string | null): Matrix | null {
	if (typeof text !== "string" || text.trim() === "") return null;
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return null;
	}
	if (!data || typeof data !== "object" || Array.isArray(data)) return null;
	const matrix: Matrix = {};
	for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
		if (key === "" || !value || typeof value !== "object" || Array.isArray(value)) continue;
		matrix[key] = value as MatrixRow;
	}
	return Object.keys(matrix).length > 0 ? matrix : null;
}

export function rowForNode(matrix: Matrix | null, node: string | null): MatrixRow | null {
	if (!matrix || typeof node !== "string" || node === "") return null;
	const row = matrix[node];
	return row && typeof row === "object" ? row : null;
}

// 当前节点键取状态文件的 lastStage；状态文件缺失、损坏或字段非字符串一律回 null，由调用方退回 frontmatter
export function nodeKeyOf(stateText: string | null): string | null {
	if (typeof stateText !== "string" || stateText.trim() === "") return null;
	let state: unknown;
	try {
		state = JSON.parse(stateText);
	} catch {
		return null;
	}
	const lastStage = (state as { lastStage?: unknown } | null)?.lastStage;
	return typeof lastStage === "string" && lastStage !== "" ? lastStage : null;
}

// 技能名合并去重：保持首次出现顺序，空值与非字符串剔除，用于三维去重与同 run 不重复注入
export function mergeSkills(...lists: ReadonlyArray<readonly string[] | undefined>): string[] {
	const seen = new Set<string>();
	const merged: string[] = [];
	for (const list of lists) {
		if (!Array.isArray(list)) continue;
		for (const name of list) {
			if (typeof name !== "string") continue;
			const trimmed = name.trim();
			if (trimmed === "" || seen.has(trimmed)) continue;
			seen.add(trimmed);
			merged.push(trimmed);
		}
	}
	return merged;
}

// 任务涉及语言：扫任务文本中形如 .ext 的扩展名，命中语言即收，按 LANGUAGES 顺序返回规范语言名
export function languagesFromText(text: string | null): string[] {
	if (typeof text !== "string" || text === "") return [];
	const hit = new Set<string>();
	const pattern = /\.([a-z][a-z0-9]*)\b/gi;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text)) !== null) {
		const ext = match[1].toLowerCase();
		const found = LANGUAGES.find((lang) => lang.extensions.includes(ext));
		if (found) hit.add(found.name);
	}
	return LANGUAGES.filter((lang) => hit.has(lang.name)).map((lang) => lang.name);
}

// 项目语言栈：扫架构声明中的语言名、lang- 技能名与常见别名，按 LANGUAGES 顺序返回规范语言名；扫描失败即空数组
export function parseDeclaredLanguages(text: string | null): string[] {
	if (typeof text !== "string" || text === "") return [];
	const hit = new Set<string>();
	for (const lang of LANGUAGES) {
		if (new RegExp(`(^|[^a-z0-9])${lang.name}([^a-z0-9]|$)`, "i").test(text)) hit.add(lang.name);
		else if (new RegExp(`(^|[^a-z0-9])lang-${lang.name}([^a-z0-9]|$)`, "i").test(text)) hit.add(lang.name);
	}
	for (const [alias, name] of Object.entries(LANGUAGE_ALIASES)) {
		if (new RegExp(`(^|[^a-z0-9])${alias}([^a-z0-9]|$)`, "i").test(text)) hit.add(name);
	}
	return LANGUAGES.filter((lang) => hit.has(lang.name)).map((lang) => lang.name);
}

// 语言维度解析：两取值标记按语义展开，直接写语言名者按别名归一；结果解析为 lang-<语言> 技能名并去重
export function resolveLanguageSkills(
	markers: unknown,
	ctx: { projectLanguages: string[]; taskLanguages: string[] },
): string[] {
	const names: string[] = [];
	for (const marker of toSkillNames(markers)) {
		if (marker === PROJECT_LANGUAGE_STACK) names.push(...ctx.projectLanguages);
		else if (marker === TASK_LANGUAGE) names.push(...(ctx.taskLanguages.length > 0 ? ctx.taskLanguages : ctx.projectLanguages));
		else {
			const canonical = normalizeLanguageToken(marker);
			if (canonical) names.push(canonical);
		}
	}
	return mergeSkills(names.map((name) => skillOfLanguage(name) ?? name));
}

// 三维合并去重：约束与工具维度直接为技能名，语言维度解析后为技能名
export function resolveInjectedSkills(
	row: MatrixRow | null,
	ctx: { projectLanguages: string[]; taskLanguages: string[] },
): string[] {
	if (!row || typeof row !== "object") return [];
	return mergeSkills(toSkillNames(row.constraint), resolveLanguageSkills(row.language, ctx), toSkillNames(row.tool));
}

// 源文件路径到语言名；非六种语言回 null，由守卫放行
export function languageOfPath(path: string): string | null {
	if (typeof path !== "string") return null;
	const name = path.split(/[\\/]/).pop() ?? "";
	const dot = name.lastIndexOf(".");
	if (dot <= 0) return null;
	const ext = name.slice(dot + 1).toLowerCase();
	const found = LANGUAGES.find((lang) => lang.extensions.includes(ext));
	return found ? found.name : null;
}

// 任务引导 section 正文：与技能注入同源，均按节点键取行；节点为空即不注入
export function buildTaskGuidance(node: string, skills: string[]): string | null {
	if (typeof node !== "string" || node === "") return null;
	const lines = [`当前节点：${node}`];
	if (skills.length > 0) {
		lines.push(`本节点按注入矩阵注入的技能：${skills.join("、")}。按需读取其正文，勿预载全部技能。`);
	} else {
		lines.push("本节点不注入额外技能，按主技能 ddd-methodology 的节点序列推进即可。");
	}
	lines.push("矩阵按节点键取行，语言维度由项目语言栈与任务文本路径解析；读取时机与节点引导见主技能 ddd-methodology 的 references。");
	return lines.join("\n");
}

// ---- 读盘落点：与纯逻辑同处，避免两扩展各拼一次路径 ----

export function loadMatrixText(): string | null {
	return readText(MATRIX_PATH);
}

export function readStateText(cwd: string): string | null {
	return typeof cwd === "string" && cwd !== "" ? readText(join(cwd, STATE_REL)) : null;
}

export function readArchitectureText(cwd: string): string | null {
	return typeof cwd === "string" && cwd !== "" ? readText(join(cwd, ARCHITECTURE_REL)) : null;
}

// 当前节点的一次性解析：矩阵缺失或节点无对应行时回 null，调用方据此退回代理 frontmatter 的 skills
export function computeNodeInjection(
	cwd: string,
	taskText: string,
): { node: string; row: MatrixRow; skills: string[] } | null {
	const matrix = parseMatrix(loadMatrixText());
	const node = nodeKeyOf(readStateText(cwd));
	const row = rowForNode(matrix, node);
	if (!node || !row) return null;
	const projectLanguages = parseDeclaredLanguages(readArchitectureText(cwd));
	const taskLanguages = languagesFromText(taskText);
	return { node, row, skills: resolveInjectedSkills(row, { projectLanguages, taskLanguages }) };
}
