/**
 * 目标：为接口冻结锚点的读写、目录级「对外接口与约定」节的区间截取与范围限定 diff（lib/freeze.js）补纯函数与文件级单元测试，
 *   覆盖正常、边界与异常三路径，并以乱序调用验证判定与调用顺序无关。
 * 范围：节区间截取与规范化、清单读写与校验、接口节 diff（一致、变更、非 git、锚点不存在、无基线），以及变更类型声明不符的判定。
 * 运行：node --test skills/ddd-methodology/scripts/lib/freeze.test.js。
 * 不包含：命令行入口与输出装配（见 governance-check.js 与 trace-check.js）。
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const freeze = require("./freeze.js");

const DESIGN_V1 = [
  "# DESIGN：核心",
  "",
  "摘要：三行以内。",
  "",
  "## 对外接口与约定",
  "",
  "| 接口名 | 签名 | 参数 | 返回 | 错误语义 | 时序依赖与副作用 | 消费方模块 | 调用示例 |",
  "|---|---|---|---|---|---|---|---|",
  "| create | (x) => X | x | X | throws E | 无 | core/a.ts | create(1) |",
  "",
  "## 变更记录",
  "| 轮次 | 变更类型 | 冻结锚点 | 结构度量 | 依据 |",
  "|---|---|---|---|---|",
  "| 1 | 行为变更 | abc1234 | 不变 | 初版 |",
  "",
].join("\n");

const tmpRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "freeze-"));

function run(args) {
  return spawnSync("git", args, { encoding: "utf8" });
}

// 建带一次提交的 git 夹具：写 docs/design/DESIGN.md 后提交，回传根与首提交 sha
function makeGitRepo(designText) {
  const root = tmpRoot();
  const dir = path.join(root, "docs", "design");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "DESIGN.md"), designText);
  run(["-C", root, "init", "-q"]);
  run(["-C", root, "config", "user.email", "t@example.com"]);
  run(["-C", root, "config", "user.name", "t"]);
  run(["-C", root, "add", "-A"]);
  run(["-C", root, "commit", "-qm", "init"]);
  return { root, sha: freeze.headCommit(root) };
}

// ---- 节区间截取 ----

test("节区间截取：命中目录级「对外接口与约定」，不在文件级「对外接口清单」上误命中", () => {
  assert.ok(freeze.extractContractSection(DESIGN_V1));
  const fileLevel = "## 对外接口清单\n\n- create\n\n## 依赖接口清单\n";
  assert.equal(freeze.extractContractSection(fileLevel), null);
  assert.equal(freeze.normalizeSection(fileLevel), null);
});

test("范围限定：区间的下一同级标题之后与之前的内容都不进入比对", () => {
  const withTail = DESIGN_V1.replace("| 1 | 行为变更 | abc1234 | 不变 | 初版 |", "| 1 | 行为变更 | abc1234 | 变差 | 另起一段散文 |");
  assert.equal(freeze.normalizeSection(withTail), freeze.normalizeSection(DESIGN_V1));
});

test("规范化：行首尾空白与尾部空行不影响结果", () => {
  const padded = DESIGN_V1.replace("core/a.ts | create(1) |", "core/a.ts | create(1) |   ").replace("## 变更记录", "\n\n## 变更记录");
  assert.equal(freeze.normalizeSection(padded), freeze.normalizeSection(DESIGN_V1));
});

// ---- 清单读写与校验 ----

test("清单校验：合法记录通过，缺字段或不合法锚点回原因", () => {
  assert.equal(freeze.validateFreezeRecord({ anchor: "abc1234", at: "2026-01-01T00:00:00Z", scope: "docs/design" }), null);
  assert.match(freeze.validateFreezeRecord(null), /不是对象/);
  assert.match(freeze.validateFreezeRecord({ at: "x", scope: "y" }), /anchor/);
  assert.match(freeze.validateFreezeRecord({ anchor: "zzz", at: "x", scope: "y" }), /anchor/);
  assert.match(freeze.validateFreezeRecord({ anchor: "abc1234", scope: "y" }), /at/);
});

test("清单读写：写入后可读回，缺文件与损坏内容回 issue 而非抛错", () => {
  const root = tmpRoot();
  const rel = freeze.writeFreeze(root, "docs/design", { anchor: "abcdef1", at: "2026-01-01T00:00:00Z", scope: "docs/design" });
  assert.equal(rel, "docs/design/FREEZE.json");
  const read = freeze.readFreeze(root, "docs/design");
  assert.equal(read.issue, null);
  assert.equal(read.record.anchor, "abcdef1");

  const missing = freeze.readFreeze(tmpRoot(), "docs/design");
  assert.equal(missing.record, null);
  assert.match(missing.issue, /未找到/);

  const broken = tmpRoot();
  fs.mkdirSync(path.join(broken, "docs", "design"), { recursive: true });
  fs.writeFileSync(path.join(broken, "docs", "design", "FREEZE.json"), "{ not json");
  assert.match(freeze.readFreeze(broken, "docs/design").issue, /不可解析/);
});

// ---- 接口节 diff ----

test("接口节 diff：非 git 仓库、非法锚点、锚点下无文件三种异常分别报不同态", () => {
  const plain = tmpRoot();
  fs.mkdirSync(path.join(plain, "docs", "design"), { recursive: true });
  assert.equal(freeze.diffInterfaceSection(plain, "docs/design/DESIGN.md", DESIGN_V1, "abcdef1").status, "not-git");

  const { root } = makeGitRepo(DESIGN_V1);
  assert.equal(freeze.diffInterfaceSection(root, "docs/design/DESIGN.md", DESIGN_V1, "not-a-sha").status, "invalid-anchor");
  assert.equal(freeze.diffInterfaceSection(root, "docs/design/DESIGN.md", DESIGN_V1, "deadbee").status, "invalid-anchor");
  assert.equal(freeze.diffInterfaceSection(root, "docs/design/OTHER.md", DESIGN_V1, freeze.headCommit(root)).status, "no-baseline");
});

test("接口节 diff：接口表未动即一致，接口表有改即变更，非接口段落改动不算变更", () => {
  const { root, sha } = makeGitRepo(DESIGN_V1);
  // 只动变更记录（非接口段落）：应判一致
  const tailOnly = DESIGN_V1.replace("| 1 | 行为变更 | abc1234 | 不变 | 初版 |", "| 1 | 行为变更 | abc1234 | 不变 | 改了依据 |");
  assert.equal(freeze.diffInterfaceSection(root, "docs/design/DESIGN.md", tailOnly, sha).status, "unchanged");
  // 契约表加一行：应判变更
  const changed = DESIGN_V1.replace("| create | (x) => X | x | X | throws E | 无 | core/a.ts | create(1) |", "| create | (x) => X | x | X | throws E | 无 | core/a.ts | create(1) |\n| remove | (x) => void | x | void | throws E | 无 | core/a.ts | remove(1) |");
  assert.equal(freeze.diffInterfaceSection(root, "docs/design/DESIGN.md", changed, sha).status, "changed");
  assert.equal(freeze.isGitRepo(root), true);
});

// ---- 变更类型声明与 diff 的一致性判定 ----

test("判定：接口未改但声明行为变更 → 零 delta 缺口", () => {
  const { root, sha } = makeGitRepo(DESIGN_V1);
  const designFile = path.join(root, "docs", "design", "DESIGN.md");
  freeze.writeFreeze(root, "docs/design", { anchor: sha, at: "2026-01-01T00:00:00Z", scope: "docs/design" });
  const findings = freeze.interfaceFreezeFindings({ root, designRootRel: "docs/design", designFiles: [designFile], relPath: (f) => path.relative(root, f) });
  assert.equal(findings.checked.anchors, 1);
  assert.equal(findings.checked.unchanged, 1);
  assert.equal(findings.problems.length, 1);
  assert.match(findings.problems[0], /零 delta/);
});

test("判定：接口有改且声明行为变更 → 无缺口", () => {
  const { root, sha } = makeGitRepo(DESIGN_V1);
  const designFile = path.join(root, "docs", "design", "DESIGN.md");
  freeze.writeFreeze(root, "docs/design", { anchor: sha, at: "2026-01-01T00:00:00Z", scope: "docs/design" });
  const changed = DESIGN_V1.replace("| create |", "| create2 |"); // 行仍声明行为变更
  fs.writeFileSync(designFile, changed);
  const findings = freeze.interfaceFreezeFindings({ root, designRootRel: "docs/design", designFiles: [designFile], relPath: (f) => path.relative(root, f) });
  assert.equal(findings.checked.changed, 1);
  assert.deepEqual(findings.problems, []);
});

test("无法判定：非 git 仓库或锚点非法时报告警而非缺口", () => {
  const plain = tmpRoot();
  const dir = path.join(plain, "docs", "design");
  fs.mkdirSync(dir, { recursive: true });
  const designFile = path.join(dir, "DESIGN.md");
  fs.writeFileSync(designFile, DESIGN_V1);
  const findings = freeze.interfaceFreezeFindings({ root: plain, designRootRel: "docs/design", designFiles: [designFile], relPath: (f) => path.relative(plain, f) });
  assert.equal(findings.checked.undetermined, 1);
  assert.deepEqual(findings.problems, []);
  assert.match(findings.warnings.join("\n"), /无法判定接口节 diff/);
});

test("判定：声明重构却接口有改、接口有改却未声明，分别判缺口", () => {
  const { root, sha } = makeGitRepo(DESIGN_V1);
  const designFile = path.join(root, "docs", "design", "DESIGN.md");
  freeze.writeFreeze(root, "docs/design", { anchor: sha, at: "2026-01-01T00:00:00Z", scope: "docs/design" });

  // 接口有改 + 声明重构 → 缺口
  const refactorChanged = DESIGN_V1.replace("| create |", "| create2 |").replace("| 1 | 行为变更 |", "| 1 | 重构 |");
  fs.writeFileSync(designFile, refactorChanged);
  const f1 = freeze.interfaceFreezeFindings({ root, designRootRel: "docs/design", designFiles: [designFile], relPath: (f) => path.relative(root, f) });
  assert.equal(f1.checked.changed, 1);
  assert.match(f1.problems.join("\n"), /重构不应改变接口/);

  // 接口有改 + 未声明变更类型 → 缺口（AC 未同步）
  const undeclared = DESIGN_V1.replace("| create |", "| create2 |")
    .replace("| 轮次 | 变更类型 | 冻结锚点 | 结构度量 | 依据 |\n|---|---|---|---|---|\n| 1 | 行为变更 | abc1234 | 不变 | 初版 |", "");
  fs.writeFileSync(designFile, undeclared);
  const f2 = freeze.interfaceFreezeFindings({ root, designRootRel: "docs/design", designFiles: [designFile], relPath: (f) => path.relative(root, f) });
  assert.equal(f2.checked.changed, 1);
  assert.match(f2.problems.join("\n"), /同步受影响 AC/);
});

test("乱序调用：两次判定的结论与调用顺序无关", () => {
  const { root, sha } = makeGitRepo(DESIGN_V1);
  const designFile = path.join(root, "docs", "design", "DESIGN.md");
  freeze.writeFreeze(root, "docs/design", { anchor: sha, at: "2026-01-01T00:00:00Z", scope: "docs/design" });
  const args = { root, designRootRel: "docs/design", designFiles: [designFile], relPath: (f) => path.relative(root, f) };
  const first = JSON.stringify(freeze.interfaceFreezeFindings(args));
  const second = JSON.stringify(freeze.interfaceFreezeFindings(args));
  assert.equal(first, second);
});

// ---- 变更记录解析 ----

test("变更记录解析：取最新一轮的类型与锚点，空表与缺节分别回空与 null", () => {
  const rows = freeze.parseChangeRows(DESIGN_V1);
  assert.equal(rows.length, 1);
  assert.equal(freeze.classifyChangeType(rows[0].type), "behavior");
  assert.equal(freeze.classifyChangeType("重构"), "refactor");
  assert.equal(freeze.classifyChangeType("行为变更、重构"), null);
  assert.equal(freeze.parseChangeRows("# 无变更记录节"), null);
  assert.deepEqual(freeze.parseChangeRows("## 变更记录\n| 轮次 | 变更类型 | 冻结锚点 | 结构度量 | 依据 |\n|---|---|---|---|---|\n"), []);
});
