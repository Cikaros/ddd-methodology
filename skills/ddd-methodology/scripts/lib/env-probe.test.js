/**
 * 目标：为环境探测的无副作用核心补纯函数单元测试，覆盖可用、不可用、多形态取优先级、全缺失四类情形，并验证顺序无关；
 *   不可用一类含两态，即四级均不命中与路径存在但不可执行；
 *   另覆盖测试框架事实的三态（内建可用、已装可用、未安装）与记录装配的四键与可选第五键。
 * 范围：env-probe.js 的 buildTools、deriveLanguages、deriveFrameworks、buildEnvRecord、appendGitignoreExclusion 纯函数、parseVersionOutput 原语与 probeCommand 的注入驱动，
 *   以及 env-resolve.js 的 resolveExecutablePath 目录级原语（四级优先链的逐级命中与其来源级别由同目录 env-resolve.test.js 承接）。
 * 运行：node --test skills/ddd-methodology/scripts/lib/env-probe.test.js。
 * 不包含：进程调用与文件读写（由 scripts/env-probe.js 注入）、记录落盘、命令行入口装配；多版本记录、命令组装与所需版本声明归同目录 env-command.test.js。
 */

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const {
  LANGUAGE_FORMS,
  parseVersionOutput,
  probeCommand,
  buildTools,
  deriveLanguages,
  deriveFrameworks,
  buildEnvRecord,
  appendGitignoreExclusion,
} = require("./env-probe.js");
const { resolveExecutablePath } = require("./env-resolve.js");

// 夹具：由可用命令名集合造探测结果清单，路径、来源与可用性一律造为固定值，供纯函数消费
const resultsOf = (names) => names.map((name) => ({ name, path: `/usr/bin/${name}`, version: "1.2.3", source: "path", available: true }));

test("可用：解析到路径的工具记 available 为真并标明来源级别，语言取到可用形态", () => {
  const tools = buildTools(resultsOf(["node", "tsc"]));
  assert.deepStrictEqual(tools.node, { path: "/usr/bin/node", source: "path", version: "1.2.3", available: true });
  const languages = deriveLanguages(tools);
  assert.deepStrictEqual(languages.javascript, { runner: "node", available: true });
  assert.deepStrictEqual(languages.typescript, { runner: "node", available: true });
});

test("不可用两态：四级均不命中者 path 为空，路径存在但不可执行者保留 path 与来源", () => {
  const tools = buildTools([
    { name: "bun", path: null, version: null, source: null, available: false },
    { name: "eslint", path: "/bin/eslint", version: null, source: "path", available: false },
  ]);
  assert.deepStrictEqual(tools.bun, { path: null, source: null, version: null, available: false });
  assert.deepStrictEqual(tools.eslint, { path: "/bin/eslint", source: "path", version: null, available: false });
  // 失去首选 uv，但次优先的 python3 与 pytest 均在，python 仍应为可用且落到次优先形态
  const languages = deriveLanguages(buildTools(resultsOf(["python3", "pytest"])));
  assert.deepStrictEqual(languages.python, { runner: "python3", available: true });
});

test("多形态取优先级：多候选同时就绪时取优先级最高者", () => {
  const python = deriveLanguages(buildTools(resultsOf(["uv", "python3", "pytest"]))).python;
  assert.deepStrictEqual(python, { runner: "uv run python", available: true });
  const js = deriveLanguages(buildTools(resultsOf(["bun", "node"]))).javascript;
  assert.deepStrictEqual(js, { runner: "bun", available: true });
});

test("全缺失：无任何可用工具时全部语言记不可用", () => {
  const tools = buildTools([]);
  assert.deepStrictEqual(tools, {});
  const languages = deriveLanguages(tools);
  for (const name of Object.keys(LANGUAGE_FORMS)) assert.strictEqual(languages[name].available, false);
  assert.deepStrictEqual(languages.python, { runner: null, available: false });
});

test("顺序无关：结果清单乱序不改工具事实与语言形态", () => {
  const names = ["uv", "python3", "pytest", "node", "bun", "cargo"];
  const ordered = deriveLanguages(buildTools(resultsOf(names)));
  const shuffled = deriveLanguages(buildTools(resultsOf([...names].reverse())));
  assert.deepStrictEqual(shuffled, ordered);
});

test("记录装配：四键齐全且键序为 probedAt、tools、languages、frameworks", () => {
  const record = buildEnvRecord({ probedAt: "2020-01-01T00:00:00.000Z", tools: {}, languages: {}, frameworks: {} });
  assert.deepStrictEqual(Object.keys(record), ["probedAt", "tools", "languages", "frameworks"]);
});

test("记录装配：required 仅在声明时并入，未声明不落该键", () => {
  const base = { probedAt: "2020-01-01T00:00:00.000Z", tools: {}, languages: {}, frameworks: {} };
  assert.ok(!("required" in buildEnvRecord(base)), "未声明时不得落 required 键");
  const withRequired = buildEnvRecord({ ...base, required: { javascript: "22.23.3" } });
  assert.deepStrictEqual(withRequired.required, { javascript: "22.23.3" });
  assert.deepStrictEqual(Object.keys(withRequired), ["probedAt", "tools", "languages", "frameworks", "required"]);
});

test("记录装配：required 缺省与空对象两种入参下顶层恰为四键且无 required", () => {
  const base = { probedAt: "2020-01-01T00:00:00.000Z", tools: {}, languages: {}, frameworks: {} };
  for (const required of [undefined, {}]) {
    const record = buildEnvRecord({ ...base, required });
    assert.deepStrictEqual(Object.keys(record), ["probedAt", "tools", "languages", "frameworks"]);
    assert.ok(!("required" in record), "缺省或空对象时不得落 required 键");
  }
});

test("路径解析：按目录与扩展名组合命中首个存在的文件", () => {
  const target = path.join("/b", "node.exe");
  const isFile = (candidate) => candidate === target;
  assert.strictEqual(resolveExecutablePath("node", ["/a", "/b"], ["", ".exe"], isFile), target);
});

test("路径解析：全部候选缺失回 null", () => {
  assert.strictEqual(resolveExecutablePath("ghost", ["/a", "/b"], [""], () => false), null);
});

test("版本串抽取：从各式输出取版本号，空输出回 null", () => {
  assert.strictEqual(parseVersionOutput("v22.23.3\n"), "22.23.3");
  assert.strictEqual(parseVersionOutput('openjdk version "17.0.2" 2022-01-18'), "17.0.2");
  assert.strictEqual(parseVersionOutput("go version go1.21.5 windows/amd64"), "1.21.5");
  assert.strictEqual(parseVersionOutput("   "), null);
  assert.strictEqual(parseVersionOutput("no digits here"), "no digits here");
});

test("单命令探测：路径缺失记缺失态；路径在位而取不到版本记不可执行态，两态以 path 相区分", () => {
  const node = path.join("/bin", "node");
  const ctx = { pathDirs: ["/bin"], exts: [""], isFile: (candidate) => candidate === node, runVersion: () => "v1.2.3" };
  assert.deepStrictEqual(probeCommand("node", ctx), { name: "node", path: node, version: "1.2.3", source: "path", available: true });

  const missing = { ...ctx, isFile: () => false };
  assert.deepStrictEqual(probeCommand("node", missing), { name: "node", path: null, version: null, source: null, available: false });

  const pwsh = path.join("/bin", "pwsh");
  const pwshCtx = { pathDirs: ["/bin"], exts: [""], isFile: (candidate) => candidate === pwsh, runVersion: () => "" };
  assert.deepStrictEqual(probeCommand("PSScriptAnalyzer", pwshCtx), { name: "PSScriptAnalyzer", path: pwsh, version: null, source: "path", available: false }, "承载者在位而模块不在属不可执行态，path 非空");
});

// ── 测试框架事实（设计册第十节其一；三态：内建可用、已装可用、未安装） ──

test("框架事实：外部框架依「可执行文件在位且可执行」定可用，未安装与在位而不可执行两态均不记可用", () => {
  const tools = buildTools(resultsOf(["node", "bun"]));
  const languages = deriveLanguages(tools);
  const results = [
    { name: "pytest", path: null, version: null, source: null, available: false },
    { name: "jest", path: "/usr/bin/jest", version: "29.7.0", source: "path", available: true },
    { name: "vitest", path: "/usr/bin/vitest", version: null, source: "path", available: false },
  ];
  const frameworks = deriveFrameworks(tools, languages, results);
  assert.deepStrictEqual(frameworks.pytest, { kind: "external", runner: null, path: null, source: null, version: null, available: false });
  assert.deepStrictEqual(frameworks.jest, { kind: "external", runner: null, path: "/usr/bin/jest", source: "path", version: "29.7.0", available: true });
  assert.deepStrictEqual(frameworks.vitest, { kind: "external", runner: null, path: "/usr/bin/vitest", source: "path", version: null, available: false }, "路径在位而不可执行者不得记可用，免得组装出跑不起来的命令");
});

test("框架事实：内建框架随所依附运行器定可用并承其来源级别，运行器缺席即不可用", () => {
  const frameworks = deriveFrameworks(buildTools(resultsOf(["node"])), deriveLanguages(buildTools(resultsOf(["node"]))), []);
  assert.deepStrictEqual(frameworks["node:test"], { kind: "builtin", runner: "node", path: "/usr/bin/node", source: "path", version: "1.2.3", available: true });
  assert.deepStrictEqual(frameworks["bun:test"], { kind: "builtin", runner: "bun", path: null, source: null, version: null, available: false });
  assert.strictEqual(frameworks["deno:test"].available, false);
  assert.strictEqual(frameworks.unittest.available, false);
});

test("框架事实：python 由 uv 提供时 unittest 记内建可用", () => {
  const tools = buildTools(resultsOf(["uv"]));
  const frameworks = deriveFrameworks(tools, deriveLanguages(tools), [{ name: "pytest", path: null, version: null, source: null, available: false }]);
  assert.strictEqual(frameworks.unittest.kind, "builtin");
  assert.strictEqual(frameworks.unittest.available, true);
});

// ── .gitignore 排除规则追加（入库保证的判据内核） ──

test("排除追加：已含精确规则行时回 null，不重复写", () => {
  assert.strictEqual(appendGitignoreExclusion("docs/.ddd-env.json\n", "docs/.ddd-env.json"), null);
  // 周围有其他规则与空行时仍算已含，去掉首尾空白后相等即可命中
  assert.strictEqual(appendGitignoreExclusion("node_modules/\n\n  docs/.ddd-env.json  \n", "docs/.ddd-env.json"), null);
  // 注释行提到该路径不算规则
  assert.notStrictEqual(appendGitignoreExclusion("# docs/.ddd-env.json\n", "docs/.ddd-env.json"), null);
});

test("排除追加：已含斜杠前缀规则行时回 null", () => {
  assert.strictEqual(appendGitignoreExclusion("/docs/.ddd-env.json\n", "docs/.ddd-env.json"), null);
  assert.strictEqual(appendGitignoreExclusion("node_modules/\n/docs/.ddd-env.json\n", "docs/.ddd-env.json"), null);
});

test("排除追加：空文本直接由说明注释起首，回注释加规则两行", () => {
  const out = appendGitignoreExclusion("", "docs/.ddd-env.json");
  assert.strictEqual(out, "# 环境记录随机器而异，纳入版本控制会让同仓库不同机器互相覆盖\ndocs/.ddd-env.json\n");
});

test("排除追加：含其他内容时保留原内容并追加，末尾无换行先行分隔", () => {
  const withNewline = appendGitignoreExclusion("node_modules/\n", "docs/.ddd-env.json");
  assert.strictEqual(withNewline, "node_modules/\n# 环境记录随机器而异，纳入版本控制会让同仓库不同机器互相覆盖\ndocs/.ddd-env.json\n");
  const noNewline = appendGitignoreExclusion("node_modules/", "docs/.ddd-env.json");
  assert.strictEqual(noNewline, "node_modules/\n# 环境记录随机器而异，纳入版本控制会让同仓库不同机器互相覆盖\ndocs/.ddd-env.json\n");
  // 原内容整段保留，不改动既有行
  assert.ok(noNewline.startsWith("node_modules/\n# "), "原内容须逐字保留");
});
