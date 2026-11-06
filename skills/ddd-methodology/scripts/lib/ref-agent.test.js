/**
 * 目标：为项目级代理不可迭代面一致性（lib/ref-agent.js 的 C35）补单元测试，覆盖一致、只读权限主体与工具集不符、
 *   写权限检出、标记假声明、报告章节缺项与增项改序、标题总数不符、哨兵缺失、注释未闭合、单键缺失、任一侧缺标记、
 *   无同名模板与无对应实例的不适用备注十二类，并验证不解析散文、顺序无关与真实仓库整合。
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
const READ_TOOLS = "read, grep, find, ls, bash";

// 定义桩：最小夹具，含 frontmatter 的 acceptanceRole 与 tools、头部 C35 契约标记，另有两处一级标题（输出契约、停止条件）；
//   marker 为假时不落标记，sentinel 与 markerClose 供哨兵缺失、注释未闭合两条路径构造；
//   dropKey 供单键缺失路径构造；markerRole 与 fmRole、markerTools 与 fmTools 可分别设定，供标记假声明路径构造
const doc = ({ fmRole = "read-only", fmTools = READ_TOOLS, markerRole = "read-only", markerTools = READ_TOOLS, sections = "甲、乙、丙", headings = 2, marker = true, markerClose = true, dropKey, sentinel = "C35-CONTRACT", reportSentence } = {}) => {
  const lines = ["---", "name: ddd-demo", `acceptanceRole: ${fmRole}`, `tools: ${fmTools}`, "---", ""];
  if (marker) {
    lines.push(`<!-- ${sentinel}`);
    if (dropKey !== "role") lines.push(`role: ${markerRole}`);
    if (dropKey !== "tools") lines.push(`tools: ${markerTools}`);
    if (dropKey !== "sections") lines.push(`sections: ${sections}`);
    if (dropKey !== "headings") lines.push(`headings: ${headings}`);
    if (markerClose) lines.push("-->");
    lines.push("");
  }
  lines.push("# 输出契约", "", reportSentence || `报告，三节：${sections}。`, "# 停止条件", "", "报告含三节即停止。", "");
  return lines.join("\n");
};

// 夹具：临时仓库内写模板与实例两份定义；withInstance/withTemplate 控制是否落盘，供不适用路径构造
function makeRepo({ template = doc(), instance = doc(), withInstance = true, withTemplate = true } = {}) {
  return makeRepoPairs([["ddd-demo.md", withTemplate ? template : null, withInstance ? instance : null]]);
}

// 多代理夹具：按给定顺序落盘若干同名对，instance 为 null 时只落模板，供「模板无对应实例」路径构造
function makeRepoPairs(pairs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ref-agent-"));
  const tDir = path.join(root, "skills", "ddd-methodology", "assets", "agent-templates");
  const iDir = path.join(root, ".pi", "agents");
  fs.mkdirSync(tDir, { recursive: true });
  fs.mkdirSync(iDir, { recursive: true });
  for (const [name, template, instance] of pairs) {
    if (template != null) fs.writeFileSync(path.join(tDir, name), template);
    if (instance != null) fs.writeFileSync(path.join(iDir, name), instance);
  }
  return root;
}

// 捕获 run 期间的标准输出，供不适用备注的断言使用
function capture(fn) {
  const notes = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => { notes.push(String(chunk)); return true; };
  try { return { result: fn(), notes: notes.join("") }; } finally { process.stdout.write = original; }
}

test("一致：标记四项与模板相同则无漂移", () => {
  const root = makeRepo({ template: doc(), instance: doc() });
  assert.deepStrictEqual(run(ctxOf(root)), []);
});

test("只读权限不符：实例标记取 writer 即报漂移并指明标记位置", () => {
  const root = makeRepo({ instance: doc({ fmRole: "writer", markerRole: "writer" }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.strictEqual(drifts[0].item, "C35");
  assert.match(drifts[0].criterion, /只读权限须与模板一致/);
  assert.match(drifts[0].found, /writer/);
  assert.match(drifts[0].expect, /read-only/);
  assert.match(drifts[0].file, /\.pi\/agents\/ddd-demo\.md/);
});

test("工具集不符：实例标记工具集与模板不一致即报漂移", () => {
  const root = makeRepo({ instance: doc({ fmTools: "read, grep", markerTools: "read, grep" }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].criterion, /工具集须与模板一致/);
  assert.match(drifts[0].found, /实例标记 tools: read, grep/);
});

test("写权限检出：工具集含 write 或 edit 即报缺陷，模板与实例两侧各报一处", () => {
  const withWrite = { fmTools: "read, grep, write", markerTools: "read, grep, write" };
  const write = run(ctxOf(makeRepo({ template: doc(withWrite), instance: doc(withWrite) })));
  assert.strictEqual(write.length, 2);
  for (const d of write) assert.match(d.criterion, /含 write 或 edit 即报缺陷/);
  const withEdit = { fmTools: "read, edit", markerTools: "read, edit" };
  const edit = run(ctxOf(makeRepo({ template: doc(withEdit), instance: doc(withEdit) })));
  assert.ok(edit.some((d) => /含 write 或 edit 即报缺陷/.test(d.criterion)));
});

test("标记假声明：标记 role 与 frontmatter 的 acceptanceRole 不符即报漂移", () => {
  const root = makeRepo({ instance: doc({ fmRole: "writer", markerRole: "read-only" }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].criterion, /acceptanceRole 一致/);
  assert.match(drifts[0].found, /frontmatter acceptanceRole: writer/);
});

test("标记假声明：frontmatter 暗加写权限而标记未同步即报漂移", () => {
  const root = makeRepo({ instance: doc({ fmTools: "read, grep, find, ls, bash, write" }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].criterion, /tools 一致/);
  assert.match(drifts[0].found, /frontmatter tools: read, grep, find, ls, bash, write/);
});

test("报告章节缺项：实例标记少一节即报漂移并指明首个差异位置", () => {
  const root = makeRepo({ instance: doc({ sections: "甲、丙" }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].criterion, /报告必备章节/);
  assert.match(drifts[0].found, /第 2 处起不符/);
  assert.match(drifts[0].found, /丙/);
});

test("报告章节增项与改序：增项与改序各报一处漂移", () => {
  const extra = run(ctxOf(makeRepo({ instance: doc({ sections: "甲、乙、丙、丁" }) })));
  assert.strictEqual(extra.length, 1);
  assert.match(extra[0].found, /实例 4 项/);
  assert.match(extra[0].found, /丁/);
  const reordered = run(ctxOf(makeRepo({ instance: doc({ sections: "乙、甲、丙" }) })));
  assert.strictEqual(reordered.length, 1);
  assert.match(reordered[0].found, /第 1 处起不符/);
  assert.match(reordered[0].found, /乙、甲、丙/);
});

test("标题总数不符：标记声明与实际一级标题数不符即报漂移", () => {
  const root = makeRepo({ instance: doc({ headings: 3 }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].criterion, /一级标题总数/);
  assert.match(drifts[0].found, /headings: 3/);
  assert.match(drifts[0].expect, /实际一级标题 2 个/);
});

test("哨兵缺失：注释非 C35 哨兵即报缺标记，不产多余缺口", () => {
  const root = makeRepo({ instance: doc({ sentinel: "C36-CONTRACT" }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].found, /实例侧缺标记/);
  assert.match(drifts[0].found, /role、tools、sections、headings/);
});

test("注释未闭合：哨兵后无 --> 即报缺标记", () => {
  const root = makeRepo({ instance: doc({ markerClose: false }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].found, /实例侧缺标记/);
});

test("单键缺失：标记缺 headings 一键即报并指明缺项", () => {
  const root = makeRepo({ instance: doc({ dropKey: "headings" }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].found, /缺：headings/);
});

test("实例缺标记：只报实例侧缺标记一处，不产多余缺口", () => {
  const root = makeRepo({ instance: doc({ marker: false }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].found, /实例侧缺标记/);
  assert.match(drifts[0].file, /\.pi\/agents\/ddd-demo\.md/);
});

test("模板缺标记：只报模板侧缺标记一处并指明模板侧", () => {
  const root = makeRepo({ template: doc({ marker: false }) });
  const drifts = run(ctxOf(root));
  assert.strictEqual(drifts.length, 1);
  assert.match(drifts[0].found, /模板侧缺标记/);
  assert.match(drifts[0].file, /agent-templates\/ddd-demo\.md/);
});

test("不解析散文：实例正文列举与标记不符时零漂移", () => {
  const root = makeRepo({ template: doc(), instance: doc({ reportSentence: "报告，三节：戊、己、庚。" }) });
  assert.deepStrictEqual(run(ctxOf(root)), []);
});

test("实例缺失：无项目级实例时报不适用备注，不产漂移且退出非错", () => {
  const { result, notes } = capture(() => run(ctxOf(makeRepo({ withInstance: false }))));
  assert.deepStrictEqual(result, []);
  assert.match(notes, /\[C35 不适用\]/);
});

test("边界：实例存在但无同名模板时输出不适用备注，不产漂移", () => {
  const { result, notes } = capture(() => run(ctxOf(makeRepo({ withTemplate: false }))));
  assert.deepStrictEqual(result, []);
  assert.match(notes, /实例 .*ddd-demo\.md 无同名模板/);
});

test("模板无对应实例：逐项输出不适用备注，不产漂移", () => {
  const root = makeRepoPairs([["ddd-x.md", doc(), doc()], ["ddd-y.md", doc(), null]]);
  const { result, notes } = capture(() => run(ctxOf(root)));
  assert.deepStrictEqual(result, []);
  assert.match(notes, /模板 .*ddd-y\.md 无对应实例/);
});

test("幂等：同一入参连续两次调用结果逐字一致", () => {
  const root = makeRepo({ instance: doc({ fmRole: "writer", markerRole: "writer" }) });
  assert.deepStrictEqual(run(ctxOf(root)), run(ctxOf(root)));
});

test("顺序无关：实例落盘先后不同而判定结果一致", () => {
  const clean = ["ddd-a.md", doc(), doc()];
  const drifted = ["ddd-b.md", doc(), doc({ fmRole: "writer", markerRole: "writer" })];
  const normalize = (drifts) => drifts.map((d) => ({ ...d, file: path.basename(d.file) }));
  const forward = normalize(run(ctxOf(makeRepoPairs([clean, drifted]))));
  const reverse = normalize(run(ctxOf(makeRepoPairs([drifted, clean]))));
  assert.deepStrictEqual(reverse, forward);
  assert.strictEqual(forward.length, 1);
  assert.match(forward[0].file, /ddd-b\.md/);
});

test("整合：本仓库项目级实例与模板的四项不可迭代面一致", () => {
  const root = path.resolve(__dirname, "..", "..", "..", "..");
  assert.deepStrictEqual(run({ root, relPath: (file) => path.relative(root, file).split(path.sep).join("/") }), []);
});
