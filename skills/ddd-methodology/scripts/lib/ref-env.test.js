/**
 * 目标：为环境记录来源级别判据（lib/ref-env.js 的 C34）补单元测试，覆盖无来源与非法来源两类缺口、无需来源的不可用工具与无记录三态，并验证顺序无关。
 * 范围：C34 契约的 run（入参为项目根，读 <根>/docs/.ddd-env.json 的 tools）；夹具为临时仓库，不读写本仓库的环境记录。
 * 运行：node --test skills/ddd-methodology/scripts/lib/ref-env.test.js。
 * 不包含：C26 至 C30 的判据（其证据由 ref-check 对本仓库的实跑承接）、命令模板组装与探测主链。
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { contracts } = require("./ref-env.js");

const runContract = (id, ctx) => contracts.find((contract) => contract.id === id).run(ctx);

// 夹具：临时仓库内按给定 tools 造一份四键环境记录，回传仓库根
function makeRepo(tools) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ref-env-"));
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  const record = { probedAt: "2026-01-01T00:00:00.000Z", tools, languages: {}, frameworks: {} };
  fs.writeFileSync(path.join(root, "docs", ".ddd-env.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
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
