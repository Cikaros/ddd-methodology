/**
 * H-5 目录越权、H-6 结构不同构、H-7 语言基线三项守卫的单元测试
 *
 * 目标：以 node --test 分别验证三项守卫的纯判定函数（extensions/lib/guards.ts），并以 ddd-governance.ts 的 tool_call 入口
 *   验证集成行为——非 DDD 项目完全静默放行（回归用例），DDD 项目内三项守卫按设计拦截并含理由三要素。
 * 范围：不启动宿主、不派发子代理；临时项目目录用后即删；本文件位于 extensions/lib/，该目录无 index 入口，不会被宿主当作扩展加载。
 * 运行：node --test extensions/lib/guards.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shouldBlockDirectoryScope, shouldBlockLanguageBaseline, shouldBlockStructureIsomorphism } from "./guards.ts";
import { countLines, coversFile, isFullTestCommand, isSourceFile, normalizeFullTestCommand } from "./guards.ts";
import { handleToolCall } from "../ddd-governance.ts";

test("H-5 目录越权：未落入任何代码根即拦，落于代码根之内或事实为空即放行", () => {
	assert.equal(shouldBlockDirectoryScope("tools/x.ts", ["src"]), true);
	assert.equal(shouldBlockDirectoryScope("src/x.ts", ["src"]), false);
	assert.equal(shouldBlockDirectoryScope("src\\core\\x.ts", ["src"]), false);
	assert.equal(shouldBlockDirectoryScope("./src/x.ts", ["src"]), false);
	// 事实集合为空表示无设计树，放行优先
	assert.equal(shouldBlockDirectoryScope("tools/x.ts", []), false);
	assert.equal(shouldBlockDirectoryScope("", ["src"]), false);
});

test("H-6 结构不同构：所在目录不是设计节点目录即拦，事实为空即放行", () => {
	assert.equal(shouldBlockStructureIsomorphism("src/core", ["src"]), true);
	assert.equal(shouldBlockStructureIsomorphism("src", ["src"]), false);
	assert.equal(shouldBlockStructureIsomorphism("src/core", ["src", "src/core"]), false);
	assert.equal(shouldBlockStructureIsomorphism("", ["src"]), true);
	assert.equal(shouldBlockStructureIsomorphism("src/new", []), false);
});

test("H-7 语言基线：语言未在项目基线内即拦，语言未知或基线集为空即放行", () => {
	assert.equal(shouldBlockLanguageBaseline("python", ["typescript"]), true);
	assert.equal(shouldBlockLanguageBaseline("typescript", ["typescript"]), false);
	assert.equal(shouldBlockLanguageBaseline(null, ["typescript"]), false);
	assert.equal(shouldBlockLanguageBaseline("python", []), false);
});

// 自 H-1/H-2/H-3 下沉至 lib 的纯助手：单独回验，保证口诀平移不变形
test("H-1 纯助手：源码扩展名判定与行数统计", () => {
	assert.equal(isSourceFile("src/x.ts"), true);
	assert.equal(isSourceFile("a/b/PyThOn.py"), true);
	assert.equal(isSourceFile("README.md"), false);
	assert.equal(isSourceFile("Makefile"), false);
	assert.equal(countLines("a\nb\n"), 2);
	assert.equal(countLines(""), 0);
	assert.equal(countLines("\n\n"), 0);
});

test("H-2 纯助手：全量测试命令归一与窄口径匹配", () => {
	assert.equal(normalizeFullTestCommand("  npm   test  "), "npm test");
	assert.equal(normalizeFullTestCommand("cd sub && pnpm test"), "pnpm test");
	assert.equal(normalizeFullTestCommand("npm test | tee log"), null);
	assert.equal(normalizeFullTestCommand(""), null);
	assert.equal(isFullTestCommand("npm test"), true);
	assert.equal(isFullTestCommand("node --test"), true);
	assert.equal(isFullTestCommand("npm test -- src/x.test.ts"), false);
});

test("H-3 纯助手：节点表覆盖范围判定", () => {
	const table = [
		"| 节点编号 | 父节点 | 类型 | 确定度 | 状态 | 覆盖范围 | 证据指针 | 登记信息 |",
		"| --- | --- | --- | --- | --- | --- | --- | --- |",
		"| OB-01 | - | 义务 | 已确定 | 进行中 | src/core | - | - |",
		"| OB-02 | - | 义务 | 已确定 | 进行中 | `src/router.ts` | - | - |",
	].join("\n");
	assert.equal(coversFile(table, "src/core/a.ts"), true);
	assert.equal(coversFile(table, "src/router.ts"), true);
	assert.equal(coversFile(table, "src/corelate/a.ts"), false);
	assert.equal(coversFile(table, "src/other.ts"), false);
});

// 非 DDD 项目：无 docs/gates 与设计树根，tool_call 应完全静默放行，不写 stderr
test("非 DDD 项目静默放行：write 与 bash 均返回 undefined 且不告警", async () => {
	const dir = mkdtempSync(join(tmpdir(), "ddd-plain-"));
	try {
		let writeResult: unknown = "sentinel";
		let bashResult: unknown = "sentinel";
		const { lines } = await captureAsync(async () => {
			writeResult = await handleToolCall(
				{ toolName: "write", input: { path: "src/x.ts", content: "const a = 1;\n" } },
				{ cwd: dir },
			);
			bashResult = await handleToolCall({ toolName: "bash", input: { command: "npm test" } }, { cwd: dir });
		});
		assert.equal(writeResult, undefined);
		assert.equal(bashResult, undefined);
		assert.deepEqual(lines, [], "非 DDD 项目不得输出任何告警");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

// DDD 项目：docs/design/src/DESIGN.md 使设计树根存在，ARCHITECTURE.md 声明语言栈为 TypeScript
function makeDddProject(): string {
	const dir = mkdtempSync(join(tmpdir(), "ddd-gov-"));
	mkdirSync(join(dir, "docs", "design", "src"), { recursive: true });
	writeFileSync(join(dir, "docs", "design", "src", "DESIGN.md"), "# src 目录级设计\n");
	writeFileSync(join(dir, "ARCHITECTURE.md"), "## 语言栈\n\nTypeScript\n");
	return dir;
}

function blockReasonOf(result: unknown): string {
	return (result as { reason?: string } | undefined)?.reason ?? "";
}

test("DDD 项目内 H-5 目录越权：写到设计树未覆盖目录被拦，理由含绝对路径与就近 DESIGN", async () => {
	const dir = makeDddProject();
	try {
		const result = await handleToolCall(
			{ toolName: "write", input: { path: "tools/build.ts", content: "export const x = 1;\n" } },
			{ cwd: dir },
		);
		const reason = blockReasonOf(result);
		assert.match(reason, /H-5 目录越权守卫/);
		assert.ok(reason.includes(join(dir, "tools", "build.ts")), "理由须含绝对路径");
		assert.match(reason, /就近 DESIGN/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("DDD 项目内 H-6 结构不同构：所在目录无设计节点被拦", async () => {
	const dir = makeDddProject();
	try {
		const result = await handleToolCall(
			{ toolName: "write", input: { path: "src/core/router.ts", content: "export const x = 1;\n" } },
			{ cwd: dir },
		);
		const reason = blockReasonOf(result);
		assert.match(reason, /H-6 结构不同构守卫/);
		assert.ok(reason.includes(join(dir, "src", "core", "router.ts")));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("DDD 项目内 H-7 语言基线：语言未在架构声明建立基线被拦", async () => {
	const dir = makeDddProject();
	try {
		const result = await handleToolCall(
			{ toolName: "write", input: { path: "src/run.py", content: "print(1)\n" } },
			{ cwd: dir },
		);
		const reason = blockReasonOf(result);
		assert.match(reason, /H-7 语言基线守卫/);
		assert.ok(reason.includes(join(dir, "src", "run.py")));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("DDD 项目内三项守卫齐备时放行：源码落于设计节点目录且语言已建基线", async () => {
	const dir = makeDddProject();
	try {
		const result = await handleToolCall(
			{ toolName: "write", input: { path: "src/router.ts", content: "export const x = 1;\n" } },
			{ cwd: dir },
		);
		assert.equal(result, undefined);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

// 异步版 stderr 捕获：主流程为异步，须等待其完成后再还原 console.error
async function captureAsync(run: () => Promise<void>): Promise<{ lines: string[] }> {
	const original = console.error;
	const lines: string[] = [];
	console.error = (...args: unknown[]) => {
		lines.push(args.map(String).join(" "));
	};
	try {
		await run();
	} finally {
		console.error = original;
	}
	return { lines };
}
