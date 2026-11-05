/**
 * 机械校验工具扩展
 *
 * 交接说明（原 slash 命令 ddd-parser-install 改提示模板，模板本体由 prompts 域产出，本扩展不再注册该命令）：
 *   模板落 prompts/ddd-parser-install.md；模板行为：用户触发后在当前项目依次运行
 *     node <包根>/skills/ddd-methodology/scripts/install-parser.js            打印待安装的包与安装位置，
 *     node <包根>/skills/ddd-methodology/scripts/install-parser.js --install  执行安装；
 *   任一步失败即报错并中止。安装逻辑与版本清单的唯一实现在该脚本，模板不另写一套。
 *
 * 目标：把甲类机械校验脚本注册为类型化工具，使父会话以工具调用替代文本解析与绝对路径拼装；
 *   工具回传结构化结果，模型只收到精简摘要与关键结论行，降低上下文负担。
 * 范围：六个机械证据工具与六个脚本一一对应——ddd_governance_check、ddd_trace_check、ddd_span_check、ddd_code_health、ddd_debt_check、ddd_metrics_report；
 *   另接入五个交叉检查节点的校验脚本入口 ddd_check_scope、ddd_check_design、ddd_check_file_design、ddd_check_code、ddd_check_consistency，脚本落 skills/ddd-methodology/scripts/，与 DESIGN-crosscheck.md 的五个执行点对应；
 *   交叉检查工具由主链编排脚本在对应节点自动调用，手工复核同一检查时直接调用同一工具，两处共用同一工具面，不各写一套语义。
 * 不包含：全局规则注入与前置依赖探测（见同目录 ddd-context.ts）、结构治理守卫（见同目录 ddd-governance.ts）、技能裁剪与路径供给（见同目录 ddd-resources.ts）。
 *
 * 脚本路径一律由共享模块（lib/shared.ts）解析的包根拼出，不依赖调用方传入，不硬编码绝对路径。
 * 调用约定：node <脚本绝对路径> <项目根绝对路径>；机读状态取脚本末行 `RESULT: xxx` 的 xxx 或 JSON 输出的 verdict。
 * 依据：设计 N-4。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { EXEC_TIMEOUT_MS, PACKAGE_ROOT, describeError, exitCodeOf, type ExecResult } from "./lib/shared.ts";

const SUMMARY_MAX_CHARS = 1500; // 进模型上下文的摘要上限，与「降低上下文负担」的目标一致
const KEY_LINE_LIMIT = 5;

// 工具与脚本一一对应表：工具名统一 ddd_ 前缀，script 为 skills/ddd-methodology/scripts/ 下脚本基名
const TOOLS = [
	{
		name: "ddd_governance_check",
		script: "governance-check",
		label: "DDD 接口冻结与结构趋势校验",
		description: "运行 governance-check 校验被开发项目的接口节冻结与结构趋势，输出 verdict 作为 G5-INT 门槛证据。root 传被开发项目根的绝对路径。",
		snippet: "校验被开发项目的接口冻结与结构趋势（governance-check）",
	},
	{
		name: "ddd_trace_check",
		script: "trace-check",
		label: "DDD 追溯一致性校验",
		description: "运行 trace-check 校验需求到 AC 的追溯一致性，输出 RESULT: pass 或 gap，作为 G4 与 G5 门禁证据。root 传被开发项目根的绝对路径。",
		snippet: "校验需求到 AC 的追溯一致性（trace-check）",
	},
	{
		name: "ddd_span_check",
		script: "span-check",
		label: "DDD 签名级符合性校验",
		description: "运行 span-check 比对 DESIGN 契约表签名与代码侧导出符号，输出 RESULT: pass 或 drift，作为 G5-INT 的接口签名一致性证据；需先经 /ddd-parser-install 安装解析器，解析器缺失时报无法判定而非缺口。root 传被开发项目根的绝对路径。",
		snippet: "比对 DESIGN 契约签名与代码侧导出符号（span-check）",
	},
	{
		name: "ddd_code_health",
		script: "code-health",
		label: "DDD 结构健康度量",
		description: "运行 code-health 度量被开发项目的结构健康并写入项目内 docs/health.json，仅报告不作门禁。root 传被开发项目根的绝对路径。",
		snippet: "度量被开发项目的结构健康（code-health）",
	},
	{
		name: "ddd_debt_check",
		script: "debt-check",
		label: "DDD 存量债务校验",
		description: "运行 debt-check 校验被开发项目的存量债务登记簿是否超期或越上限，输出 RESULT: pass 或 overdue。root 传被开发项目根的绝对路径。",
		snippet: "校验存量债务登记簿的超期与上限（debt-check）",
	},
	{
		name: "ddd_metrics_report",
		script: "metrics-report",
		label: "DDD 绩效度量聚合",
		description: "运行 metrics-report 聚合被开发项目的健康、债务、门禁与报告数据并写入 docs/metrics.json，末行 RESULT: report。root 传被开发项目根的绝对路径。",
		snippet: "聚合被开发项目的绩效度量（metrics-report）",
	},
];

const PARAMETERS = Type.Object({
	root: Type.String({ description: "被开发项目根的绝对路径" }),
});

// 交叉检查节点的校验脚本入口：四个纯机械节点与一个脚本加审计节点，脚本落 skills/ddd-methodology/scripts/，
// 与 DESIGN-crosscheck.md 第三、四节的五个执行点一一对应；末行机读结论为 pass 或 gap，runCheck 按退出码判 ok。
const CROSS_CHECK_TOOLS = [
	{
		name: "ddd_check_scope",
		script: "check-scope",
		label: "DDD 检查 check-scope",
		description: "运行 check-scope 校对结构树、包清单、语言栈、技能清单与目录规划五处同集与字段名同集，输出 RESULT: pass 或 gap，作为 G3 子项。root 传被开发项目根的绝对路径。",
		snippet: "校对五处同集与字段名同集（check-scope）",
	},
	{
		name: "ddd_check_design",
		script: "check-design",
		label: "DDD 检查 check-design",
		description: "运行 check-design 校对契约表与 AC 覆盖、设计树与代码目录逐层同构、义务编号唯一与列头完整，输出 RESULT: pass 或 gap，作为 G4 子项。root 传被开发项目根的绝对路径。",
		snippet: "校对同构与契约表头（check-design）",
	},
	{
		name: "ddd_check_file_design",
		script: "check-file-design",
		label: "DDD 检查 check-file-design",
		description: "运行 check-file-design 校对文件级清单与目录级契约一致、被依赖清单闭合与覆盖判据达标，输出 RESULT: pass 或 gap，作为 G4 子项。root 传被开发项目根的绝对路径。",
		snippet: "校对文件级清单与被依赖闭合（check-file-design）",
	},
	{
		name: "ddd_check_code",
		script: "check-code",
		label: "DDD 检查 check-code",
		description: "运行 check-code 校对导出符号与两级设计签名一致、用例与模块级 AC 覆盖与基础能力独立用例存在，输出 RESULT: pass 或 gap，作为 G5 子项。root 传被开发项目根的绝对路径。",
		snippet: "校对导出符号与用例覆盖（check-code）",
	},
	{
		name: "ddd_check_consistency",
		script: "check-consistency",
		label: "DDD 检查 check-consistency",
		description: "运行 check-consistency 校对全量命名集合与计数声明三处一致、声明落点完备与无悬空引用，输出 RESULT: pass 或 gap，作为 G6 子项；语义部分由审计者承担。root 传被开发项目根的绝对路径。",
		snippet: "校对命名集合与落点完备（check-consistency）",
	},
];

// 交叉检查工具的调用时机说明：编排自动执行与手工复核共用同一工具面，措辞单一权威，避免两处各写一套语义
const CROSS_CHECK_USAGE = "调用时机：主链编排脚本在对应交叉检查节点自动调用本工具；根会话或人工在节点外手工复核同一检查时直接调用本工具，两处共用本工具面，语义唯一。";

// 结构化结果供脚本消费；字段与 structuredContent 同源
const OUTPUT_SCHEMA = Type.Object({
	script: Type.String({ description: "执行的脚本基名" }),
	root: Type.String({ description: "传入的项目根绝对路径" }),
	exitCode: Type.Union([Type.Number(), Type.Null()], { description: "脚本真实退出码，未执行或未正常返回为 null" }),
	status: Type.Union([Type.String(), Type.Null()], { description: "机读状态：RESULT 行的取值或 JSON 的 verdict，未解析为 null" }),
	ok: Type.Boolean({ description: "脚本存在且退出码为 0" }),
});

export default function (pi: ExtensionAPI) {
	const specs = [
		...TOOLS,
		...CROSS_CHECK_TOOLS.map((spec) => ({ ...spec, description: `${spec.description} ${CROSS_CHECK_USAGE}` })),
	];
	for (const spec of specs) {
		pi.registerTool({
			name: spec.name,
			label: spec.label,
			description: spec.description,
			promptSnippet: spec.snippet,
			parameters: PARAMETERS,
			outputSchema: OUTPUT_SCHEMA,
			async execute(_toolCallId, params) {
				return runCheck(pi, spec, params.root);
			},
		});
	}
}

async function runCheck(pi: ExtensionAPI, spec: { name: string; script: string }, root: string) {
	const scriptPath = join(PACKAGE_ROOT, "skills", "ddd-methodology", "scripts", `${spec.script}.js`);
	if (!existsSync(scriptPath)) {
		return failure(spec, root, null, null, `脚本缺失：${scriptPath}。请确认 ${spec.script}.js 随包发布，且其位置可由包根解析。`);
	}
	let result: ExecResult | undefined;
	try {
		result = (await pi.exec("node", [scriptPath, root], { timeout: EXEC_TIMEOUT_MS })) as ExecResult;
	} catch (error) {
		return failure(spec, root, null, null, `执行失败：${describeError(error)}`);
	}
	const exitCode = exitCodeOf(result);
	const stdout = result && typeof result.stdout === "string" ? result.stdout : "";
	const stderr = result && typeof result.stderr === "string" ? result.stderr : "";
	if ((result && result.error) || exitCode === null) {
		const reason = result && result.error ? describeError(result.error) : "进程未正常返回退出码，可能被信号终止";
		const tail = stderr.trim() ? `\n${truncate(stderr.trim(), 500)}` : "";
		return failure(spec, root, exitCode, null, `执行失败：${reason}${tail}`);
	}
	const status = parseStatus(stdout);
	const ok = exitCode === 0;
	return {
		content: [{ type: "text", text: buildSummary(spec, scriptPath, root, exitCode, status, stdout, stderr) }],
		details: { script: spec.script, root, exitCode, status },
		structuredContent: { script: spec.script, root, exitCode, status, ok },
		isError: !ok,
	};
}

function failure(spec: { name: string; script: string }, root: string, exitCode: number | null, status: string | null, reason: string) {
	return {
		content: [{ type: "text", text: `[${spec.name}] ${reason}` }],
		details: { script: spec.script, root, exitCode, status },
		structuredContent: { script: spec.script, root, exitCode, status, ok: false },
		isError: true,
	};
}

// 机读状态：优先取 JSON 的 verdict，退回末行 `RESULT: xxx` 的 xxx
function parseStatus(stdout: string): string | null {
	const json = tryParseJson(stdout);
	if (json && typeof (json as { verdict?: unknown }).verdict === "string") return (json as { verdict: string }).verdict;
	const lines = stdout.split("\n");
	for (let i = lines.length - 1; i >= 0; i--) {
		const match = /^RESULT:\s*(\S+)\s*$/.exec(lines[i].trim());
		if (match) return match[1];
	}
	return null;
}

// 关键结论行：governance 的 JSON 取 reasons，其余取末尾若干非空且非机读行的输出
function extractKeyLines(stdout: string): string[] {
	const json = tryParseJson(stdout);
	if (json && typeof (json as { verdict?: unknown }).verdict === "string") {
		const reasons = (json as { reasons?: unknown }).reasons;
		if (Array.isArray(reasons) && reasons.length) return reasons.slice(0, KEY_LINE_LIMIT).map(String);
		return [`verdict: ${(json as { verdict: string }).verdict}`];
	}
	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "" && !line.startsWith("RESULT:"))
		.slice(-KEY_LINE_LIMIT);
}

function buildSummary(
	spec: { name: string; script: string },
	scriptPath: string,
	root: string,
	exitCode: number,
	status: string | null,
	stdout: string,
	stderr: string,
): string {
	const lines = [`[${spec.name}] 根：${root}`, `退出码：${exitCode}；状态：${status ?? "未解析"}`];
	const key = extractKeyLines(stdout);
	if (key.length) {
		lines.push("关键结论：");
		for (const line of key) lines.push(`  ${line}`);
	} else {
		lines.push("未解析到结论行，请直接运行脚本查看完整输出。");
	}
	if (stderr.trim()) lines.push(`stderr：${truncate(stderr.trim(), 300)}`);
	let text = lines.join("\n");
	// 回看提示用经包根解析的绝对脚本路径，不用仅相对调用方 cwd 才成立的相对路径
	if (text.length > SUMMARY_MAX_CHARS) text = `${text.slice(0, SUMMARY_MAX_CHARS)}\n…摘要已截断，完整输出请直接运行 ${scriptPath}。`;
	return text;
}

function tryParseJson(text: string): Record<string, unknown> | null {
	const trimmed = text.trim();
	if (!trimmed.startsWith("{")) return null;
	try {
		return JSON.parse(trimmed) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max)}…` : text;
}
