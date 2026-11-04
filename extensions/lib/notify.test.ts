/**
 * 用户提示单一实现的分支选择单元测试
 *
 * 目标：以 node --test 直接构造假 ctx 验证 extensions/lib/notify.ts 的判定分支，覆盖四种情形——
 *   hasUI 为真且 ui.notify 可用、hasUI 为假但 ui.notify 是函数（no-op 场景）、hasUI 为真但 ui.notify 不可用、宿主通知抛错。
 *   其中 no-op 场景是对无界面模式缺陷的回归防护：宿主给 print 与 json 模式绑定了存在的 no-op 通知函数。
 * 范围：只测分支选择与兜底落点，不触文件系统与宿主；本文件位于 extensions/lib/，该目录无 index 入口，不会被宿主当作扩展加载。
 * 运行：node --test extensions/lib/notify.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { notifyUser } from "./notify.ts";

// 捕获写 stderr 的内容：notifyUser 的兜底走 console.error，测试期间替换并还原
function captureStderr<T>(run: () => T): { lines: string[] } {
	const original = console.error;
	const lines: string[] = [];
	console.error = (...args: unknown[]) => {
		lines.push(args.map(String).join(" "));
	};
	try {
		run();
	} finally {
		console.error = original;
	}
	return { lines };
}

test("hasUI 为真且 ui.notify 可用：走宿主通知且不写 stderr", () => {
	const calls: Array<{ message: string; type?: string }> = [];
	const ctx = {
		hasUI: true,
		ui: {
			notify: (message: string, type?: string) => {
				calls.push({ message, type });
			},
		},
	};
	const { lines } = captureStderr(() => notifyUser(ctx, "提示", "warning"));
	assert.deepEqual(calls, [{ message: "提示", type: "warning" }]);
	assert.deepEqual(lines, []);
});

test("hasUI 为假但 ui.notify 是函数：写 stderr 且不调用宿主通知", () => {
	const calls: string[] = [];
	const ctx = { hasUI: false, ui: { notify: (message: string) => calls.push(message) } };
	const { lines } = captureStderr(() => notifyUser(ctx, "非交互提示", "warning"));
	assert.deepEqual(calls, []);
	assert.deepEqual(lines, ["非交互提示"]);
});

test("hasUI 为真但 ui.notify 不可用：写 stderr", () => {
	const { lines } = captureStderr(() => notifyUser({ hasUI: true, ui: {} }, "无 notify", "info"));
	assert.deepEqual(lines, ["无 notify"]);
});

test("宿主通知抛错：吞掉异常并落到 stderr，不外抛", () => {
	const ctx = {
		hasUI: true,
		ui: {
			notify: () => {
				throw new Error("宿主故障");
			},
		},
	};
	let thrown = false;
	const { lines } = captureStderr(() => {
		try {
			notifyUser(ctx, "抛错提示", "error");
		} catch {
			thrown = true;
		}
	});
	assert.equal(thrown, false);
	assert.deepEqual(lines, ["抛错提示"]);
});

test("ctx 缺失：写 stderr，不抛错", () => {
	const { lines } = captureStderr(() => notifyUser(undefined, "无上下文", "warning"));
	assert.deepEqual(lines, ["无上下文"]);
});
