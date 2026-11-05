/**
 * 守卫的纯判定与纯助手
 *
 * 目标：把守卫的判定收敛为无副作用的纯函数，输入为路径、文本与已抽取的事实集合，供 ddd-governance.ts 调用，
 *   并配套 node --test 单元测试；事实抽取（读 ARCHITECTURE.md、遍历设计树）与拦截理由组装留在扩展侧。
 * 范围：三类。其一，H-5 代码根前缀、H-6 设计目录成员、H-7 语言基线成员三项判定；
 *   其二，H-1 源码文件判定与行数统计、H-2 全量测试命令归一、H-3 节点表覆盖范围判定四项纯助手。
 * 不包含：读盘与遍历、拦截理由文本、宿主通知与激活判据。
 *
 * 放行优先：事实集合为空即返回 false，信息不足时不误伤；判定只拦明确的越权与缺档，不做模糊猜测。
 * 本文件位于 extensions/lib/，该目录无 index.ts，不被宿主当作扩展入口加载。
 * 依据：设计 DESIGN-extensions.md 第二节 H-1 至 H-7 行与第七节守卫判定函数为纯函数的要求。
 */

// 源码扩展名集合：H-1 行数估算与 H-3/5/6/7 源码判定共用
const SOURCE_EXTENSIONS = new Set([
	"ts", "tsx", "js", "jsx", "mjs", "cjs", "vue", "svelte",
	"py", "go", "rs", "java", "kt", "kts", "cs", "rb", "php", "swift", "scala", "dart", "lua",
	"c", "h", "cc", "cpp", "cxx", "hpp", "csx", "m", "mm", "sql", "sh", "ps1",
]);

// 全量测试调用形态：只收整仓命令的窄口径写法，带文件参数、含管道或串联的形态一律不判定
const FULL_TEST_COMMANDS = [
	/^(?:npm|pnpm|yarn)\s+(?:run\s+)?test$/i,
	/^node\s+--test$/i,
	/^(?:jest|vitest)\s+run$/i,
	/^pytest$/i,
	/^python\d?(?:\.\d+)?\s+-m\s+pytest$/i,
	/^go\s+test\s+\.\/\.\.\.$/i,
	/^cargo\s+test$/i,
	/^mvn\s+(?:-\S+\s+)*test$/i,
	/^dotnet\s+test$/i,
	/^bun\s+test$/i,
	/^deno\s+test$/i,
];

export function isSourceFile(filePath: string): boolean {
	const name = filePath.split(/[\\/]/).pop() || "";
	const dot = name.lastIndexOf(".");
	if (dot <= 0) return false;
	return SOURCE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

// 行数统计：忽略末尾换行，空文本为零行
export function countLines(text: unknown): number {
	if (typeof text !== "string" || text === "") return 0;
	const trimmed = text.replace(/\n+$/, "");
	return trimmed === "" ? 0 : trimmed.split("\n").length;
}

// 全量测试命令归一：剥 cd 前缀与环境变量赋值；含串联、管道、重定向或子命令替换的形态回 null，一律放行
export function normalizeFullTestCommand(command: string): string | null {
	let cmd = command.trim().replace(/\s+/g, " ");
	if (cmd === "") return null;
	const cdPrefix = /^cd [^&|;]+ && (.+)$/.exec(cmd);
	if (cdPrefix) cmd = cdPrefix[1].trim();
	cmd = cmd.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s&|;]+ )+/, "").trim();
	if (cmd === "" || /[&|;`$<>]/.test(cmd)) return null;
	return cmd;
}

// 全量测试命令判定：归一并匹配窄口径形态
export function isFullTestCommand(command: string): boolean {
	const normalized = normalizeFullTestCommand(command);
	return normalized !== null && FULL_TEST_COMMANDS.some((pattern) => pattern.test(normalized));
}

// 覆盖判定：节点表覆盖范围列须等于目标相对路径，或以该值为目录前缀，避免子串误命中
export function coversFile(nodeText: string, relFile: string): boolean {
	for (const line of nodeText.split("\n")) {
		if (!line.trim().startsWith("|")) continue;
		const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
		if (cells.length < 6 || !cells[0] || cells[0] === "节点编号" || /^-+$/.test(cells[0])) continue;
		const coverage = cells[5].replace(/`/g, "").replace(/\/$/, "");
		if (!coverage) continue;
		if (relFile === coverage || relFile.startsWith(coverage + "/")) return true;
	}
	return false;
}

// 统一到 POSIX 相对路径：抹平盘符分隔差异、去开头 ./ 与结尾 /，避免同一目录两种写法漏判
function toPosix(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

// H-5 目录越权：目标源码未被任何设计树映射的代码根覆盖即拦；代码根为空表示无设计树，放行
export function shouldBlockDirectoryScope(relFile: string, codeRoots: readonly string[]): boolean {
	if (typeof relFile !== "string" || relFile === "") return false;
	const roots = (Array.isArray(codeRoots) ? codeRoots : []).map(toPosix).filter((root) => root !== "");
	if (roots.length === 0) return false;
	const file = toPosix(relFile);
	return !roots.some((root) => file === root || file.startsWith(`${root}/`));
}

// H-6 结构不同构：目标所在目录不在设计树节点目录内即拦；设计目录为空表示无设计树，放行
export function shouldBlockStructureIsomorphism(relDir: string, designDirs: readonly string[]): boolean {
	const dirs = (Array.isArray(designDirs) ? designDirs : []).map(toPosix);
	if (dirs.length === 0) return false;
	const dir = typeof relDir === "string" ? toPosix(relDir) : "";
	return !dirs.includes(dir);
}

// H-7 语言基线：目标语言不在项目已建立的编译基线内即拦；语言未知或基线集为空即放行
export function shouldBlockLanguageBaseline(language: string | null, establishedLanguages: readonly string[]): boolean {
	if (typeof language !== "string" || language === "") return false;
	const established = (Array.isArray(establishedLanguages) ? establishedLanguages : []).filter(
		(item): item is string => typeof item === "string",
	);
	if (established.length === 0) return false;
	return !established.includes(language);
}
