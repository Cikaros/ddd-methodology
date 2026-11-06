/**
 * 目标：为脚本共享层的版本标识工具（lib/version.js）补单元测试，覆盖补丁段推进与应清版本推导。
 * 范围：补丁推进（主次段不动、补丁段可跨任意值）与 deriveDue 五条路径——结果已晚于、等于、早于当前版本，当前版本不可解析，登记版本或补丁步数不可解析；
 *   以及 isOverdue 三态——两者均可解析且应清版本早于当前版本为真、不早于为假、任一不可解析为假。
 * 运行：node --test skills/ddd-methodology/scripts/lib/version.test.js。
 * 不包含：解析与比较的穷举用例（形如 v主.次[.补丁] 的形态已由本脚本链与扩展侧消费方承接）、登记簿字段语义与命令行入口。
 */

const test = require("node:test");
const assert = require("node:assert");
const { parseVersion, addSpan, deriveDue, formatVersion, isOverdue } = require("./version.js");

test("补丁推进：主段与次段不动，补丁段可跨任意值", () => {
  assert.deepEqual(addSpan(parseVersion("v1.2.9"), 3), { major: 1, minor: 2, patch: 12 });
  assert.equal(formatVersion(addSpan(parseVersion("v1.2.9"), 3)), "v1.2.12");
  assert.equal(formatVersion(addSpan(parseVersion("v0.8.9"), 2)), "v0.8.11");
  assert.equal(formatVersion(addSpan(parseVersion("v1.2"), 1)), "v1.2.1");
});

test("应清版本推导：初始推进结果已晚于当前版本即取该结果", () => {
  assert.equal(formatVersion(deriveDue(parseVersion("v1.2.0"), 1, parseVersion("v1.1.0"))), "v1.2.1");
});

test("应清版本推导：初始推进结果等于当前版本即直接取当前版本加一个补丁步", () => {
  assert.equal(formatVersion(deriveDue(parseVersion("v0.8.9"), 1, parseVersion("v0.8.10"))), "v0.8.11");
});

test("应清版本推导：初始推进结果早于当前版本即直接取当前版本加一个补丁步", () => {
  assert.equal(formatVersion(deriveDue(parseVersion("v1.2.0"), 1, parseVersion("v1.3.0"))), "v1.3.1");
});

test("应清版本推导：当前版本不可解析时只用初始推进", () => {
  assert.equal(formatVersion(deriveDue(parseVersion("v1.2.0"), 2, "abc")), "v1.2.2");
  assert.equal(formatVersion(deriveDue(parseVersion("v1.2.0"), 2, null)), "v1.2.2");
});

test("应清版本推导：登记版本或补丁步数不可解析时回 null", () => {
  assert.equal(deriveDue("abc", 1, parseVersion("v0.8.10")), null);
  assert.equal(deriveDue(null, 1, parseVersion("v0.8.10")), null);
  assert.equal(deriveDue(parseVersion("v1.2.0"), "一", parseVersion("v0.8.10")), null);
});

test("超期判定：两者均可解析且应清版本早于当前版本为真", () => {
  assert.equal(isOverdue("v0.8.9", "v0.8.10"), true);
});

test("超期判定：应清版本不早于当前版本为假，含相等与晚于两态", () => {
  assert.equal(isOverdue("v0.8.10", "v0.8.10"), false);
  assert.equal(isOverdue("v0.8.11", "v0.8.10"), false);
});

test("超期判定：任一不可解析即为假", () => {
  assert.equal(isOverdue("oops", "v0.8.10"), false);
  assert.equal(isOverdue("v0.8.9", "oops"), false);
  assert.equal(isOverdue(null, "v0.8.10"), false);
  assert.equal(isOverdue("v0.8.9", null), false);
});
