/**
 * 未完成项采集的来源层
 *
 * 目标：把三类未完成项的读盘与脚本侧依赖绑定从治理扩展外置，使注入面与 H-4 清零面共用同一次采集；
 *   采集对象为未闭合义务节点、债务未清项与未完成阶段，任一类非空即注入（见 DESIGN-extensions.md 第三节「未完成项注入」）。
 * 范围：债务登记簿与状态文件与主技能正文三处读盘，paths.js、version.js 与 ref-stages.js 三处脚本侧依赖经 createRequire 绑定并降级，
 *   以及三类采集的合成 collectOpenItems 一项。
 * 不包含：纯解析与聚合（见同目录 open-items.ts）、守卫判定与 section 写入（见 ddd-governance.ts）。
 * 单一权威：债务登记簿落点解析取自脚本侧 paths.js，超期判据取自 version.js 的 isOverdue，阶段键全序自包内主技能正文经 ref-stages.js 解析；
 *   三者均经 createRequire 复用脚本侧实现，取不到时该组降级略过，不中断其余组。
 * 本文件位于 extensions/lib/，该目录无 index.ts，不被宿主当作扩展入口加载。
 * 依据：设计 DESIGN-extensions.md 第三节「未完成项注入」与第二节 H-4 行。
 */

import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { PACKAGE_ROOT, readText, STATE_FILE_REL } from "./shared.ts";
import { overdueDebts, parseDebtRegistry, parseStageState } from "./open-items.ts";
import type { ChannelStages, DebtView, IsOverdue, OpenItemsInput } from "./open-items.ts";

// 主技能正文落点锚定包根：通道阶段键全序自其调度模型节的通道表解析，与 ref-check 的 C4 同源
const SKILL_FILE = join(PACKAGE_ROOT, "skills", "ddd-methodology", "SKILL.md");
// 三类未完成项俱不可得时的降级形态：任一项解析失败不阻断其余项的采集
const EMPTY_OPEN_ITEMS: OpenItemsInput = { obligations: null, debts: null, state: null, channelStages: null };

// 债务登记簿落点解析取自脚本侧 paths.js，公开区优先、内部区回退；绑定或取用失败即债务类降级略过
let debtPathDeps: { artifactReadPath: (root: string, rel: string) => string | null; debtBookRel: string } | null = null;
try {
	const requireFromLib = createRequire(import.meta.url);
	const paths = requireFromLib("../../skills/ddd-methodology/scripts/lib/paths.js");
	if (paths && typeof paths.artifactReadPath === "function" && typeof paths.DEBT_BOOK_REL === "string") {
		debtPathDeps = { artifactReadPath: paths.artifactReadPath, debtBookRel: paths.DEBT_BOOK_REL };
	}
} catch {
	debtPathDeps = null;
}

// 超期判据取自脚本侧 version.js 的 isOverdue；取不到即超期标记降级为空，不阻断登记簿其余字段
let versionDeps: { isOverdue: IsOverdue } | null = null;
try {
	const requireFromLib = createRequire(import.meta.url);
	const version = requireFromLib("../../skills/ddd-methodology/scripts/lib/version.js");
	if (version && typeof version.isOverdue === "function") versionDeps = { isOverdue: version.isOverdue };
} catch {
	versionDeps = null;
}

// 通道阶段键解析取自脚本侧 ref-stages.js，与 ref-check 的 C4 同源；取不到即阶段类降级略过
let stageParser: ((text: string) => ChannelStages | null) | null = null;
try {
	const requireFromLib = createRequire(import.meta.url);
	const refStages = requireFromLib("../../skills/ddd-methodology/scripts/lib/ref-stages.js");
	if (refStages && typeof refStages.parseChannelStages === "function") stageParser = refStages.parseChannelStages;
} catch {
	stageParser = null;
}

// 未闭合义务节点：扫 docs/board 下全部节点文件，取类型为义务且状态为未开始或进行中者
function collectOpenObligations(root: string): string[] | null {
	const boardDir = join(root, "docs", "board");
	if (!existsSync(boardDir)) return null;
	const open: string[] = [];
	const walk = (dir: string): void => {
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

// 债务未清项视图：登记簿读盘一次，超期判定在此一次完成；路径或版本依赖缺失即降级
function collectDebtView(root: string): DebtView | null {
	if (!debtPathDeps) return null;
	const debtPath = debtPathDeps.artifactReadPath(root, debtPathDeps.debtBookRel);
	if (!debtPath) return null;
	const registry = parseDebtRegistry(readText(debtPath));
	if (!registry) return null;
	const overdue = versionDeps ? overdueDebts(registry, versionDeps.isOverdue) : [];
	return { ...registry, overdue };
}

// 通道阶段键全序：读包内主技能正文后交由脚本侧解析实现；解析器缺失或正文不可读即降级
function collectChannelStages(): ChannelStages | null {
	if (typeof stageParser !== "function") return null;
	const text = readText(SKILL_FILE);
	if (typeof text !== "string") return null;
	try {
		return stageParser(text);
	} catch {
		return null;
	}
}

// 三类未完成项的一次性采集：义务节点与超期债务共用同一读盘与判定，注入与 H-4 守卫复用同一结果；任一组依赖缺失即该类降级略过
export function collectOpenItems(ctx: { cwd?: unknown }): OpenItemsInput {
	try {
		const cwd = ctx && ctx.cwd;
		if (typeof cwd !== "string" || cwd === "") return EMPTY_OPEN_ITEMS;
		const root = resolve(cwd);
		return {
			obligations: collectOpenObligations(root),
			debts: collectDebtView(root),
			state: parseStageState(readText(join(root, STATE_FILE_REL))),
			channelStages: collectChannelStages(),
		};
	} catch {
		return EMPTY_OPEN_ITEMS;
	}
}
