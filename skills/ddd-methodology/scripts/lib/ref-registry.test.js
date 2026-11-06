/**
 * 目标：为注册表模式（lib/ref-registry.js）补单元测试，覆盖装载、契约校验、id 排序、三项自校验与顺序无关性。
 * 范围：loadRegistry 的导出归一与缺陷捕获、C31 契约完整、C32 id 唯一与连续、C33 头部计数派生一致，
 *   以及三种构造情形（id 重复、id 断号、契约缺键）的检出证据；末附对真实仓库注册表的一次整合断言。
 * 运行：node --test skills/ddd-methodology/scripts/lib/ref-registry.test.js。
 * 不包含：各域校验项的判据（各见对应模块的测试）、命令行入口装配。
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadRegistry, contracts, RETIRED_IDS } = require("./ref-registry.js");

// 校验项替换：按 id 取注册表自校验契约，供构造注册表后逐项调用
const runContract = (id, ctx) => contracts.find((contract) => contract.id === id).run(ctx);

// 契约桩：只带三项自校验所需字段，run 不会被本测试触发
const contractStub = (id, domain = "test") => ({ id, name: `桩 ${id}`, domain, run: () => [] });

// 临时仓库夹具：按文件名到源码的映射写 lib 下模块，回传仓库根
function makeRepo(modules) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ref-registry-"));
  const lib = path.join(root, "skills", "ddd-methodology", "scripts", "lib");
  fs.mkdirSync(lib, { recursive: true });
  for (const [name, source] of Object.entries(modules)) fs.writeFileSync(path.join(lib, name), source);
  return root;
}

test("装载：单对象、数组与 contracts 键三种导出形态归一，契约按 id 数字序排列而非字典序", () => {
  const root = makeRepo({
    "ref-a.js": 'module.exports = { id: "C10", name: "十", domain: "a", run: () => [] };\n',
    "ref-b.js": 'module.exports = [{ id: "C2", name: "二", domain: "b", run: () => [] }];\n',
    "ref-c.js": 'module.exports = { contracts: [{ id: "C1", name: "一", domain: "c", run: () => [] }] };\n',
    "ref-d.test.js": 'module.exports = { id: "C99", name: "测试文件不得入册", domain: "x", run: () => [] };\n',
  });
  const registry = loadRegistry({ root });
  assert.deepStrictEqual(registry.contracts.map((c) => c.id), ["C1", "C2", "C10"], "id 须按数字序排列");
  assert.deepStrictEqual(registry.defects, [], "三种形态均须被归一为契约");
  assert.ok(!registry.moduleFiles.includes("ref-d.test.js"), "单元测试文件不得入册");
});

test("异常：缺键模块、加载失败模块与未导出契约模块均记入缺陷且不中断其余模块", () => {
  const root = makeRepo({
    "ref-good.js": 'module.exports = { id: "C1", name: "一", domain: "a", run: () => [] };\n',
    "ref-missing.js": 'module.exports = { id: "C40", name: "缺 run", domain: "a" };\n',
    "ref-throw.js": 'throw new Error("boom");\n',
    "ref-none.js": "module.exports = { helper: true };\n",
  });
  const registry = loadRegistry({ root });
  assert.deepStrictEqual(registry.contracts.map((c) => c.id), ["C1"], "仅完整契约入册");
  const reasons = registry.defects.map((defect) => `${defect.file}:${defect.reason}`).join("\n");
  assert.match(reasons, /ref-missing\.js:.*缺键：run/, "缺键须报具体缺键");
  assert.match(reasons, /ref-throw\.js:.*模块加载失败/, "加载失败须记缺陷");
  assert.match(reasons, /ref-none\.js:.*未导出契约/, "未导出契约须记缺陷");
});

test("构造情形一：契约缺键由 C31 检出", () => {
  const root = makeRepo({ "ref-missing.js": 'module.exports = { id: "C40", name: "缺 run", domain: "a" };\n' });
  const registry = loadRegistry({ root });
  const drifts = runContract("C31", { root, registry });
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C31");
  assert.match(drifts[0].found, /缺键：run/);
});

test("构造情形二：id 重复由 C32 检出", () => {
  const dup = ["C1", "C2", "C3", "C4", "C5", "C5"].map((id) => contractStub(id));
  const drifts = runContract("C32", { registry: { contracts: dup, defects: [] } });
  assert.strictEqual(drifts.length, 1, "唯一重复项仅报一次");
  assert.strictEqual(drifts[0].item, "C32");
  assert.match(drifts[0].criterion, /唯一/);
});

test("构造情形三：id 断号由 C32 检出，退休编号除外", () => {
  const gap = ["C1", "C2", "C3", "C5"].map((id) => contractStub(id));
  const drifts = runContract("C32", { registry: { contracts: gap, defects: [] } });
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C32");
  assert.match(drifts[0].found, /断号 C4/);

  // 边界：连续序列中扣除退休编号 C13 与 C18 后不得报断号
  const withRetired = [];
  for (let n = 1; n <= 33; n++) {
    const id = `C${n}`;
    if (!RETIRED_IDS.includes(id)) withRetired.push(contractStub(id));
  }
  assert.deepStrictEqual(runContract("C32", { registry: { contracts: withRetired, defects: [] } }), [], "退休编号须被扣除");
});

test("C33：头部声明计数与注册表长度不一致即报，派生表述与一致声明均通过", () => {
  const root = makeRepo({ "ref-a.js": 'module.exports = { id: "C1", name: "一", domain: "a", run: () => [] };\n' });
  const refCheckRel = ["skills", "ddd-methodology", "scripts", "ref-check.js"];
  const writeHeader = (body) => fs.writeFileSync(path.join(root, ...refCheckRel), body);
  fs.mkdirSync(path.join(root, "skills", "ddd-methodology", "scripts"), { recursive: true });
  const derived = 'const head = `活文档：${docs.length} 份；校验项：${registry.contracts.length} 项`;\n';
  const length = 1;

  writeHeader(`/** 范围：一项校验。 */\n${derived}`);
  assert.deepStrictEqual(runContract("C33", { root, registry: { contracts: [contractStub("C1")], defects: [] } }), [], "声明与长度一致须通过");

  writeHeader(`/** 范围：九项校验。 */\n${derived}`);
  const mismatched = runContract("C33", { root, registry: { contracts: [contractStub("C1")], defects: [] } });
  assert.strictEqual(mismatched.length, 1);
  assert.match(mismatched[0].found, /头部声明 9 项/, `本地长度应为 ${length}`);

  writeHeader(`/** 范围：由注册表长度派生。 */\nconst head = "校验项：28 项";\n`);
  const notDerived = runContract("C33", { root, registry: { contracts: [contractStub("C1")], defects: [] } });
  assert.ok(notDerived.some((d) => /未检出派生表达式/.test(d.found)), "字面量计数须报未派生");
});

test("顺序无关：三项自校验的 run 只读注册表，乱序调用结果一致", () => {
  const registry = loadRegistry({ root: makeRepo({ "ref-a.js": 'module.exports = [{ id: "C1", name: "一", domain: "a", run: () => [] }];\n' }) });
  const ctx = { root: path.resolve(__dirname, "..", "..", "..", ".."), registry };
  const forward = ["C31", "C32", "C33"].map((id) => runContract(id, ctx));
  const reverse = ["C33", "C32", "C31"].map((id) => runContract(id, ctx));
  assert.deepStrictEqual(reverse, forward.reverse(), "乱序调用结果须与顺序调用一致");
});

test("整合：真实仓库注册表含 C1 至 C30 既有编号、无缺陷且 id 严格升序", () => {
  const root = path.resolve(__dirname, "..", "..", "..", "..");
  const registry = loadRegistry({ root });
  assert.deepStrictEqual(registry.defects, [], "真实仓库不得有契约缺陷");
  const ids = registry.contracts.map((c) => c.id);
  const legacy = [];
  for (let n = 1; n <= 30; n++) if (n !== 13 && n !== 18) legacy.push(`C${n}`);
  for (const id of legacy) assert.ok(ids.includes(id), `既有校验项 ${id} 须仍在册`);
  const numbers = ids.map((id) => Number(id.slice(1)));
  for (let i = 1; i < numbers.length; i++) assert.ok(numbers[i] > numbers[i - 1], "id 须严格升序");
  assert.deepStrictEqual(runContract("C32", { registry }), [], "真实注册表须无 id 缺陷");
});
