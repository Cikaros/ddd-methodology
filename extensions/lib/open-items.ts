/**
 * 未完成项注入与 H-4 清零判定的纯逻辑
 *
 * 目标：把三类未完成项（未闭合义务节点、债务未清项、未完成阶段）的解析、超期判定、阶段剩余计算、聚合文本与
 *   H-4 清零拦截理由收敛为一处纯实现，供 ddd-governance 的启动注入与门禁清零守卫共用同一口径。
 * 范围：六项纯函数——parseDebtRegistry、overdueDebts、parseStageState、remainingStages、buildOpenItemsText、gateClearanceBlock。
 *   入参一律为文本或已解析对象，出参为解析结果或文本。
 * 不包含：读盘与落点解析（由 ddd-governance 经 createRequire 复用脚本侧 paths.js）、版本比较实现（复用脚本侧 version.js）、
 *   阶段键解析实现（复用脚本侧 ref-stages.js）、section 写入与守卫激活判据（见 ddd-governance.ts）。
 * 依据：设计 DESIGN-extensions.md 第一节四模块表、第二节 H-4 行、第三节「未完成项注入」小节。
 */

// 版本三段形态与脚本侧 version.js 的解析结果同形，比较与解析实现由调用方注入，本模块不另写一份
export type Version = { major: number; minor: number; patch: number };
export type ParseVersion = (value: unknown) => Version | null;
export type CompareVersion = (a: Version, b: Version) => number;

// 未清债务项：字段名与债务登记簿一致；dueBy 可省，省略即 null
export type OpenDebt = { id: string; dueBy: string | null; owner: string; desc: string };
export type DebtRegistry = { currentVersion: string | null; maxOpen: number | null; open: OpenDebt[] };
// 债务未清项视图：登记簿本体加超期项清单，超期判定在调用方完成一次，聚合面据此标注而不重算
export type DebtView = DebtRegistry & { overdue: OpenDebt[] };
export type StageState = { channel: string | null; doneStages: string[]; lastStage: string | null; status: string | null };
export type ChannelStages = Record<string, string[]>;

export type OpenItemsInput = {
	obligations?: string[] | null;
	debts?: DebtView | null;
	state?: StageState | null;
	channelStages?: ChannelStages | null;
};

const asText = (value: unknown): string => (typeof value === "string" ? value : "");

// 债务登记簿解析：顶层须为含 debts 数组的对象，只收 status 为 open 者；非法 JSON、非对象或缺 debts 数组即 null
export function parseDebtRegistry(text: string | null): DebtRegistry | null {
	if (typeof text !== "string" || text.trim() === "") return null;
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return null;
	}
	if (!data || typeof data !== "object" || Array.isArray(data)) return null;
	const record = data as Record<string, unknown>;
	if (!Array.isArray(record.debts)) return null;
	const open: OpenDebt[] = [];
	for (const entry of record.debts) {
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
		const item = entry as Record<string, unknown>;
		if (item.status !== "open") continue;
		open.push({
			id: asText(item.id),
			dueBy: asText(item.dueBy) || null,
			owner: asText(item.owner),
			desc: asText(item.desc),
		});
	}
	return {
		currentVersion: asText(record.currentVersion) || null,
		maxOpen: typeof record.maxOpen === "number" && Number.isFinite(record.maxOpen) ? record.maxOpen : null,
		open,
	};
}

// 超期未清项：dueBy 与 currentVersion 均可解析且 dueBy 早于 currentVersion 者计入；不可解析者不判超期
export function overdueDebts(registry: DebtRegistry | null, compareVersion: CompareVersion, parseVersion: ParseVersion): OpenDebt[] {
	if (!registry || !Array.isArray(registry.open)) return [];
	const current = parseVersion(registry.currentVersion);
	if (!current) return [];
	const overdue: OpenDebt[] = [];
	for (const item of registry.open) {
		const due = parseVersion(item.dueBy);
		if (due && compareVersion(due, current) < 0) overdue.push(item);
	}
	return overdue;
}

// 状态文件解析：字段齐备性按实际取值归一，缺失或非法一律回 null 字段；非法 JSON、非对象即整体回 null
export function parseStageState(text: string | null): StageState | null {
	if (typeof text !== "string" || text.trim() === "") return null;
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return null;
	}
	if (!data || typeof data !== "object" || Array.isArray(data)) return null;
	const record = data as Record<string, unknown>;
	return {
		channel: typeof record.channel === "string" ? record.channel : null,
		doneStages: Array.isArray(record.doneStages) ? record.doneStages.filter((s): s is string => typeof s === "string") : [],
		lastStage: typeof record.lastStage === "string" ? record.lastStage : null,
		status: typeof record.status === "string" ? record.status : null,
	};
}

// 通道剩余阶段：该通道阶段全序按原序减去已完成键；通道不存在或非字符串即空数组
export function remainingStages(channelStages: ChannelStages | null, channel: string | null, doneStages: string[]): string[] {
	if (!channelStages || typeof channel !== "string") return [];
	const full = channelStages[channel];
	if (!Array.isArray(full)) return [];
	const done = new Set(Array.isArray(doneStages) ? doneStages : []);
	return full.filter((key) => !done.has(key));
}

// 未闭合义务节点段：空列表回 null，非空逐条列出「节点文件 节点编号（状态）」
function obligationSection(obligations: string[] | null | undefined): string | null {
	const list = Array.isArray(obligations) ? obligations.filter((item) => typeof item === "string" && item.trim() !== "") : [];
	if (list.length === 0) return null;
	return [`未闭合义务节点（${list.length} 项）：`, ...list.map((item) => `  - ${item}`), "逐条核销后方可过门。"].join("\n");
}

// 债务未清项段：无未清项回 null；超期项按调用方给出的超期清单标注，并给出超期标记规则
function debtSection(debts: DebtView | null | undefined): string | null {
	if (!debts || !Array.isArray(debts.open) || debts.open.length === 0) return null;
	const overdueIds = new Set((Array.isArray(debts.overdue) ? debts.overdue : []).map((item) => item.id));
	const lines = [
		`债务未清项（未清 ${debts.open.length} 项，上限 ${debts.maxOpen ?? "未声明"}，当前版本 ${debts.currentVersion ?? "未声明"}）：`,
	];
	for (const item of debts.open) {
		const mark = overdueIds.has(item.id) ? " [超期]" : "";
		lines.push(`  - ${item.id} 应清 ${item.dueBy ?? "未声明"} 承接方 ${item.owner || "未具名"}${mark}`);
	}
	lines.push("超期标记规则：应清版本早于当前版本的未清项标 [超期]，须优先清偿。");
	return lines.join("\n");
}

// 未完成阶段段：无状态或无剩余阶段回 null，非空给出通道、状态、最后阶段、已完成与剩余阶段
function stageSection(state: StageState | null | undefined, channelStages: ChannelStages | null | undefined): string | null {
	if (!state) return null;
	const remaining = remainingStages(channelStages ?? null, state.channel, state.doneStages);
	if (remaining.length === 0) return null;
	const done = state.doneStages.length > 0 ? state.doneStages.join("、") : "无";
	return [
		`未完成阶段（通道 ${state.channel ?? "未声明"}，状态 ${state.status ?? "未声明"}）：`,
		`  最后阶段：${state.lastStage ?? "未声明"}；已完成：${done}`,
		`  剩余阶段：${remaining.join("、")}`,
	].join("\n");
}

// 三类聚合：任一类非空即出文本，三类俱空回 null；义务节点、债务与阶段三段的次序固定
export function buildOpenItemsText(input: OpenItemsInput): string | null {
	const sections = [
		obligationSection(input?.obligations),
		debtSection(input?.debts),
		stageSection(input?.state, input?.channelStages),
	].filter((section): section is string => section !== null);
	if (sections.length === 0) return null;
	return ["未完成项（任一类非空即注入，逐项处置后方可过门）：", ...sections].join("\n");
}

// H-4 清零拦截理由：存在未闭合义务节点或超期未清债务即回理由文本，两者皆无回 null；理由列出超期项编号
export function gateClearanceBlock(obligations: string[] | null, overdue: OpenDebt[] | null): string | null {
	const openList = Array.isArray(obligations) ? obligations.filter((item) => typeof item === "string" && item.trim() !== "") : [];
	const overdueList = Array.isArray(overdue) ? overdue.filter((item) => item && typeof item.id === "string" && item.id !== "") : [];
	if (openList.length === 0 && overdueList.length === 0) return null;
	const parts: string[] = [];
	if (openList.length > 0) parts.push(`任务树存在 ${openList.length} 项未闭合义务节点`);
	if (overdueList.length > 0) parts.push(`存在 ${overdueList.length} 项超期未清债务：${overdueList.map((item) => item.id).join("、")}`);
	return parts.join("；");
}
