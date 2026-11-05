/**
 * 三维注入矩阵与矩阵裁剪的单元测试
 *
 * 目标：以 node --test 独立验证 extensions/lib/injection.ts 的纯逻辑与 ddd-resources.ts 的注入落点，覆盖——
 *   矩阵文件的二十一行与节点键逐字一致（与 DESIGN-scheduling.md 第五节对照）、矩阵解析的缺省退化、
 *   按节点取行、语言维度两取值标记的解析与退回、三维合并去重、矩阵缺失回退代理 frontmatter 的 skills。
 * 范围：不启动宿主、不派发子代理；临时项目目录用后即删；本文件位于 extensions/lib/，该目录无 index 入口，不会被宿主当作扩展加载。
 * 运行：node --test extensions/lib/injection.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PACKAGE_ROOT } from "./shared.ts";
import {
	MATRIX_PATH,
	PROJECT_LANGUAGE_STACK,
	TASK_LANGUAGE,
	buildTaskGuidance,
	computeNodeInjection,
	languagesFromText,
	mergeSkills,
	nodeKeyOf,
	parseDeclaredLanguages,
	parseMatrix,
	resolveInjectedSkills,
	resolveLanguageSkills,
	rowForNode,
} from "./injection.ts";
import { injectNodeSkills, skillDirectories } from "../ddd-resources.ts";
import { injectTaskGuidance } from "../ddd-context.ts";

const DESIGN_SCHEDULING = join(PACKAGE_ROOT, "docs", "internal", "refactor-0.8.0", "DESIGN-scheduling.md");

// 设计册第五节节点键：取「## 五、三维注入矩阵」首个表格的首列，遇非节点键行即止，避开紧随其后的取值来源表
function docNodeKeys(text: string): string[] {
	const keys: string[] = [];
	let inSection = false;
	let inTable = false;
	for (const line of text.split(/\r?\n/)) {
		if (/^##\s+五、三维注入矩阵/.test(line)) {
			inSection = true;
			continue;
		}
		if (!inSection) continue;
		if (/^##\s/.test(line)) break;
		const match = /^\|\s*([^|]+?)\s*\|/.exec(line);
		if (!match) {
			if (inTable) break;
			continue;
		}
		const first = match[1].trim();
		if (/^[a-z][a-z0-9-]*$/.test(first)) {
			keys.push(first);
			inTable = true;
		} else if (inTable) {
			break;
		}
	}
	return keys;
}

test("注入矩阵文件含二十一行，键与 DESIGN-scheduling.md 第五节逐字一致", () => {
	const matrix = parseMatrix(readFileSync(MATRIX_PATH, "utf8"));
	assert.ok(matrix, "矩阵文件应可解析");
	assert.equal(Object.keys(matrix).length, 21, "矩阵应为二十一行");
	if (existsSync(DESIGN_SCHEDULING)) {
		const expected = docNodeKeys(readFileSync(DESIGN_SCHEDULING, "utf8"));
		assert.equal(expected.length, 21, "设计册节点键应为二十一个");
		assert.deepEqual(Object.keys(matrix), expected, "矩阵键须与设计册节点键同序同集");
	}
});

test("矩阵三行取值与设计册一致：实现注入治理两份加工具，详细设计注入项目语言栈", () => {
	const matrix = parseMatrix(readFileSync(MATRIX_PATH, "utf8"));
	assert.ok(matrix);
	assert.deepEqual(matrix.implement, {
		constraint: ["governance-code", "governance-comment"],
		language: [TASK_LANGUAGE],
		tool: ["tool-bash"],
	});
	assert.deepEqual(matrix["detail-design"], {
		constraint: ["spec-contract", "governance-document"],
		language: [PROJECT_LANGUAGE_STACK],
		tool: [],
	});
	assert.deepEqual(matrix["check-scope"], { constraint: [], language: [], tool: [] });
});

test("矩阵解析的缺省退化：空、非 JSON、非对象、空对象一律回 null", () => {
	assert.equal(parseMatrix(null), null);
	assert.equal(parseMatrix(""), null);
	assert.equal(parseMatrix("not json"), null);
	assert.equal(parseMatrix("[1,2]"), null);
	assert.equal(parseMatrix("{}"), null);
	assert.deepEqual(parseMatrix('{"implement":{"constraint":["tool-bash"]}}'), { implement: { constraint: ["tool-bash"] } });
});

test("按节点取行：矩阵缺失或节点无行一律回 null", () => {
	const matrix = parseMatrix(readFileSync(MATRIX_PATH, "utf8"));
	assert.ok(matrix);
	assert.ok(rowForNode(matrix, "implement"));
	assert.equal(rowForNode(matrix, "no-such-node"), null);
	assert.equal(rowForNode(null, "implement"), null);
	assert.equal(rowForNode(matrix, null), null);
});

test("节点键取状态文件的 lastStage，损坏状态回 null", () => {
	assert.equal(nodeKeyOf('{"lastStage":"implement","channel":"A"}'), "implement");
	assert.equal(nodeKeyOf('{"channel":"A"}'), null);
	assert.equal(nodeKeyOf("{"), null);
	assert.equal(nodeKeyOf(null), null);
});

test("技能名合并去重：跨三维与维内重复均按首次出现去重", () => {
	assert.deepEqual(mergeSkills(["a", "b"], ["b", "c"], ["a", "d"]), ["a", "b", "c", "d"]);
	assert.deepEqual(mergeSkills(["lang-typescript"], ["lang-typescript"], []), ["lang-typescript"]);
	assert.deepEqual(mergeSkills(["a", "", "  ", "a"]), ["a"]);
	assert.deepEqual(mergeSkills(undefined, null as unknown as string[], ["x"]), ["x"]);
});

test("语言维度两取值标记：项目语言栈直取，任务涉及语言匹配不到退回项目语言栈", () => {
	const project = ["typescript", "python"];
	assert.deepEqual(resolveLanguageSkills([PROJECT_LANGUAGE_STACK], { projectLanguages: project, taskLanguages: [] }), [
		"lang-typescript",
		"lang-python",
	]);
	assert.deepEqual(
		resolveLanguageSkills([TASK_LANGUAGE], { projectLanguages: project, taskLanguages: ["typescript"] }),
		["lang-typescript"],
	);
	assert.deepEqual(resolveLanguageSkills([TASK_LANGUAGE], { projectLanguages: project, taskLanguages: [] }), [
		"lang-typescript",
		"lang-python",
	]);
});

test("三维合并去重：实现节点按任务语言解析并去重", () => {
	const row = { constraint: ["governance-code", "governance-comment"], language: [TASK_LANGUAGE], tool: ["tool-bash"] };
	assert.deepEqual(
		resolveInjectedSkills(row, { projectLanguages: ["typescript"], taskLanguages: ["typescript"] }),
		["governance-code", "governance-comment", "lang-typescript", "tool-bash"],
	);
	// 语言维度若与约束维度同名，去重后只留一份
	const dup = { constraint: ["lang-typescript"], language: [TASK_LANGUAGE], tool: [] };
	assert.deepEqual(resolveInjectedSkills(dup, { projectLanguages: ["typescript"], taskLanguages: ["typescript"] }), [
		"lang-typescript",
	]);
});

test("语言名与路径扩展名解析", () => {
	assert.deepEqual(languagesFromText("改 src/core/router.ts 与 scripts/build.py"), ["python", "typescript"]);
	assert.deepEqual(parseDeclaredLanguages("## 语言栈\n\nTypeScript 与 Python"), ["python", "typescript"]);
	assert.deepEqual(parseDeclaredLanguages(""), []);
});

test("任务引导文本：节点存在即有正文，空节点回 null", () => {
	const text = buildTaskGuidance("implement", ["governance-code", "tool-bash"]);
	assert.ok(text && text.includes("implement"));
	assert.ok(text && text.includes("governance-code"));
	assert.equal(buildTaskGuidance("", []), null);
});

// 临时项目：写入状态文件与架构声明，用于验证矩阵裁剪的落点与退回
function makeProject(state: unknown | null, architecture: string | null): string {
	const dir = mkdtempSync(join(tmpdir(), "ddd-inject-"));
	if (state !== null) {
		mkdirSync(join(dir, "docs"), { recursive: true });
		writeFileSync(join(dir, "docs", ".ddd-state.json"), JSON.stringify(state));
	}
	if (architecture !== null) writeFileSync(join(dir, "ARCHITECTURE.md"), architecture);
	return dir;
}

test("computeNodeInjection：有状态与矩阵行时按三维裁剪", () => {
	const dir = makeProject({ lastStage: "implement", channel: "A" }, "## 语言栈\n\nTypeScript\n");
	try {
		const injection = computeNodeInjection(dir, "改 src/x.ts");
		assert.ok(injection);
		assert.equal(injection.node, "implement");
		assert.deepEqual(injection.skills, ["governance-code", "governance-comment", "lang-typescript", "tool-bash"]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("computeNodeInjection：无状态文件或无对应节点行时回 null", () => {
	const dir = makeProject(null, "## 语言栈\n\nTypeScript\n");
	try {
		assert.equal(computeNodeInjection(dir, "改 src/x.ts"), null);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("injectNodeSkills：写入 systemPromptOptions.skills，叠加而非替换 systemPrompt", () => {
	const dir = makeProject({ lastStage: "implement", channel: "A" }, "## 语言栈\n\nTypeScript\n");
	try {
		const event = { systemPromptOptions: { skills: ["ddd-methodology"] }, prompt: "改 src/x.ts" };
		injectNodeSkills(event, { cwd: dir });
		assert.deepEqual(event.systemPromptOptions.skills, [
			"governance-code",
			"governance-comment",
			"lang-typescript",
			"tool-bash",
		]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("injectNodeSkills：矩阵行缺失时退回 frontmatter 的 skills，不动原值", () => {
	const dir = makeProject(null, null);
	try {
		const event = { systemPromptOptions: { skills: ["ddd-methodology"] } };
		injectNodeSkills(event, { cwd: dir });
		assert.deepEqual(event.systemPromptOptions.skills, ["ddd-methodology"]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("技能路径供给：枚举包内含 SKILL.md 的技能目录", () => {
	const dirs = skillDirectories();
	assert.ok(dirs.length >= 17, `应至少枚举出十七个技能目录，实际 ${dirs.length}`);
	assert.ok(dirs.every((dir) => existsSync(join(dir, "SKILL.md"))));
	assert.ok(dirs.some((dir) => dir.endsWith("ddd-methodology")));
});

test("任务引导 section：按节点注入，矩阵或状态缺失时不动 sections", () => {
	const dir = makeProject({ lastStage: "implement", channel: "A" }, "## 语言栈\n\nTypeScript\n");
	try {
		const sections: Record<string, unknown> = {};
		injectTaskGuidance({ systemPromptOptions: { sections }, prompt: "改 src/x.ts" }, { cwd: dir });
		assert.equal(typeof sections.ddd_task_guidance, "string");
		assert.match(String(sections.ddd_task_guidance), /implement/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
	const empty = makeProject(null, null);
	try {
		const sections: Record<string, unknown> = {};
		injectTaskGuidance({ systemPromptOptions: { sections } }, { cwd: empty });
		assert.deepEqual(sections, {}, "无状态或矩阵时不注入引导 section");
	} finally {
		rmSync(empty, { recursive: true, force: true });
	}
});
