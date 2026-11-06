/**
 * 目标：为 C38 零引用值导出判据补单元测试，锁定「以实际导入面判消费」这一收紧后的口径，并锁住导出形态无法识别时的报缺口行为。
 * 范围：七态用例——真实导入即通过、仅文本同名而无导入即报、JS 形态未识别即报、注释先提及 module.exports 仍能正确定位、注册表动态装载的 contracts 豁免、TS 类型导出不入判据、TS 未支持形态即报。
 * 运行：node --test skills/ddd-methodology/scripts/lib/ref-exports.test.js。
 * 不包含：目录遍历实现与源码树排除集（见 walk.js）、注册表装载（见 ref-registry.js）。
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { contracts } = require("./ref-exports.js");

const C38 = contracts.find((entry) => entry.id === "C38");

// 夹具根：按给定相对路径与文本造一棵最小仓库，回传根绝对路径；判据只读两处共享层目录，其余文件仅作导入方参与检索
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ddd-c38-"));
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(root, ...rel.split("/"));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text, "utf8");
  }
  return root;
}

// 判据调用：注入仓库根与相对路径归一函数，与 ref-check 装配处同形
function runC38(root) {
  return C38.run({ root, relPath: (file) => path.relative(root, file).split(path.sep).join("/") });
}

const LIB = "skills/ddd-methodology/scripts/lib";
const EXT = "extensions/lib";

test("C38：导出被实际导入方按名引用即通过", () => {
  const root = fixture({
    [`${LIB}/a.js`]: "function foo() {}\nmodule.exports = { foo };\n",
    [`${LIB}/b.js`]: 'const { foo } = require("./a.js");\nfoo();\n',
  });
  assert.deepEqual(runC38(root), []);
});

test("C38：导出仅在他处出现同名文本而无导入关系即报，并指名符号", () => {
  const root = fixture({
    [`${LIB}/a.js`]: "function foo() {}\nmodule.exports = { foo };\n",
    [`${LIB}/b.js`]: "// foo 只在注释与字符串里出现\nconst s = 'foo';\n",
  });
  const found = runC38(root);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].item, "C38");
  assert.ok(found[0].file.endsWith(`${LIB}/a.js`), `实际 file 为 ${found[0].file}`);
  assert.strictEqual(found[0].found, "foo");
});

test("C38：JS 导出形态未识别时报缺口，不静默跳过", () => {
  const root = fixture({ [`${LIB}/a.js`]: "module.exports = makeThing();\n" });
  const found = runC38(root);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].found, "导出形态未识别");
});

test("C38：注释先提及 module.exports 时仍按最后一处赋值定位真实导出面", () => {
  const root = fixture({
    [`${LIB}/a.js`]: "// 本模块以 module.exports 导出，见下\nfunction alpha() {}\nmodule.exports = { alpha };\n",
  });
  const found = runC38(root);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].found, "alpha");
});

test("C38：注册表动态装载的 ref-*.js 其 contracts 豁免，其余符号仍受判", () => {
  const root = fixture({
    [`${LIB}/ref-demo.js`]: "function helper() {}\nmodule.exports = { contracts: [], helper };\n",
  });
  const found = runC38(root);
  assert.deepEqual(found.map((item) => item.found), ["helper"]);
});

test("C38：TS 类型导出不入判据，值导出仍按导入面判消费", () => {
  const root = fixture({
    [`${EXT}/t.ts`]: "export type X = number;\nexport interface Y { a: number }\nexport const z = 1;\n",
    [`${EXT}/u.ts`]: 'import { z } from "./t.ts";\nconsole.log(z);\n',
  });
  assert.deepEqual(runC38(root), []);
});

test("C38：TS 未支持导出形态即报缺口", () => {
  const root = fixture({ [`${EXT}/v.ts`]: "export class Z {}\n" });
  const found = runC38(root);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].found, "导出形态未识别");
});
