/**
 * 目标：为环境探测的无副作用核心补纯函数单元测试，覆盖可用、不可用、多形态取优先级、全缺失四类情形，并验证顺序无关；
 *   不可用一类含两态，即四级均不命中与路径存在但不可执行；
 *   另覆盖多版本记录（管理器在位与不在位、版本清单为空）、运行时提供者（清单取自语言列出命令、清单为空时的降级与降级登记）
 *   与命令组装（无所需版本、所需版本拼合、所需不在清单、占位符残留）三类新情形。
 * 范围：env-probe.js 的 buildTools、deriveLanguages、deriveFrameworks、buildEnvRecord 纯函数、parseVersionOutput 原语与 probeCommand 的注入驱动，
 *   以及 env-resolve.js 的 resolveExecutablePath 目录级原语（四级优先链的逐级命中与其来源级别由同目录 env-resolve.test.js 承接）；
 *   以及 env-command.js 的 parseVersionList、collectManagers、enrichTools、versionCheckDowngrades、buildCommand、composeCommand 的多版本与组装路径，候选集组装的命中、优先级、条件不成立、全部不成立报缺口四类。
 * 运行：node --test skills/ddd-methodology/scripts/lib/env-probe.test.js。
 * 不包含：进程调用与文件读写（由 scripts/env-probe.js 注入）、记录落盘、命令行入口装配。
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
} = require("./env-probe.js");
const { resolveExecutablePath } = require("./env-resolve.js");
const {
  parseVersionList,
  collectManagers,
  enrichTools,
  versionCheckDowngrades,
  buildCommand,
  composeCommand,
} = require("./env-command.js");

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

// 夹具：注入式探测上下文，只认给定可执行文件；管理器列出命令的输出按可执行文件路径取
const managerCtx = (files, outputs = {}) => ({
  pathDirs: ["/bin"],
  exts: [""],
  isFile: (candidate) => files.includes(candidate),
  runManager: (file) => outputs[file] || "",
});

// 夹具：只装 uv 一行可用的 python 环境记录，供组装用例复用
const uvRecord = () => ({
  languages: { python: { runner: "uv run python", available: true } },
  tools: { uv: { path: "/bin/uv", version: "0.13.7", available: true, manager: "", versions: ["0.13.7"], active: "0.13.7" } },
});

test("版本清单解析：多行输出去重保序，无版本号回空清单", () => {
  assert.deepStrictEqual(parseVersionList("* 22.23.3  (default)\n  18.20.8\n  22.23.3\n"), ["22.23.3", "18.20.8"]);
  assert.deepStrictEqual(parseVersionList("no versions here"), []);
  assert.deepStrictEqual(parseVersionList(""), []);
});

test("管理器在位：命中候选管理器并取其版本清单，激活取工具自身版本", () => {
  const nvmPath = path.join("/bin", "nvm");
  const ctx = managerCtx([nvmPath], { [nvmPath]: "* 22.23.3  (default)\n  18.20.8\n" });
  const facts = collectManagers(buildTools([{ name: "node", path: "/bin/node", version: "22.23.3", source: "path", available: true }]), ctx);
  assert.deepStrictEqual(facts.node, { manager: "nvm", versions: ["22.23.3", "18.20.8"], active: "22.23.3" });
});

test("管理器不在位：只记单一命令与版本文本，不调列出命令", () => {
  const ctx = managerCtx([], {});
  const facts = collectManagers(buildTools([{ name: "node", path: "/bin/node", version: "22.23.3", source: "path", available: true }]), ctx);
  assert.deepStrictEqual(facts.node, { manager: "", versions: ["22.23.3"], active: "22.23.3" });
});

test("通用管理器：专有管理器不在位时落到 mise", () => {
  const misePath = path.join("/bin", "mise");
  const ctx = managerCtx([misePath], { [misePath]: "node 20.11.0\nnode 18.20.8\n" });
  const facts = collectManagers(buildTools([{ name: "node", path: "/bin/node", version: "22.23.3", source: "path", available: true }]), ctx);
  assert.strictEqual(facts.node.manager, "mise");
  assert.deepStrictEqual(facts.node.versions, ["20.11.0", "18.20.8"]);
});

test("版本清单为空：管理器在位但列出命令失败即降级为单一版本文本，不报缺陷", () => {
  const nvmPath = path.join("/bin", "nvm");
  const ctx = managerCtx([nvmPath], { [nvmPath]: "" });
  const facts = collectManagers(buildTools([{ name: "node", path: "/bin/node", version: "22.23.3", source: "path", available: true }]), ctx);
  assert.deepStrictEqual(facts.node, { manager: "nvm", versions: ["22.23.3"], active: "22.23.3" });
});

test("工具事实扩展：四键并入 manager、versions、active 三键，七键结构固定，active 恒等 version", () => {
  const tools = buildTools([{ name: "node", path: "/bin/node", version: "22.23.3", source: "path", available: true }]);
  const enriched = enrichTools(tools, { node: { manager: "nvm", versions: ["22.23.3", "18.0.0"], active: "18.0.0" } });
  assert.deepStrictEqual(Object.keys(enriched.node), ["path", "source", "version", "available", "manager", "versions", "active"]);
  assert.strictEqual(enriched.node.active, "22.23.3");
});

test("命令组装：无所需版本按环境形态拼合成可执行命令", () => {
  assert.strictEqual(buildCommand({ template: "{runner} -m pytest", language: "python" }, uvRecord()), "uv run python -m pytest");
});

test("命令组装：所需版本经切换形态得前缀后拼合，无占位符残留", () => {
  const command = buildCommand({ template: "{runner} -m pytest", language: "python", required: "3.11" }, uvRecord());
  assert.strictEqual(command, "uv run --python 3.11 -m pytest");
  assert.ok(!/\{[^}]*\}/.test(command));
});

test("命令组装：前置型管理器把版本前缀加到运行时命令前", () => {
  const record = {
    languages: { javascript: { runner: "node", available: true } },
    tools: { node: { path: "/bin/node", version: "22.23.3", available: true, manager: "nvm", versions: ["22.23.3", "18.0.0"], active: "22.23.3" } },
  };
  assert.strictEqual(buildCommand({ template: "{runner} --test", language: "javascript", required: "18.0.0" }, record), "nvm exec 18.0.0 -- node --test");
});

test("命令组装：激活版本与所需版本一致即直接执行，不加前缀", () => {
  const record = uvRecord();
  record.tools.python = { path: "/bin/python", version: "3.11.0", available: true, manager: "uv", versions: ["3.11.0", "3.10.0"], active: "3.11.0" };
  assert.strictEqual(buildCommand({ template: "{runner} -m pytest", language: "python", required: "3.11.0" }, record), "uv run python -m pytest");
});

test("命令组装：所需版本不在清单内即报缺口", () => {
  const record = uvRecord();
  record.tools.python = { path: "/bin/python", version: "3.11.0", available: true, manager: "uv", versions: ["3.11.0", "3.10.0"], active: "3.11.0" };
  assert.throws(() => buildCommand({ template: "{runner} -m pytest", language: "python", required: "3.9" }, record), /不在 .* 的版本清单内/);
});

test("命令组装：管理器不支持逐命令指定版本时报缺口", () => {
  const record = {
    languages: { python: { runner: "python3", available: true } },
    tools: { python3: { path: "/bin/python3", version: "3.12.0", available: true, manager: "mise", versions: [], active: "3.12.0" } },
  };
  assert.throws(() => buildCommand({ template: "{runner} -m pytest", language: "python", required: "3.9" }, record), /不支持逐命令指定版本/);
});

test("命令组装：语言无可用形态时报缺口", () => {
  const record = { languages: { go: { runner: null, available: false } }, tools: {} };
  assert.throws(() => buildCommand({ template: "{runner} test", language: "go" }, record), /无可用形态/);
});

test("命令组装：模板残留未解析占位符即报错，不返回半成品", () => {
  assert.throws(() => composeCommand("{runner} -m pytest --cov={target}", "uv run python"), /残留未解析占位符/);
});

// 夹具：按「可执行文件 + 参数」取列出命令输出的上下文，供运行时提供者用例区分 `uv python list` 与 `uv --version`
const providerCtx = (files, outputs = {}) => ({
  pathDirs: ["/bin"],
  exts: [""],
  isFile: (candidate) => files.includes(candidate),
  runManager: (file, args) => outputs[`${file} ${(args || []).join(" ")}`] || "",
});

// 夹具：本机形态的最小环境记录——python 不在 PATH，python 由 uv 提供，故只有 uv 一行与 uv 型语言形态
const uvOnlyRecord = (uvPath, uvListOutput) => {
  const tools = buildTools([{ name: "uv", path: uvPath, version: "0.13.7", source: "path", available: true }]);
  return {
    languages: { python: { runner: "uv run python", available: true } },
    tools: enrichTools(tools, collectManagers(tools, providerCtx([uvPath], { [`${uvPath} python list`]: uvListOutput }))),
  };
};

test("运行时提供者：versions 取所提供语言的清单，工具自身版本只留 version，两处分记", () => {
  const uvPath = path.join("/bin", "uv");
  const listed = "cpython-3.12.14-windows-x86_64-none  C:\\uv\\cpython-3.12-windows-x86_64-none\\python.exe\ncpython-3.10.21-windows-x86_64-none  <download available>\n";
  const tools = buildTools([{ name: "uv", path: uvPath, version: "0.13.7", source: "path", available: true }]);
  const facts = collectManagers(tools, providerCtx([uvPath], { [`${uvPath} python list`]: listed }));
  assert.deepStrictEqual(facts.uv, { manager: "", versions: ["3.12.14", "3.10.21"], active: null });
  const row = enrichTools(tools, facts).uv;
  assert.strictEqual(row.version, "0.13.7");
  assert.deepStrictEqual(row.versions, ["3.12.14", "3.10.21"]);
  assert.strictEqual(row.active, null);
});

test("运行时提供者：清单内所需版本经其所提供语言清单校验后拼合，清单外即报缺口", () => {
  const uvPath = path.join("/bin", "uv");
  const record = uvOnlyRecord(uvPath, "cpython-3.12.14-windows-x86_64-none  <download available>\ncpython-3.10.21-windows-x86_64-none  <download available>\n");
  assert.strictEqual(buildCommand({ template: "{runner} -m pytest", language: "python", required: "3.12.14" }, record), "uv run --python 3.12.14 -m pytest");
  assert.throws(() => buildCommand({ template: "{runner} -m pytest", language: "python", required: "9.9" }, record), /所需版本 9.9 不在 uv 的版本清单内/);
});

test("运行时提供者清单为空：降级为不校验，登记降级且不以自身版本顶替清单", () => {
  const uvPath = path.join("/bin", "uv");
  const record = uvOnlyRecord(uvPath, "");
  assert.deepStrictEqual(record.tools.uv.versions, []);
  assert.deepStrictEqual(versionCheckDowngrades(record), [{ tool: "uv", language: "python", reason: "所提供语言的版本清单不可得" }]);
  assert.strictEqual(buildCommand({ template: "{runner} -m pytest", language: "python", required: "9.9" }, record), "uv run --python 9.9 -m pytest");
});

test("降级登记：提供者清单可得即无降级，提供者不可用即不记降级", () => {
  const uvPath = path.join("/bin", "uv");
  const available = uvOnlyRecord(uvPath, "cpython-3.12.14-windows-x86_64-none  <download available>\n");
  assert.deepStrictEqual(versionCheckDowngrades(available), []);
  assert.deepStrictEqual(versionCheckDowngrades({ tools: { uv: { available: false, versions: [] } } }), []);
});

test("命令组装：nvm 的清单取自 nvm ls，所需版本不在其中即报缺口", () => {
  const record = {
    languages: { javascript: { runner: "node", available: true } },
    tools: { node: { path: "/bin/node", version: "22.23.3", available: true, manager: "nvm", versions: ["22.23.3", "18.20.8"], active: "22.23.3" } },
  };
  assert.strictEqual(buildCommand({ template: "{runner} --test", language: "javascript", required: "18.20.8" }, record), "nvm exec 18.20.8 -- node --test");
  assert.throws(() => buildCommand({ template: "{runner} --test", language: "javascript", required: "9.9" }, record), /所需版本 9.9 不在 nvm 的版本清单内/);
});

test("版本清单解析按行取首个版本：路径与注释里的版本片段不算独立条目", () => {
  const listed = "cpython-3.10.21-windows-x86_64-none   D:\\uv\\cpython-3.10-windows-x86_64-none\\python.exe\n  pypy-3.10.16-windows-x86_64-none  <download available>\n";
  assert.deepStrictEqual(parseVersionList(listed), ["3.10.21", "3.10.16"]);
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

// ── 候选集组装（设计册第十节其二、其三） ──

// 夹具：按 lang-javascript/commands.json 的候选次序，jest、vitest 各两态、mocha、bun:test、node:test
const jsCandidates = [
  { when: { framework: "jest", runner: "npx" }, template: "{runner} jest" },
  { when: { framework: "vitest", runner: "bun" }, template: "{runner} run test" },
  { when: { framework: "vitest", runner: "npx" }, template: "{runner} vitest run" },
  { when: { framework: "mocha", runner: "npx" }, template: "{runner} mocha" },
  { when: { framework: "bun:test", runner: "bun" }, template: "{runner} test" },
  { when: { framework: "node:test", runner: "node" }, template: "{runner} --test" },
];

// 夹具：可注入框架可用性的 node 环境 javascript 记录，工具行只置可用性（bun 环境另在用例内注入 bun 与 npx）
const jsRecord = (frameworks) => ({
  languages: { javascript: { runner: "node", available: true } },
  tools: { node: { available: true }, npx: { available: true } },
  frameworks,
});

// 夹具：bun 环境记录，供内建候选与 vitest 陷阱用例
const bunRecord = (frameworks) => ({
  languages: { javascript: { runner: "bun", available: true } },
  tools: { node: { available: true }, bun: { available: true }, npx: { available: true } },
  frameworks,
});

test("候选命中：bun 环境无外部框架时落内建 bun:test，拼出 bun test", () => {
  const record = bunRecord({ "bun:test": { available: true }, "node:test": { available: true } });
  assert.strictEqual(buildCommand({ candidates: jsCandidates, language: "javascript" }, record), "bun test");
});

test("候选优先级：node 环境按 jest、vitest、node:test 取首个命中者", () => {
  const both = jsRecord({ jest: { available: true }, vitest: { available: true }, "node:test": { available: true } });
  assert.strictEqual(buildCommand({ candidates: jsCandidates, language: "javascript" }, both), "npx jest");
  const noJest = jsRecord({ vitest: { available: true }, "node:test": { available: true } });
  assert.strictEqual(buildCommand({ candidates: jsCandidates, language: "javascript" }, noJest), "npx vitest run");
  const onlyNode = jsRecord({ "node:test": { available: true } });
  assert.strictEqual(buildCommand({ candidates: jsCandidates, language: "javascript" }, onlyNode), "node --test");
});

test("条件不成立：框架未安装即不命中该候选，落到次候选", () => {
  const record = jsRecord({ jest: { available: false }, vitest: { available: false }, mocha: { available: false }, "node:test": { available: true } });
  assert.strictEqual(buildCommand({ candidates: jsCandidates, language: "javascript" }, record), "node --test");
});

test("陷阱：bun 与 vitest 并存时取 bun run test，不取 bun test", () => {
  const record = bunRecord({ vitest: { available: true }, "bun:test": { available: true } });
  assert.strictEqual(buildCommand({ candidates: jsCandidates, language: "javascript" }, record), "bun run test");
});

test("python 候选：pytest 优先于 unittest，pytest 未安装时落 unittest", () => {
  const candidates = [
    { when: { framework: "pytest" }, template: "{runner} -m pytest" },
    { when: { framework: "unittest" }, template: "{runner} -m unittest discover" },
  ];
  const base = { languages: { python: { runner: "uv run python", available: true } }, tools: {} };
  const withPytest = { ...base, frameworks: { pytest: { available: true }, unittest: { available: true } } };
  assert.strictEqual(buildCommand({ candidates, language: "python" }, withPytest), "uv run python -m pytest");
  const noPytest = { ...base, frameworks: { pytest: { available: false }, unittest: { available: true } } };
  assert.strictEqual(buildCommand({ candidates, language: "python" }, noPytest), "uv run python -m unittest discover");
});

test("全部不成立报缺口：指明缺哪类框架，不回落写死的默认框架", () => {
  const candidates = [
    { when: { framework: "bats", runner: "bats" }, template: "{runner} tests/" },
    { when: { framework: "shunit2", runner: "bash" }, template: "{runner} test.sh" },
  ];
  const record = {
    languages: { shell: { runner: "bash", available: true } },
    tools: { bash: { available: true } },
    frameworks: { bats: { available: false }, shunit2: { available: false } },
  };
  assert.throws(() => buildCommand({ candidates, language: "shell" }, record), /缺少可用的测试框架.*缺 bats、shunit2/);
});

test("候选集组装：语言形态的运行器可作 when.runner，语言无可用形态即报缺口", () => {
  const record = { languages: { java: { runner: null, available: false } }, tools: {}, frameworks: {} };
  assert.throws(() => buildCommand({ candidates: [{ when: { runner: "mvn" }, template: "{runner} test" }], language: "java" }, record), /无可用形态/);
  const candidates = [{ when: { runner: "mvn" }, template: "{runner} verify" }, { when: { runner: "gradle" }, template: "{runner} build" }];
  const java = (runner) => ({ languages: { java: { runner, available: true } }, tools: {}, frameworks: {} });
  assert.strictEqual(buildCommand({ candidates, language: "java" }, java("mvn")), "mvn verify");
  assert.strictEqual(buildCommand({ candidates, language: "java" }, java("gradle")), "gradle build");
});
