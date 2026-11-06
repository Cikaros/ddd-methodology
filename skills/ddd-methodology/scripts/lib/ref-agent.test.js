/**
 * 目标：为项目级代理不可迭代面一致性（lib/ref-agent.js 的 C35）补单元测试，覆盖一致、acceptanceRole 不符、
 *   报告章节缺项、章节数不符与实例缺失报不适用五类，并验证顺序无关与真实仓库整合。
 * 范围：C35 契约的 run（入参为仓库根，读 <根>/.pi/agents 与 <根>/skills/ddd-methodology/assets/agent-templates）；夹具为临时仓库。
 * 运行：node --test skills/ddd-methodology/scripts/lib/ref-agent.test.js。
 * 不包含：可迭代面（检查项清单等）的判定（本不纳入校验）、C5 代理名清单与 C24 基线键（各见对应模块）。
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { contracts } = require("./ref-agent.js");

const run = (ctx) => contracts[0].run(ctx);
// 上下文最小桩：判据只消费 root 与 relPath，与 ref-check 装配处注入的键同名
const ctxOf = (root) => ({ root, relPath: (file) => path.relative(root, file).split(path.sep).join("/") });

// 定义桩：最小夹具，只含三项不可迭代面所需的 frontmatter 与两节；可迭代面不写入，验证其不参与判据
const doc = ({ role = "read-only", sections = "甲、乙与丙", count = "三", stopCount = "三" } = {}) => [
  "---",
  "name: ddd-demo",
  `acceptanceRole: ${role}`,
  "---",
  "",
  "# 输出契约",
  "",
  `报告，${count}节：${sections}。`,
  "",
  "# 停止条件",
  "",
  `报告含${stopCount}节即停止。`,
  "",
].join("\n");

// 夹具：临时仓库内写模板与实例两份定义；withInstance/withTemplate 控制是否落盘，供不适用路径构造
function makeRepo({ template = doc(), instance = doc(), withInstance = true, withTemplate = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ref-agent-"));
  const tDir = path.join(root, "skills", "ddd-methodology", "assets", "agent-templates");
  const iDir = path.join(root, ".pi", "agents");
  fs.mkdirSync(tDir, { recursive: true });
  fs.mkdirSync(iDir, { recursive: true });
  if (withTemplate) fs.writeFileSync(path.join(tDir, "ddd-demo.md"), template);
  if (withInstance) fs.writeFileSync(path.join(iDir, "ddd-demo.md"), instance);
  return root;
}

test("一致：三项不可迭代面与模板相同则无漂移", () => {
  const root = makeRepo({ template: doc(), instance: doc() });
  assert.deepStrictEqual(run(ctxOf(root)), []);
});

test("acceptanceRole 不符：实例取 writer 即报漂移并指明字段位置", () => {
  const root = makeRepo({ instance: doc({ role: "writer" }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C35");
  assert.match(drifts[0].criterion, /acceptanceRole/);
  assert.match(drifts[0].found, /writer/);
  assert.match(drifts[0].expect, /read-only/);
  assert.match(drifts[0].file, /\.pi\/agents\/ddd-demo\.md/);
});

test("报告章节缺项：实例输出契约少一节即报漂移并指明首个差异位置", () => {
  const root = makeRepo({ instance: doc({ sections: "甲、丙" }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].criterion, /报告章节列表/);
  assert.match(drifts[0].found, /第 2 处起不符/);
  assert.match(drifts[0].found, /丙/);
});

test("章节数不符：输出契约声明的章节数与停止条件声明不一致即报漂移", () => {
  const root = makeRepo({ instance: doc({ count: "四" }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].criterion, /章节数/);
  assert.match(drifts[0].found, /四节/);
  assert.match(drifts[0].found, /三节/);
});

test("实例缺失：无项目级实例时报不适用，不产漂移且退出非错", () => {
  const root = makeRepo({ withInstance: false });
  const notes = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => { notes.push(String(chunk)); return true; };
  let drifts;
  try { drifts = run(ctxOf(root)); } finally { process.stdout.write = original; }
  assert.deepStrictEqual(drifts, []);
  assert.match(notes.join(""), /\[C35 不适用\]/);
});

test("边界：实例存在但无同名模板时同样报不适用，不产漂移", () => {
  const root = makeRepo({ withTemplate: false });
  const original = process.stdout.write;
  process.stdout.write = () => true;
  let drifts;
  try { drifts = run(ctxOf(root)); } finally { process.stdout.write = original; }
  assert.deepStrictEqual(drifts, []);
});

test("顺序无关：判据只读文件，重复调用结果逐字一致", () => {
  const root = makeRepo({ instance: doc({ role: "writer" }) });
  const forward = run(ctxOf(root));
  const reverse = run(ctxOf(root));
  assert.deepStrictEqual(reverse, forward);
});

test("整合：本仓库项目级实例与模板的三项不可迭代面一致", () => {
  const root = path.resolve(__dirname, "..", "..", "..", "..");
  assert.deepStrictEqual(run({ root, relPath: (file) => path.relative(root, file).split(path.sep).join("/") }), []);
});
