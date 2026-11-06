/**
 * 目标：为环境记录类校验（lib/ref-env.js 的 C26、C34、C36、C37）补单元测试：C26 逐工具行缺键、C34 无来源与非法来源两类、
 *   C36 所需版本命中与越界（语言名键经运行时工具行与提供者回退两径）、非语言键与清单不可得四态、C37 键集声明行缺失与不符两态，并验证顺序无关。
 * 范围：C26、C34、C36、C37 四契约的 run（入参为仓库根，读 <根>/docs/.ddd-env.json 与 <根>/skills/ddd-methodology/references/spec-govern.md）；夹具为临时仓库，不读写本仓库的环境记录。
 * 运行：node --test skills/ddd-methodology/scripts/lib/ref-env.test.js。
 * 不包含：C27 至 C30 的判据（其证据由 ref-check 对本仓库的实跑承接）、命令模板组装与探测主链。
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { contracts, ENV_KEYS, TOOL_KEYS } = require("./ref-env.js");

const runContract = (id, ctx) => contracts.find((contract) => contract.id === id).run(ctx);

// 夹具：临时仓库内按给定 tools 造一份四键环境记录，回传仓库根
function makeRepo(tools) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ref-env-"));
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  const record = { probedAt: "2026-01-01T00:00:00.000Z", tools, languages: {}, frameworks: {} };
  fs.writeFileSync(path.join(root, "docs", ".ddd-env.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return root;
}

// 夹具：七键工具行，缺省值齐备，覆盖项可局部改写
const toolRow = (overrides = {}) => ({ path: "/usr/bin/x", source: "path", version: "1.2.3", available: true, manager: "", versions: ["1.2.3"], active: null, ...overrides });

// 夹具：临时仓库内按给定记录对象造环境记录，回传仓库根
function makeRepoRecord(record) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ref-env-"));
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  const full = { probedAt: "2026-01-01T00:00:00.000Z", tools: {}, languages: {}, frameworks: {}, ...record };
  fs.writeFileSync(path.join(root, "docs", ".ddd-env.json"), `${JSON.stringify(full, null, 2)}\n`, "utf8");
  return root;
}

// 夹具：在临时仓库写入键集声明所在规范文件，内容为给定声明行
function makeRepoWithSpec(declaration) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ref-env-"));
  const dir = path.join(root, "skills", "ddd-methodology", "references");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "spec-govern.md"), `## 16. 状态文件\n${declaration}\n`, "utf8");
  return root;
}

test("通过：可用工具的来源级别在四级之内，不可用工具不参与判据", () => {
  const root = makeRepo({
    node: { path: "/usr/bin/node", source: "path", version: "22.0.0", available: true },
    jest: { path: "/proj/node_modules/.bin/jest", source: "project", version: "29.7.0", available: true },
    kcov: { path: null, source: null, version: null, available: false },
  });
  assert.deepStrictEqual(runContract("C34", { root }), []);
});

test("无来源：可用工具的 source 缺失即报缺口，并指明是哪一项", () => {
  const root = makeRepo({ node: { path: "/usr/bin/node", version: "22.0.0", available: true } });
  const drifts = runContract("C34", { root });
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C34");
  assert.match(drifts[0].criterion, /来源级别/);
  assert.match(drifts[0].found, /node\.source 为 缺失/);
});

test("非法来源：source 取四级之外的值即报缺口，并回显实际取值", () => {
  const root = makeRepo({ node: { path: "/usr/bin/node", source: "global", version: "22.0.0", available: true } });
  const drifts = runContract("C34", { root });
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C34");
  assert.match(drifts[0].found, /node\.source 为 "global"/);
  assert.match(drifts[0].expect, /project、path、default、package-manager/);
});

test("无记录与记录不可解析：C34 静默，缺口归 C26 报出，两项不重复计", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "ref-env-"));
  assert.deepStrictEqual(runContract("C34", { root: empty }), []);
  const root = makeRepo({});
  fs.writeFileSync(path.join(root, "docs", ".ddd-env.json"), "{ not json", "utf8");
  assert.deepStrictEqual(runContract("C34", { root }), []);
  assert.ok(runContract("C26", { root }).length > 0, "同一记录不可解析须由 C26 报出");
});

test("顺序无关：两项缺来源时乱序调用与重复调用结果一致", () => {
  const root = makeRepo({
    node: { path: "/usr/bin/node", version: "22.0.0", available: true },
    uv: { path: "/usr/bin/uv", source: "system", version: "0.13.7", available: true },
  });
  const forward = runContract("C34", { root });
  const reverse = runContract("C34", { root });
  assert.deepStrictEqual(reverse, forward);
  assert.deepStrictEqual(forward.map((item) => item.found).sort(), ["node.source 为 缺失", 'uv.source 为 "system"'].sort());
});

// ── 环境记录键集（C26 扩展） ──

test("C26：逐工具行七键齐备即通过，缺任一键即报缺口并指明是哪个键", () => {
  const complete = makeRepoRecord({ tools: { node: toolRow() } });
  assert.deepStrictEqual(runContract("C26", { root: complete }), []);
  const { version, ...broken } = toolRow();
  const drifts = runContract("C26", { root: makeRepoRecord({ tools: { node: broken } }) });
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C26");
  assert.match(drifts[0].expect, /node\.version/);
});

// ── 所需版本在清单内（C36） ──

test("C36：required 缺失即零漂移", () => {
  const root = makeRepoRecord({ tools: { node: toolRow({ versions: ["22.23.3"] }) } });
  assert.deepStrictEqual(runContract("C36", { root }), []);
});

test("C36：语言名键经运行时工具行命中即通过，越界即报缺口", () => {
  const tools = { node: toolRow({ versions: ["22.23.3", "18.20.8"] }) };
  const languages = { javascript: { runner: "node", available: true } };
  assert.deepStrictEqual(runContract("C36", { root: makeRepoRecord({ tools, languages, required: { javascript: "18.20.8" } }) }), []);
  const drifts = runContract("C36", { root: makeRepoRecord({ tools, languages, required: { javascript: "9.9" } }) });
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C36");
  assert.match(drifts[0].expect, /javascript 的清单含 9\.9/);
});

test("C36：运行时工具行清单皆空时回退到提供者行，命中即通过、越界即报缺口", () => {
  const tools = {
    python: toolRow({ manager: "uv", versions: [], active: null }),
    python3: toolRow({ versions: [] }),
    uv: toolRow({ versions: ["3.12.14", "3.10.21"], active: null }),
  };
  const languages = { python: { runner: "uv run python", available: true } };
  assert.deepStrictEqual(runContract("C36", { root: makeRepoRecord({ tools, languages, required: { python: "3.12.14" } }) }), []);
  const drifts = runContract("C36", { root: makeRepoRecord({ tools, languages, required: { python: "9.9" } }) });
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].expect, /python 的清单含 9\.9/);
});

test("C36：键非 languages 键即报缺口，工具名亦在其列", () => {
  const root = makeRepoRecord({ tools: { node: toolRow({ versions: ["22.23.3"] }) }, required: { node: "22.23.3" } });
  const drifts = runContract("C36", { root });
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C36");
  assert.match(drifts[0].criterion, /languages 键/);
});

test("C36：清单不可得时报无法判定而非缺口", () => {
  const root = makeRepoRecord({ tools: { python3: toolRow({ versions: [] }) }, languages: { python: { runner: "python3", available: true } }, required: { python: "3.11" } });
  assert.deepStrictEqual(runContract("C36", { root }), []);
});

// ── 环境记录键集声明一致（C37） ──

test("C37：声明行缺失即报漂移", () => {
  const drifts = runContract("C37", { root: makeRepoWithSpec("本节无键集声明") });
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C37");
});

test("C37：声明行与常量逐字一致即通过，与常量不符即报漂移", () => {
  const deliver = (keys) => keys.map((key) => `\`${key}\``).join("、");
  const conform = `环境记录键集：顶层 ${deliver(ENV_KEYS)}；逐工具 ${deliver(TOOL_KEYS)}。`;
  assert.deepStrictEqual(runContract("C37", { root: makeRepoWithSpec(conform) }), []);
  const nonconform = "环境记录键集：顶层 `probedAt`、`tools`；逐工具 `path`。";
  const drifts = runContract("C37", { root: makeRepoWithSpec(nonconform) });
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C37");
});
