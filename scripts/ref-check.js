#!/usr/bin/env node
/**
 * 目标：把本仓库跨文档引用、常量、清单与冻结短语的一致性外化为可复现的机械证据，供文档同步链在提交前校验。
 * 范围：C1 至 C16 十六项校验；默认只读不落盘，仅 --fix 写盘，写盘范围限 workflow 的阶段注册表块。
 * 校验实现按域外置于 ./lib/：规范读取面见 spec-doc.js，引用形态见 ref-refs.js，常量集合见 ref-constants.js，
 *   阶段键见 ref-stages.js，冻结短语见 ref-phrases.js，登记簿字段集合见 ref-debt-fields.js，校验项映射见 ref-coverage.js，
 *   工作区行尾见 ref-line-endings.js；安装清单校验见顶层 ./install-manifest-check.js。本脚本只作装配与输出。
 * 清单类校验 C5 与 C11 由 ./roster-check.js 提供，本脚本只作调用。
 * 索引表校验 C12 由 ./spec-index-check.js 提供，本脚本只作调用并注入已枚举的规范文件清单与索引入口路径。
 * 用法：node ref-check.js <仓库根> [--fix]；--fix 从 spec 键清单生成 workflow 阶段注册表并输出改动清单。
 * 输出形态：文本正文；末行机读结论 `RESULT: pass`（无漂移）或 `RESULT: drift`（存在漂移）
 * 退出码：0 通过，1 存在漂移。门禁地位：本仓库文档同步链，不作被开发项目的门禁证据。
 * 输出上限：12000 字节，按 UTF-8 计量；超限截断明细，末行结论与明细计数行保留。
 * 扫描范围：活文档。排除 docs/ 与 CHANGELOG.md——前者是项目侧证据、审计归档与历史改造设计记录，
 *   后者的历史条目按当时版本的章节编号记述；两者的编号随版本成立，改写它们不产生一致性收益。
 *   目录排除由本脚本的专用排除集承担，只排除 docs、node_modules 与点开头目录，不排除 build、dist、coverage 等产物目录——以保持设计声称的对外行为；
 *   其中 C2 的扫描面另含 scripts/*.js 与 extensions/*.ts 的脚本文件，其余校验项仍为活文档。
 * 规范依据：规范「结构与注释的机械证据」节的脚本消费契约表，与「结构与契约的演进治理」节的机械约束条。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./lib/text.js");
const { createSpecReader, relPath: toRelPath, SPEC_INDEX_REL } = require("./lib/spec-doc.js");
const { createRefChecks } = require("./lib/ref-refs.js");
const { createConstantChecks } = require("./lib/ref-constants.js");
const { createStageChecks } = require("./lib/ref-stages.js");
const { createPhraseChecks } = require("./lib/ref-phrases.js");
const { createDebtFieldChecks } = require("./lib/ref-debt-fields.js");
const { createCoverageChecks } = require("./lib/ref-coverage.js");
const { createLineEndingChecks } = require("./lib/ref-line-endings.js");
const installManifestCheck = require("./install-manifest-check.js");
const decisionTables = require("./decision-tables.js");
const rosterCheck = require("./roster-check.js");
const specIndexCheck = require("./spec-index-check.js");

const argv = process.argv.slice(2);
const fixMode = argv.includes("--fix");
const root = path.resolve(argv.find((a) => !a.startsWith("--")) || process.cwd());
const REF_LIMIT_BYTES = 12000; // 与本脚本在脚本消费契约表中的输出上限一致
const SKIP_FILE_NAMES = new Set(["CHANGELOG.md"]);
// workflow 与守卫扩展的固定路径：C4 与 C9 的受控副本载体，只在装配处定义一次
const WORKFLOW_REL = ["workflows", "ddd-workflow.js"];
const GUARD_REL = ["extensions", "ddd-governance.ts"];
// 活文档遍历的专用排除集：共享 walk 会连 build、dist 等产物目录一并排除，使扫描面窄于设计声称的对外行为；此处只排除项目侧证据与依赖目录
const REF_EXCLUDE_DIRS = new Set(["node_modules", "docs"]);

// 路径归一绑定仓库根：供各校验项与 --fix 的改动清单统一输出
const relPath = (file) => toRelPath(root, file);

// 活文档遍历：深度优先，跳过点开头条目与专用排除集；不可读目录静默跳过
function walkRefDocs(dir, out = []) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!REF_EXCLUDE_DIRS.has(entry.name)) walkRefDocs(full, out); } else out.push(full);
  }
  return out;
}
// 活文档清单：专用遍历后只留扫描范围内的 md，版本记录由 SKIP_FILE_NAMES 排除
const liveDocPaths = walkRefDocs(root).filter((file) => file.endsWith(".md") && !SKIP_FILE_NAMES.has(path.basename(file)));

// 规范读取面：规范文件集合与节标题索引，一次性建立后供各校验项复用
const spec = createSpecReader(root);
const specDocs = spec.docs;
// 各域校验项的装配环境：仓库根、路径归一、活文档清单、规范读取器与两处固定路径
const env = { root, relPath, liveDocPaths, spec, workflowRel: WORKFLOW_REL, guardRel: GUARD_REL };
const refChecks = createRefChecks(env);
const constantChecks = createConstantChecks(env);
const stageChecks = createStageChecks(env);
const phraseChecks = createPhraseChecks(env);
const debtFieldChecks = createDebtFieldChecks(env);
const coverageChecks = createCoverageChecks(env);
const lineEndingChecks = createLineEndingChecks(env);

// --fix 唯一写盘点：只重写 workflow 的阶段注册表块，写盘前先比对，无差异不写盘；guard 只校验不写
function runFix(src) {
  if (!src.specKeys) return { error: "spec 状态文件节的键清单不可解析", changes: [] };
  if (!src.stageRegistryBlock) return { error: "workflow 的 stageRegistry 数组块不可解析", changes: [] };
  const expected = stageChecks.renderStageRegistry(src.specKeys);
  const changes = [];
  if (src.stageRegistryBlock[0] !== expected) {
    const next = src.workflowText.slice(0, src.stageRegistryBlock.index) + expected + src.workflowText.slice(src.stageRegistryBlock.index + src.stageRegistryBlock[0].length);
    fs.writeFileSync(src.workflowPath, next);
    changes.push(`${relPath(src.workflowPath)}：阶段注册表已按 spec 键清单重写（${src.specKeys.length} 项）`);
  }
  return { changes, guardOk: !!src.guardKey && src.specKeys.includes(src.guardKey), guardKey: src.guardKey };
}

const CHECKS = [
  ["C1", "语义化节引用有效", refChecks.checkSemanticRefs],
  ["C2", "裸章节号引用已清除", refChecks.checkBareSectionRefs],
  ["C3", "阈值一致性", constantChecks.checkThresholds],
  ["C4", "阶段键一致性", stageChecks.checkStageKeys],
  ["C5", "代理清单一致性", () => rosterCheck.checkAgentRoster(root)],
  ["C6", "门号一致性", constantChecks.checkGateIds],
  ["C7", "脚本名一致性", refChecks.checkScriptNames],
  ["C8", "冻结短语一致性", phraseChecks.checkFrozenPhrases],
  ["C9", "守卫编号一致性", constantChecks.checkGuardIds],
  ["C10", "判定表默认分支", () => decisionTables.checkJudgmentDefault(liveDocPaths.map(relPath), (rel) => readFileText(path.join(root, rel)))],
  ["C11", "skill 清单一致性", () => rosterCheck.checkSkillRoster(root)],
  ["C12", "规范索引表一致性", () => specIndexCheck.checkSpecIndex(root, specDocs.map((doc) => doc.rel), SPEC_INDEX_REL)],
  ["C13", "安装清单一致性", () => installManifestCheck.checkInstallManifest(root)],
  ["C14", "登记簿字段集合一致性", debtFieldChecks.checkDebtFieldSets],
  ["C15", "校验项映射一致性", coverageChecks.checkCheckCoverage],
  ["C16", "工作区行尾一致性", lineEndingChecks.checkLineEndings],
];

// --fix 先于校验写盘，使报告与末行结论反映修复后状态；默认模式不触盘
const fixResult = fixMode ? runFix(stageChecks.readStageKeySources()) : null;

// 每项独立执行：单项异常记入漂移清单后继续，不中断其余项
const checkResults = [];
for (const [id, title, run] of CHECKS) {
  try {
    checkResults.push({ id, title, drifts: run() });
  } catch (error) {
    checkResults.push({ id, title, drifts: [drift(id, "scripts/ref-check.js", 0, "单项校验异常须记入漂移清单并继续", "该单项正常完成", String((error && error.message) || error))] });
  }
}
const totalDrifts = checkResults.reduce((sum, result) => sum + result.drifts.length, 0) + (fixResult && fixResult.error ? 1 : 0);

// 输出按明细与固定行分离：超限时自尾部回撤明细，计数行、各项小结与末行结论保留
function capRefReport(entries) {
  const droppableIndex = entries.map((entry, index) => (entry.droppable ? index : -1)).filter((index) => index >= 0);
  const build = (keep) => {
    const dropped = new Set(droppableIndex.slice(keep));
    const lines = [];
    let notePlaced = false;
    entries.forEach((entry, index) => {
      if (!dropped.has(index)) {
        lines.push(entry.text);
        return;
      }
      if (!notePlaced) {
        lines.push(`明细已截断：共 ${droppableIndex.length} 项，已列 ${keep} 项`);
        notePlaced = true;
      }
    });
    return lines;
  };
  for (let keep = droppableIndex.length; keep >= 0; keep--) {
    const lines = build(keep);
    if (Buffer.byteLength(lines.join("\n"), "utf8") <= REF_LIMIT_BYTES) return lines;
  }
  return build(0);
}

const entries = [{ droppable: false, text: "=== 跨文档引用一致性校验 ===" }, { droppable: false, text: `仓库根：${root}` }, { droppable: false, text: `活文档：${liveDocPaths.length} 份；校验项：${CHECKS.length} 项` }];
// --fix 的改动清单入报告：列出写盘项，或声明无需改动；guard 单键只校验不写
if (fixResult) {
  entries.push({ droppable: false, text: "=== --fix 生成模式 ===" });
  if (fixResult.error) entries.push({ droppable: false, text: `  ✗ 中止：${fixResult.error}` });
  else {
    for (const line of fixResult.changes.length ? fixResult.changes : ["无需改动：受控副本已与 spec 键清单一致"]) entries.push({ droppable: false, text: `  · ${line}` });
    entries.push({ droppable: false, text: `  · guard 单键「${fixResult.guardKey}」${fixResult.guardOk ? "属于期望集合，未写该文件" : "不属于期望集合，须人工处理"}` });
  }
}
for (const result of checkResults) {
  const passed = !result.drifts.length;
  entries.push({ droppable: false, text: passed ? `[${result.id} ${result.title}] 通过` : `[${result.id} ${result.title}] 漂移 ${result.drifts.length} 项` });
  for (const d of result.drifts) {
    const where = d.line ? `${d.file}:${d.line}` : d.file;
    const actual = d.found ? `；实际 ${d.found}` : "";
    entries.push({ droppable: true, text: `  ✗ ${d.item} ${where} :: ${d.criterion}；期望 ${d.expect}${actual}` });
  }
}
entries.push({ droppable: false, text: "" }, { droppable: false, text: totalDrifts ? `结果：存在 ${totalDrifts} 项漂移` : `结果：通过，${CHECKS.length} 项校验无漂移` }, { droppable: false, text: totalDrifts ? "RESULT: drift" : "RESULT: pass" });

process.stdout.write(capRefReport(entries).join("\n") + "\n");
process.exit(totalDrifts ? 1 : 0);
