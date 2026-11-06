/**
 * 未完成项来源层的单元测试
 *
 * 目标：以 bun test 验证 extensions/lib/open-items-source.ts 的 collectOpenItems——三类采集齐备与各单类降级、
 *   义务节点扫描、超期债务判定与状态文件解析的取值，以及 cwd 缺失时的全空降级。
 * 范围：在临时项目根上落盘夹具，不读仓内真实产物；通道阶段键取自包内主技能正文，属读盘面故一并断言非空。
 * 运行：bun test extensions（本文件位于 extensions/lib/，该目录无 index 入口，不被宿主当作扩展加载）
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { collectOpenItems } from "./open-items-source.ts";

// 临时项目根：按给定相对路径与内容落盘后交用例读取，用例毕即删
function withRoot(files: Record<string, string>, run: (root: string) => void): void {
	const root = mkdtempSync(join(tmpdir(), "ddd-open-items-"));
	try {
		for (const [rel, content] of Object.entries(files)) {
			const full = join(root, ...rel.split("/"));
			mkdirSync(dirname(full), { recursive: true });
			writeFileSync(full, content, "utf8");
		}
		run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

const NODES = [
	"| 节点编号 | 描述 | 类型 | 承接方 | 状态 |",
	"| --- | --- | --- | --- | --- |",
	"| OB-01 | 采集 | 义务 | 实现者 | 进行中 |",
	"| OB-02 | 采集 | 义务 | 实现者 | 完成 |",
].join("\n");

const DEBTS = JSON.stringify({
	currentVersion: "v0.8.11",
	maxOpen: 10,
	debts: [
		{ id: "D-100", dueBy: "v0.8.9", owner: "根会话", desc: "a", status: "open" },
		{ id: "D-101", dueBy: "v0.10.0", owner: "根会话", desc: "b", status: "open" },
		{ id: "D-102", dueBy: "oops", owner: "根会话", desc: "c", status: "open" },
	],
});

const STATE = JSON.stringify({ channel: "C", doneStages: ["self-design"], lastStage: "self-design", status: "running" });

test("cwd 缺失或非字符串：一律回全空降级，不读盘", () => {
	assert.deepEqual(collectOpenItems({}), { obligations: null, debts: null, state: null, channelStages: null });
	assert.deepEqual(collectOpenItems({ cwd: "" }), { obligations: null, debts: null, state: null, channelStages: null });
	assert.deepEqual(collectOpenItems({ cwd: 123 }), { obligations: null, debts: null, state: null, channelStages: null });
});

test("三类采集齐备：义务节点取未闭合者，超期债务只收早于当前版本者，状态文件按键取值", () => {
	withRoot({ "docs/board/a/NODES.md": NODES, "docs/debts.json": DEBTS, "docs/.ddd-state.json": STATE }, (root) => {
		const collected = collectOpenItems({ cwd: root });
		assert.deepEqual(collected.obligations, ["docs/board/a/NODES.md OB-01（进行中）"]);
		assert.deepEqual(collected.debts?.overdue.map((item) => item.id), ["D-100"]);
		assert.equal(collected.debts?.currentVersion, "v0.8.11");
		assert.equal(collected.state?.lastStage, "self-design");
		assert.equal(collected.state?.channel, "C");
	});
});

test("通道阶段键：自包内主技能正文解析，三类外的第四类亦具值", () => {
	withRoot({}, (root) => {
		const collected = collectOpenItems({ cwd: root });
		assert.ok(collected.channelStages && typeof collected.channelStages === "object");
	});
});

test("看板缺失：义务节点回 null，债务与状态仍各自采集", () => {
	withRoot({ "docs/debts.json": DEBTS, "docs/.ddd-state.json": STATE }, (root) => {
		const collected = collectOpenItems({ cwd: root });
		assert.equal(collected.obligations, null);
		assert.deepEqual(collected.debts?.overdue.map((item) => item.id), ["D-100"]);
		assert.equal(collected.state?.status, "running");
	});
});

test("登记簿缺失或非法：债务类回 null，不阻断其余采集", () => {
	withRoot({}, (root) => assert.equal(collectOpenItems({ cwd: root }).debts, null));
	withRoot({ "docs/debts.json": "{ not json" }, (root) => assert.equal(collectOpenItems({ cwd: root }).debts, null));
});

test("状态文件缺失或非法：阶段解析回 null，不阻断其余采集", () => {
	withRoot({ "docs/board/a/NODES.md": NODES }, (root) => assert.equal(collectOpenItems({ cwd: root }).state, null));
	withRoot({ "docs/.ddd-state.json": "not json" }, (root) => assert.equal(collectOpenItems({ cwd: root }).state, null));
});
