/**
 * 扩展侧入口与工具面的静态不变量回归
 *
 * 目标：以 node --test 锁定扩展侧四项修复的静态事实——全局规则的仲裁条不再外派已删代理、共享模块文件头的
 *   入口清单与实际四个扩展入口同集、工具面不再注册 slash 命令、交叉检查工具描述挂上统一调用时机说明、
 *   工具回看提示用经包根解析的绝对脚本路径。此类「无悬停引用」属声明面事实，以文本断言直接锁定。
 * 范围：只读扩展目录内的规则与源码文本，不启动宿主、不派发子代理、不导入含宿主依赖的扩展入口。
 * 运行：node --test extensions/lib/entry-consistency.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const GLOBAL_RULES = read("../rules/global-rules.md");
const SHARED = read("./shared.ts");
const TOOLS_SRC = read("../ddd-tools.ts");
// 已删代理名以拼接形式给出，使本测试自身不被全仓检索计作对该代理的现存引用
const REMOVED_ARBITER = ["ddd", "arbiter"].join("-");

test("全局规则：仲裁由根会话引条款裁决，不再出现已删代理", () => {
	assert.ok(!GLOBAL_RULES.includes(REMOVED_ARBITER), "全局规则不得再引用已删代理");
	assert.match(GLOBAL_RULES, /由根会话引具体规范条款与被批驳主张裁决/);
});

test("共享模块文件头：入口清单为实际四入口，无过时 ddd-models", () => {
	assert.ok(!SHARED.includes("ddd-models"), "文件头不得残留已删入口 ddd-models");
	for (const name of ["ddd-context", "ddd-governance", "ddd-tools", "ddd-resources"]) {
		assert.ok(SHARED.includes(name), `文件头须列出实际入口 ${name}`);
	}
});

test("工具面：不再注册 slash 命令，五个交叉检查工具齐备", () => {
	assert.ok(!TOOLS_SRC.includes("registerCommand"), "扩展侧不得再注册 slash 命令");
	for (const name of ["ddd_check_scope", "ddd_check_design", "ddd_check_file_design", "ddd_check_code", "ddd_check_consistency"]) {
		assert.ok(TOOLS_SRC.includes(name), `交叉检查工具须存在 ${name}`);
	}
});

test("交叉检查工具描述：以单一常量挂统一调用时机说明", () => {
	assert.match(
		TOOLS_SRC,
		/CROSS_CHECK_TOOLS\.map\(\(spec\) => \(\{ \.\.\.spec, description: `\$\{spec\.description\} \$\{CROSS_CHECK_USAGE\}` \}\)\)/,
		"交叉检查工具须经 CROSS_CHECK_USAGE 追加统一时机说明，不得各处另写一套",
	);
	assert.match(TOOLS_SRC, /const CROSS_CHECK_USAGE = /);
});

test("工具回看提示：用绝对脚本路径，不再拼相对路径", () => {
	assert.match(TOOLS_SRC, /完整输出请直接运行 \$\{scriptPath\}/, "回看提示须用经包根解析的绝对路径");
	assert.ok(!TOOLS_SRC.includes("scripts/${spec.script}.js"), "不得再拼未锚定包根的相对脚本路径");
});
