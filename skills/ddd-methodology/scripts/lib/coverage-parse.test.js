/**
 * 目标：为覆盖率判定的无副作用核心补纯函数单元测试，覆盖达标、报告缺失、报告不可解析、未达阈四态，以及阈值覆盖与多包聚合两类路径。
 * 范围：coverage-parse.js 的 evaluateCoverage 与 parseCobertura 纯函数。
 * 运行：node --test skills/ddd-methodology/scripts/lib/coverage-parse.test.js。
 * 不包含：文件读取与命令行入口（见 ../coverage-check.js）。
 */

const test = require("node:test");
const assert = require("node:assert");
const { DEFAULT_THRESHOLD, parseCobertura, evaluateCoverage } = require("./coverage-parse.js");

// 夹具：单包 Cobertura 报告，逐行给 hits，covered 与 valid 由入参决定
const reportOf = (hits) => {
  const rows = hits.map((hit, index) => `<line number="${index + 1}" hits="${hit}"/>`).join("");
  return `<?xml version="1.0"?><coverage line-rate="0" lines-valid="${hits.length}" lines-covered="${hits.filter((h) => h > 0).length}"><packages><package name="p"><classes><class name="A"><lines>${rows}</lines></class></classes></package></packages></coverage>`;
};

test("达标：行覆盖率不低于默认阈值即判 ok", () => {
  const text = reportOf([1, 1, 1, 1, 0]); // 4/5 = 80%
  const result = evaluateCoverage({ exists: true, text });
  assert.strictEqual(result.state, "ok");
  assert.strictEqual(result.threshold, DEFAULT_THRESHOLD);
  assert.strictEqual(result.covered, 4);
  assert.strictEqual(result.valid, 5);
});

test("报告缺失：文件不存在即判 missing，不静默通过", () => {
  const result = evaluateCoverage({ exists: false, text: "" });
  assert.strictEqual(result.state, "missing");
  // 空内容与文件缺失并为一态
  assert.strictEqual(evaluateCoverage({ exists: true, text: "   \n" }).state, "missing");
});

test("报告不可解析：内容非 Cobertura 或无可判数据即判 unparsable，不静默通过", () => {
  assert.strictEqual(evaluateCoverage({ exists: true, text: "not xml at all" }).state, "unparsable");
  assert.strictEqual(evaluateCoverage({ exists: true, text: "<coverage line-rate=\"abc\">" }).state, "unparsable");
  assert.strictEqual(evaluateCoverage({ exists: true, text: "<coverage" }).state, "unparsable");
  assert.strictEqual(parseCobertura("<coverage></coverage>"), null);
});

test("未达阈：行覆盖率低于阈值即判 below，不静默通过", () => {
  const result = evaluateCoverage({ exists: true, text: reportOf([1, 1, 0, 0, 0]) }); // 2/5 = 40%
  assert.strictEqual(result.state, "below");
  assert.ok(result.rate < result.threshold);
});

test("阈值覆盖：同一报告随阈值入参改变结论", () => {
  const text = reportOf([1, 1, 1, 0, 0]); // 3/5 = 60%
  assert.strictEqual(evaluateCoverage({ exists: true, text, threshold: 50 }).state, "ok");
  assert.strictEqual(evaluateCoverage({ exists: true, text, threshold: 60 }).state, "ok");
  assert.strictEqual(evaluateCoverage({ exists: true, text, threshold: 61 }).state, "below");
});

test("多包聚合：逐包行元素跨包累加，达标边界按总账判定", () => {
  const text = `<?xml version="1.0"?><coverage line-rate="0"><packages>`
    + `<package name="a"><classes><class name="A"><lines><line number="1" hits="1"/><line number="2" hits="0"/><line number="3" hits="1"/></lines></class></classes></package>`
    + `<package name="b"><classes><class name="B"><lines><line number="1" hits="1"/><line number="2" hits="1"/></lines></class></classes></package>`
    + `</packages></coverage>`;
  const parsed = parseCobertura(text);
  assert.deepStrictEqual({ covered: parsed.covered, valid: parsed.valid }, { covered: 4, valid: 5 });
  assert.strictEqual(evaluateCoverage({ exists: true, text }).state, "ok"); // 4/5 = 80% 达阈
  assert.strictEqual(evaluateCoverage({ exists: true, text, threshold: 81 }).state, "below");
});

test("行元素缺席：退回根元素 lines-valid 与 lines-covered，再退回 line-rate", () => {
  assert.deepStrictEqual(parseCobertura('<coverage lines-valid="10" lines-covered="7"></coverage>'), { covered: 7, valid: 10, rate: 70 });
  assert.deepStrictEqual(parseCobertura('<coverage line-rate="0.9"></coverage>'), { covered: null, valid: null, rate: 90 });
});
