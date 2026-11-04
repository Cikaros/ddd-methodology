/**
 * pi 版本与声明范围的纯比对逻辑
 *
 * 目标：把扩展侧运行时版本比对的核心判定外化为无副作用的纯函数，供 ddd-context.ts 调用并被独立测试。
 * 范围：三项——三段式版本解析、两个版本之间的比较、单个版本对语义化版本范围的满足判定。
 * 不包含：pi 版本的获取途径（见上层 ddd-context.ts）、比对结果的呈现方式；本模块不读文件、不触网络、不依赖宿主。
 *
 * 判定三态语义：命中所声明范围为 in-range，落在范围外为 out-of-range，版本或范围任一无法解析为 invalid。
 * 调用方对 invalid 一律静默跳过，故本模块只做判定，不抛错。
 * 依赖：只用语言内建能力，不引第三方包，故任何扩展与测试均可安全导入。
 */

export type RangeVerdict = "in-range" | "out-of-range" | "invalid";

type Triple = [number, number, number];
type Operator = ">" | ">=" | "<" | "<=" | "=";
type Comparator = { op: Operator; bound: Triple };

// 只认三段式：pi 版本为三段式；预发布与构建元数据不入判定，带后缀者按解析失败处理，宁可跳过不误判
const CORE_RE = /^(\d+)\.(\d+)\.(\d+)$/;
// 比较记号：缺省运算符与 = 等价；^ 与 ~ 展开为原始比较式，展开规则见 expandComparator
const COMPARATOR_RE = /^(>=|<=|>|<|=|\^|~)?(\d+\.\d+\.\d+)$/;

export function parseVersion(text: string): Triple | null {
	if (typeof text !== "string") return null;
	const match = CORE_RE.exec(text.trim());
	if (!match) return null;
	return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareTriples(a: Triple, b: Triple): number {
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
	}
	return 0;
}

// 两版本比较：任一侧无法解析返回 null；a 低于 b 为 -1，等于为 0，高于为 1
export function compareVersions(a: string, b: string): number | null {
	const left = parseVersion(a);
	const right = parseVersion(b);
	if (!left || !right) return null;
	return compareTriples(left, right);
}

// 记号的展开：^ 与 ~ 是大版本、次版本向上兼容的常用写法，各展开为两条原始比较式；未知运算符或非法版本返回 null
function expandComparator(token: string): Comparator[] | null {
	const match = COMPARATOR_RE.exec(token);
	if (!match) return null;
	const bound = parseVersion(match[2]);
	if (!bound) return null;
	const op = match[1];
	if (op === undefined || op === "=") return [{ op: "=", bound }];
	if (op === ">" || op === ">=" || op === "<" || op === "<=") return [{ op, bound }];
	if (op === "~") return [{ op: ">=", bound }, { op: "<", bound: [bound[0], bound[1] + 1, 0] }];
	// ^ 按大版本向上兼容展开；pi 版本为 1.x，主版本大于零的前提成立
	return [{ op: ">=", bound }, { op: "<", bound: [bound[0] + 1, 0, 0] }];
}

// 范围解析：空格分隔的比较式取交集（全部满足），|| 分隔的集合取并集（任一满足）；任一记号非法即整体判非法
function parseRange(range: string): Comparator[][] | null {
	if (typeof range !== "string" || range.trim() === "") return null;
	const alternatives: Comparator[][] = [];
	for (const part of range.trim().split("||")) {
		const tokens = part.trim().split(/\s+/).filter(Boolean);
		if (tokens.length === 0) return null;
		const comparators: Comparator[] = [];
		for (const token of tokens) {
			const expanded = expandComparator(token);
			if (!expanded) return null;
			comparators.push(...expanded);
		}
		alternatives.push(comparators);
	}
	return alternatives.length ? alternatives : null;
}

function satisfies(comparators: Comparator[], version: Triple): boolean {
	return comparators.every(({ op, bound }) => {
		const order = compareTriples(version, bound);
		if (op === ">") return order > 0;
		if (op === ">=") return order >= 0;
		if (op === "<") return order < 0;
		if (op === "<=") return order <= 0;
		return order === 0;
	});
}

// 判定入口：版本或范围任一无法解析即 invalid；否则按并集语义判定是否命中范围
export function checkVersionInRange(version: string, range: string): RangeVerdict {
	const detected = parseVersion(version);
	if (!detected) return "invalid";
	const alternatives = parseRange(range);
	if (!alternatives) return "invalid";
	return alternatives.some((comparators) => satisfies(comparators, detected)) ? "in-range" : "out-of-range";
}
