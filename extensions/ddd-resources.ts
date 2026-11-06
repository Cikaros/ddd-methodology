/**
 * 资源与技能裁剪扩展
 *
 * 目标：把注入矩阵落成运行时的两项供给。其一，before_agent_start 内读状态文件取当前节点、读注入矩阵取该节点所在行，
 *   按约束、语言、工具三维解析并去重，写入 `systemPromptOptions.skills`；其二，为宿主的 `resources_discover` 供给包内技能目录路径。
 * 范围：按矩阵裁剪可得技能集与技能路径供给两项，矩阵为唯一规格。
 * 不包含：技能路径发现（宿主按 package.json 声明枚举）、全局规则注入与依赖探测（见 ddd-context.ts）、守卫与未完成项注入（见 ddd-governance.ts）。
 *
 * 注入三约束：其一，注入是叠加而非替换，只改 `systemPromptOptions.skills`，绝不返回 replacement systemPrompt，否则摧毁 section 机制并使提示缓存失效；
 *   其二，同一 run 内不重复注入——按技能名去重后整列赋值，重复触发结果幂等；其三，矩阵缺失或节点无对应行时退回代理 frontmatter 的 skills，
 *   即不改动 `systemPromptOptions.skills`，不报错中断。
 *
 * 生效范围：根会话与后台子代理；前台子代理不加载 ambient 扩展，本扩展对其不生效。
 * 依据：设计 DESIGN-extensions.md 第三、四节；矩阵规格见 DESIGN-scheduling.md 第五节。
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PACKAGE_ROOT } from "./lib/shared.ts";
import { computeNodeInjection, extractTaskText } from "./lib/injection.ts";

const SKILL_MANIFEST = "SKILL.md";

type SkillOptionCarrier = { skills?: unknown };
type AgentStartEvent = { systemPromptOptions?: SkillOptionCarrier } & Record<string, unknown>;

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", (event, ctx) => {
		try {
			injectNodeSkills(event, ctx);
		} catch {
			// 注入异常一律降级为退回 frontmatter 的 skills，不阻断启动
		}
	});

	// 技能路径供给：宿主在资源发现时补齐嵌套或非约定位置的技能；异常不阻断发现
	pi.on("resources_discover", (event) => {
		try {
			return supplySkillPaths(event);
		} catch {
			return undefined;
		}
	});
}

// 按矩阵裁剪可得技能集并写入 systemPromptOptions.skills；矩阵缺失或节点无行时不动，退回 frontmatter 的 skills
export function injectNodeSkills(event: AgentStartEvent | undefined, ctx: { cwd?: unknown } | undefined): void {
	const options = event?.systemPromptOptions;
	if (!options || typeof options !== "object") return;
	const cwd = typeof ctx?.cwd === "string" ? ctx.cwd : "";
	const injection = computeNodeInjection(cwd, extractTaskText(event));
	if (!injection || injection.skills.length === 0) return;
	options.skills = injection.skills;
}

// 包内技能目录：以含 SKILL.md 的子目录为准，按名排序；只枚举一层，技能发现本身仍由宿主承担
export function skillDirectories(root: string = PACKAGE_ROOT): string[] {
	const skillsRoot = join(root, "skills");
	if (!existsSync(skillsRoot)) return [];
	const dirs: string[] = [];
	for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		if (existsSync(join(skillsRoot, entry.name, SKILL_MANIFEST))) dirs.push(join(skillsRoot, entry.name));
	}
	return dirs.sort();
}

// 路径供给：把包内技能目录写入宿主事件的可得集合字段（若存在），并回传供给列表；无消费字段时不落点
function supplySkillPaths(event: unknown): string[] {
	const dirs = skillDirectories();
	if (dirs.length === 0) return dirs;
	const carrier = event as { skills?: unknown; paths?: unknown } | undefined;
	for (const field of ["skills", "paths"] as const) {
		const target = carrier?.[field];
		if (Array.isArray(target)) {
			const existing = new Set(target.filter((item): item is string => typeof item === "string"));
			for (const dir of dirs) if (!existing.has(dir)) target.push(dir);
		}
	}
	return dirs;
}
