/**
 * pi 版本范围比对的单元测试
 *
 * 目标：以 node --test 独立验证 extensions/lib/version-range.ts 的判定，覆盖范围内、低于下界、高于上界、版本解析失败、范围非法五种情形。
 * 范围：只测纯函数的判定，不触文件系统与宿主；本文件位于 extensions/lib/，该目录无 index 入口，不会被宿主当作扩展加载。
 * 运行：node --test extensions/lib/version-range.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkVersionInRange, compareVersions, parseVersion } from "./version-range.ts";

const RANGE = ">=1.4.0 <1.6.0";

test("版本在范围内为 in-range", () => {
	assert.equal(checkVersionInRange("1.5.0", RANGE), "in-range");
	assert.equal(checkVersionInRange("1.4.0", RANGE), "in-range");
	assert.equal(checkVersionInRange("1.5.9", RANGE), "in-range");
});

test("低于下界为 out-of-range", () => {
	assert.equal(checkVersionInRange("1.3.9", RANGE), "out-of-range");
	assert.equal(checkVersionInRange("0.9.0", RANGE), "out-of-range");
});

test("高于上界为 out-of-range", () => {
	assert.equal(checkVersionInRange("1.6.0", RANGE), "out-of-range");
	assert.equal(checkVersionInRange("2.0.0", RANGE), "out-of-range");
});

test("版本号解析失败为 invalid", () => {
	assert.equal(checkVersionInRange("1.5", RANGE), "invalid");
	assert.equal(checkVersionInRange("1.5.0.1", RANGE), "invalid");
	assert.equal(checkVersionInRange("abc", RANGE), "invalid");
	assert.equal(checkVersionInRange("", RANGE), "invalid");
});

test("范围字符串非法为 invalid", () => {
	assert.equal(checkVersionInRange("1.5.0", ">=1.4.x"), "invalid");
	assert.equal(checkVersionInRange("1.5.0", "not-a-range"), "invalid");
	assert.equal(checkVersionInRange("1.5.0", ""), "invalid");
	assert.equal(checkVersionInRange("1.5.0", ">=<1.5.0"), "invalid");
});

test("并集与向上兼容记号的判定", () => {
	assert.equal(checkVersionInRange("1.3.0", ">=1.4.0 || =1.3.0"), "in-range");
	assert.equal(checkVersionInRange("1.9.0", "^1.5.0"), "in-range");
	assert.equal(checkVersionInRange("2.0.0", "^1.5.0"), "out-of-range");
	assert.equal(checkVersionInRange("1.5.9", "~1.5.0"), "in-range");
	assert.equal(checkVersionInRange("1.6.0", "~1.5.0"), "out-of-range");
});

test("版本解析与比较的边界", () => {
	assert.deepEqual(parseVersion(" 1.2.3 "), [1, 2, 3]);
	assert.equal(parseVersion("1.2"), null);
	assert.equal(compareVersions("1.4.0", "1.5.0"), -1);
	assert.equal(compareVersions("1.5.0", "1.5.0"), 0);
	assert.equal(compareVersions("1.5.0", "1.4.9"), 1);
	assert.equal(compareVersions("1.5", "1.4.0"), null);
});
