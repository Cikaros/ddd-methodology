/**
 * 未完成项注入与 H-4 清零判定的单元测试
 *
 * 目标：以 bun test 与 node --test 验证 extensions/lib/open-items.ts 的六项纯函数——债务登记簿解析、超期未清项判定、
 *   状态文件解析、通道剩余阶段、三类聚合文本与 H-4 清零拦截理由，覆盖正常与损坏、三态与两态等边界。
 * 范围：不读项目文件、不起子进程；超期判据复用脚本侧 version.js 的 isOverdue，不另写一份。
 * 运行：bun test extensions（本文件位于 extensions/lib/，该目录无 index 入口，不被宿主当作扩展加载）
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
	buildOpenItemsText,
	gateClearanceBlock,
	overdueDebts,
	parseDebtRegistry,
	parseStageState,
	remainingStages,
} from "./open-items.ts";

// 超期判据取脚本侧唯一实现，使超期判定与债务校验同源
const require = createRequire(import.meta.url);
const { isOverdue } = require("../../skills/ddd-methodology/scripts/lib/version.js");

const CHANNEL_STAGES = {
	A: ["requirements", "architect", "audit"],
	B: ["probe"],
	C: ["self-design", "self-write", "doc-sync", "audit"],
};

// 债务登记簿入参的统一构造，避免各用例重复书写 JSON
function debtsText(debts: unknown[], currentVersion = "v0.8.10"): string {
	return JSON.stringify({ currentVersion, maxOpen: 10, debts });
}

test("parseDebtRegistry：正常登记簿只收 open 项，dueBy 缺省归 null", () => {
	const registry = parseDebtRegistry(
		debtsText([
			{ id: "D-042", dueBy: "v0.10.9", owner: "根会话", desc: "a", status: "open" },
			{ id: "D-001", dueBy: "v0.10.9", owner: "根会话", desc: "b", status: "closed" },
			{ id: "D-043", owner: "根会话", desc: "c", status: "open" },
		]),
	);
	assert.equal(registry?.currentVersion, "v0.8.10");
	assert.equal(registry?.maxOpen, 10);
	assert.deepEqual(registry?.open.map((item) => item.id), ["D-042", "D-043"]);
	assert.equal(registry?.open[1].dueBy, null);
});

test("parseDebtRegistry：非法 JSON、非对象与缺 debts 数组一律回 null", () => {
	assert.equal(parseDebtRegistry("{ not json"), null);
	assert.equal(parseDebtRegistry(""), null);
	assert.equal(parseDebtRegistry(null), null);
	assert.equal(parseDebtRegistry(JSON.stringify({ currentVersion: "v1.0.0" })), null);
	assert.equal(parseDebtRegistry(JSON.stringify([1, 2, 3])), null);
});

test("overdueDebts：超期、未超期与不可解析三态，不可解析者不判超期", () => {
	const registry = parseDebtRegistry(
		debtsText([
			{ id: "D-100", dueBy: "v0.8.9", owner: "x", desc: "", status: "open" },
			{ id: "D-101", dueBy: "v0.10.9", owner: "x", desc: "", status: "open" },
			{ id: "D-102", dueBy: "oops", owner: "x", desc: "", status: "open" },
			{ id: "D-103", owner: "x", desc: "", status: "open" },
		]),
	);
	assert.deepEqual(overdueDebts(registry, isOverdue).map((item) => item.id), ["D-100"]);
});

test("overdueDebts：currentVersion 不可解析或登记簿缺失一律回空数组", () => {
	const bad = { currentVersion: "bad", maxOpen: null, open: [{ id: "D-1", dueBy: "v0.1.0", owner: "x", desc: "" }] };
	assert.deepEqual(overdueDebts(bad, isOverdue), []);
	assert.deepEqual(overdueDebts(null, isOverdue), []);
});

test("parseStageState：正常状态字段齐备，非法 JSON 或非对象回 null", () => {
	const state = parseStageState(JSON.stringify({ channel: "C", doneStages: ["self-design"], lastStage: "self-design", status: "running" }));
	assert.equal(state?.channel, "C");
	assert.deepEqual(state?.doneStages, ["self-design"]);
	assert.equal(state?.lastStage, "self-design");
	assert.equal(state?.status, "running");
	assert.equal(parseStageState("not json"), null);
	assert.equal(parseStageState(""), null);
	assert.equal(parseStageState(null), null);
	assert.equal(parseStageState("[1,2]"), null);
});

test("remainingStages：该通道阶段全序减去已完成；通道不存在或表缺失回空数组", () => {
	assert.deepEqual(remainingStages(CHANNEL_STAGES, "C", ["self-design"]), ["self-write", "doc-sync", "audit"]);
	assert.deepEqual(remainingStages(CHANNEL_STAGES, "C", ["audit", "self-design"]), ["self-write", "doc-sync"]);
	assert.deepEqual(remainingStages(CHANNEL_STAGES, "Z", []), []);
	assert.deepEqual(remainingStages(null, "C", []), []);
});

test("buildOpenItemsText：三类聚合齐备出文本，三类俱空回 null", () => {
	const text = buildOpenItemsText({
		obligations: ["docs/board/a/NODES.md OB-01（进行中）"],
		debts: {
			currentVersion: "v0.8.10",
			maxOpen: 10,
			open: [{ id: "D-042", dueBy: "v0.10.9", owner: "根会话", desc: "" }],
			overdue: [],
		},
		state: { channel: "C", doneStages: ["self-design"], lastStage: "self-design", status: "running" },
		channelStages: CHANNEL_STAGES,
	});
	assert.ok(text !== null);
	assert.ok(text.includes("OB-01"));
	assert.ok(text.includes("D-042"));
	assert.ok(text.includes("self-write"));
	assert.ok(text.includes("超期标记规则"));

	assert.equal(buildOpenItemsText({}), null);
	assert.equal(
		buildOpenItemsText({ obligations: [], debts: { currentVersion: null, maxOpen: null, open: [], overdue: [] }, state: null, channelStages: CHANNEL_STAGES }),
		null,
	);
});

test("buildOpenItemsText：未清债务非空即出债务段，超期项加标", () => {
	const partial = buildOpenItemsText({ debts: { currentVersion: "v0.10.0", maxOpen: 10, open: [{ id: "D-1", dueBy: "v0.9.0", owner: "x", desc: "" }], overdue: [{ id: "D-1", dueBy: "v0.9.0", owner: "x", desc: "" }] } });
	assert.ok(partial !== null);
	assert.ok(partial.includes("[超期]"));
});

test("gateClearanceBlock：有未闭合义务节点或超期债务即拦，理由含超期项编号；两态皆无则放行", () => {
	assert.equal(gateClearanceBlock([], []), null);
	assert.equal(gateClearanceBlock(null, null), null);
	const blocked = gateClearanceBlock([], [
		{ id: "D-100", dueBy: "v0.8.9", owner: "x", desc: "" },
		{ id: "D-101", dueBy: "v0.8.9", owner: "x", desc: "" },
	]);
	assert.ok(blocked !== null);
	assert.ok(blocked.includes("D-100") && blocked.includes("D-101"));
	const obligationsOnly = gateClearanceBlock(["docs/board/a/NODES.md OB-01（未开始）"], []);
	assert.ok(obligationsOnly !== null && obligationsOnly.includes("未闭合义务节点"));
});
