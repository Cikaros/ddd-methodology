/**
 * 目标：为四级工具解析优先链（lib/env-resolve.js）补纯函数单元测试，覆盖四级各自命中、项目内部优先于全局、四级均不命中记不可用、来源取值合法四类，
 *   另覆盖 Windows 与类 Unix 两类位置、brew Cellar 展开、命中即停与某一级缺席时只降级不报缺陷，并以乱序调用验证顺序无关。
 * 范围：env-resolve.js 的 SOURCE_LEVELS 值域、resolveExecutablePath 目录级原语与 resolveWithSource 四级解析；位置表与目录列举均由注入的 ctx 驱动，不读写真实文件系统。
 * 运行：node --test skills/ddd-methodology/scripts/lib/env-resolve.test.js。
 * 不包含：探测主链、版本查询、管理器识别、命令组装与记录落盘（各见同目录其余模块与其测试）。
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { SOURCE_LEVELS, resolveExecutablePath, resolveWithSource } = require("./env-resolve.js");

// 夹具：只认给定文件的解析上下文，四类位置分别由 root、pathDirs、platform/env 与 listDir 驱动
const ctxOf = ({ root = "", pathDirs = [], platform = "posix", env = {}, files = [], dirs = {}, exts = [""] } = {}) => ({
  root,
  pathDirs,
  platform,
  env,
  exts,
  isFile: (candidate) => files.includes(candidate),
  listDir: (dir) => dirs[dir] || [],
});

const join = (...parts) => path.join(...parts);

test("来源值域：四级固定为 project、path、default、package-manager", () => {
  assert.deepStrictEqual(SOURCE_LEVELS, ["project", "path", "default", "package-manager"]);
});

test("第一级项目内部命中：node_modules/.bin 下的命令取项目内部且记 source 为 project", () => {
  const target = join("/proj", "node_modules", ".bin", "jest");
  assert.deepStrictEqual(resolveWithSource("jest", ctxOf({ root: "/proj", pathDirs: ["/usr/bin"], files: [target] })), { path: target, source: "project" });
});

test("第一级项目内部命中：.venv/bin 与 venv/bin 同为项目内部位置", () => {
  const venv = join("/proj", ".venv", "bin", "pytest");
  const plain = join("/proj", "venv", "bin", "pytest");
  assert.deepStrictEqual(resolveWithSource("pytest", ctxOf({ root: "/proj", files: [venv] })), { path: venv, source: "project" });
  assert.deepStrictEqual(resolveWithSource("pytest", ctxOf({ root: "/proj", files: [plain] })), { path: plain, source: "project" });
});

test("第二级当前环境命中：PATH 目录下的命令记 source 为 path", () => {
  const target = join("/usr/bin", "node");
  assert.deepStrictEqual(resolveWithSource("node", ctxOf({ pathDirs: ["/opt/bin", "/usr/bin"], files: [target] })), { path: target, source: "path" });
});

test("第三级默认安装位置命中：系统常规目录下的命令记 source 为 default", () => {
  const target = join("/usr/local/bin", "grep");
  assert.deepStrictEqual(resolveWithSource("grep", ctxOf({ files: [target] })), { path: target, source: "default" });
});

test("第四级包管理器位置命中：brew 可执行目录下的命令记 source 为 package-manager", () => {
  const target = join("/opt/homebrew/bin", "grep");
  assert.deepStrictEqual(resolveWithSource("grep", ctxOf({ files: [target] })), { path: target, source: "package-manager" });
});

test("第四级包管理器位置命中：brew Cellar 按 formula/version/bin 展开后试探", () => {
  const target = join("/usr/local/Cellar", "node", "22.23.3", "bin", "node");
  const ctx = ctxOf({
    files: [target],
    dirs: { "/usr/local/Cellar": ["node"], [join("/usr/local/Cellar", "node")]: ["22.23.3", "20.19.0"] },
  });
  assert.deepStrictEqual(resolveWithSource("node", ctx), { path: target, source: "package-manager" });
});

test("四级均不命中：path 与 source 皆为 null，不猜测也不回退", () => {
  assert.deepStrictEqual(resolveWithSource("ghost", ctxOf({ root: "/proj", pathDirs: ["/usr/bin"] })), { path: null, source: null });
});

test("优先级：项目内部优先于全局，全局优先于默认位置与包管理器位置", () => {
  const project = join("/proj", "node_modules", ".bin", "jest");
  const onPath = join("/usr/bin", "jest");
  const fallback = join("/usr/local/bin", "jest");
  const manager = join("/opt/homebrew/bin", "jest");
  const all = [project, onPath, fallback, manager];
  assert.strictEqual(resolveWithSource("jest", ctxOf({ root: "/proj", pathDirs: ["/usr/bin"], files: all })).path, project, "项目内部须压过其余三级");
  assert.strictEqual(resolveWithSource("jest", ctxOf({ pathDirs: ["/usr/bin"], files: all.slice(1) })).source, "path");
  assert.strictEqual(resolveWithSource("jest", ctxOf({ files: all.slice(2) })).source, "default");
});

test("来源合法性：四次命中各得一级且取值均在值域内，四级各现一次", () => {
  const cases = [
    { ctx: ctxOf({ root: "/proj", pathDirs: ["/usr/bin"], files: [join("/proj", "node_modules", ".bin", "cmd")] }), expected: "project" },
    { ctx: ctxOf({ pathDirs: ["/usr/bin"], files: [join("/usr/bin", "cmd")] }), expected: "path" },
    { ctx: ctxOf({ files: [join("/usr/local/bin", "cmd")] }), expected: "default" },
    { ctx: ctxOf({ files: [join("/opt/homebrew/bin", "cmd")] }), expected: "package-manager" },
  ];
  for (const item of cases) {
    const { source } = resolveWithSource("cmd", item.ctx);
    assert.strictEqual(source, item.expected);
    assert.ok(SOURCE_LEVELS.includes(source), `来源 ${source} 须在四级值域内`);
  }
});

test("Windows：系统目录取 SystemRoot 下的 System32，scoop 取 shims 作包管理器位置", () => {
  const systemRoot = "C:\\Windows";
  const cmd = join(systemRoot, "System32", "cmd.EXE");
  const systemCtx = ctxOf({ platform: "win32", env: { SystemRoot: systemRoot }, exts: [".EXE", ""], files: [cmd] });
  assert.deepStrictEqual(resolveWithSource("cmd", systemCtx), { path: cmd, source: "default" });

  const bun = join("D:\\Scoop", "shims", "bun.EXE");
  const scoopCtx = ctxOf({ platform: "win32", env: { SCOOP: "D:\\Scoop" }, exts: [".EXE", ""], files: [bun] });
  assert.deepStrictEqual(resolveWithSource("bun", scoopCtx), { path: bun, source: "package-manager" });
});

test("降级不报缺陷：无系统根、无 scoop 根与 Cellar 公式目录不可读三态只往下一级查", () => {
  const onPath = join("D:\\tools", "node.exe");
  const winCtx = ctxOf({ platform: "win32", pathDirs: ["D:\\tools"], env: {}, exts: [".exe"], files: [onPath] });
  assert.deepStrictEqual(resolveWithSource("node", winCtx), { path: onPath, source: "path" }, "系统根与 scoop 根皆缺时 PATH 级仍须命中");

  const node = join("/usr/local/Cellar", "node", "22.23.3", "bin", "node");
  const cellarCtx = ctxOf({ files: [node], dirs: { "/usr/local/Cellar": ["node", "ghost"], [join("/usr/local/Cellar", "node")]: ["22.23.3"] } });
  assert.deepStrictEqual(resolveWithSource("node", cellarCtx), { path: node, source: "package-manager" }, "公式的版本目录不可读只少一条候选，其余候选仍须命中");
});

test("命中即停：上一级命中后不再试探更深一级的目录", () => {
  const target = join("/proj", "node_modules", ".bin", "jest");
  const probed = [];
  const ctx = ctxOf({ root: "/proj", pathDirs: ["/usr/bin"], files: [target] });
  const seen = { ...ctx, isFile: (candidate) => { probed.push(candidate); return candidate === target; } };
  assert.deepStrictEqual(resolveWithSource("jest", seen), { path: target, source: "project" });
  assert.deepStrictEqual(probed, [target], "项目内部命中后不得再探 PATH 目录");
});

test("目录级原语：目录与扩展名两层组合命中首个存在的文件，全无回 null", () => {
  const target = join("/bin", "node.cmd");
  const isFile = (candidate) => candidate === target;
  assert.strictEqual(resolveExecutablePath("node", ["/a", "/bin"], [".exe", ".cmd"], isFile), target);
  assert.strictEqual(resolveExecutablePath("ghost", ["/a", "/bin"], [""], () => false), null);
});

test("顺序无关：同一组解析上下文乱序调用结果一致", () => {
  const cases = [
    ["jest", ctxOf({ root: "/proj", files: [join("/proj", "node_modules", ".bin", "jest")] })],
    ["node", ctxOf({ pathDirs: ["/usr/bin"], files: [join("/usr/bin", "node")] })],
    ["grep", ctxOf({ files: [join("/usr/local/bin", "grep")] })],
    ["kcov", ctxOf({ files: [join("/opt/homebrew/bin", "kcov")] })],
  ];
  const resolveAll = (list) => list.map(([command, ctx]) => resolveWithSource(command, ctx));
  assert.deepStrictEqual(resolveAll([...cases].reverse()).reverse(), resolveAll(cases));
});
