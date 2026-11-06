#!/usr/bin/env node
/**
 * 目标：把本仓库跨文档引用、常量、清单与冻结短语的一致性外化为可复现的机械证据，供文档同步链在提交前校验。
 * 范围：校验项按注册表模式装配——扫描 lib 下 ref-*.js 校验模块，收集其导出的契约对象，校验契约完整性、按 id 数字序排序、逐个执行并汇总；
 *   校验项数由注册表长度派生，本注释与运行时头部均不写死计数，退休编号不复用以免既有引用与教训回写映射漂移；
 *   默认只读不落盘；C19 的收敛度基线在缺失时首次生成。
 * 装配四步：装载注册表（见 lib/ref-registry.js 的 loadRegistry）、校验契约完整性（由 C31 承接）、按 id 数字序排序、逐个执行并汇总；
 *   本脚本只做这四步与输出，不掌握任何校验项的判据内容。
 * 校验实现按域外置于 ./lib/：规范读取面见 spec-doc.js，引用形态见 ref-refs.js，常量集合见 ref-constants.js，
 *   阶段键见 ref-stages.js，冻结短语见 ref-phrases.js，登记簿字段集合见 ref-debt-fields.js，校验项映射见 ref-coverage.js，
 *   工作区行尾见 ref-line-endings.js，结构树与安装内容明细、命令入口清单与模板章节引用见 ref-structure.js，
 *   提示模板集与基线键见 ref-inventory.js，矩阵与技能清单一致性见 matrix.js（经 ref-external.js 包装），环境记录与命令模板见 ref-env.js，
 *   判据由顶层脚本提供的五项见 ref-external.js，注册表装载与三项自校验见 ref-registry.js；随装脚本枚举见顶层 ./install-manifest-check.js。
 * 清单类校验 C5 与 C11 由 ./roster-check.js 提供，索引表校验 C12 由 ./spec-index-check.js 提供，判定表校验 C10 由 ./decision-tables.js 提供，
 *   三者经 lib/ref-external.js 包装为契约，本脚本不再逐项调用。
 * 用法：node ref-check.js <仓库根>；只读不落盘。
 * 输出形态：文本正文；末行机读结论 `RESULT: pass`（无漂移）或 `RESULT: drift`（存在漂移）
 * 退出码：0 通过，1 存在漂移。门禁地位：本仓库文档同步链，不作被开发项目的门禁证据。
 * 输出上限：12000 字节，按 UTF-8 计量；超限截断明细，末行结论与明细计数行保留。
 * 扫描范围：活文档。排除 docs/ 与 CHANGELOG.md——前者是项目侧证据、审计归档与历史改造设计记录，
 *   后者的历史条目按当时版本的章节编号记述；两者的编号随版本成立，改写它们不产生一致性收益。
 *   目录排除由本脚本的专用排除集承担，只排除 docs、node_modules 与点开头目录，不排除 build、dist、coverage 等产物目录——以保持设计声称的对外行为；
 *   其中 C2 的扫描面另含 skills/ddd-methodology/scripts/*.js 与 extensions/*.ts 的脚本文件，其余校验项仍为活文档。
 * 规范依据：规范「结构与注释的机械证据」节的脚本消费契约表，与「结构与契约的演进治理」节的机械约束条。
 */

const fs = require("fs");
const path = require("path");
const { drift } = require("./lib/text.js");
const { capLines } = require("./lib/truncate.js");
const { CHANGELOG_NAME } = require("./lib/paths.js");
const { createSpecReader, relPath: toRelPath } = require("./lib/spec-doc.js");
const { loadRegistry } = require("./lib/ref-registry.js");
const installManifestCheck = require("./install-manifest-check.js");

const argv = process.argv.slice(2);
const root = path.resolve(argv.find((a) => !a.startsWith("--")) || process.cwd());
// --fix 已去除：其唯一写盘目标（编排脚本 stageRegistry）属「编排脚本重建」范围且写盘会破坏编排，故本脚本只读；保留提示避免静默忽略
if (argv.includes("--fix")) process.stdout.write("[提示] --fix 已去除：编排脚本重建不在本校验范围，本脚本只读不落盘\n");
const SKIP_FILE_NAMES = new Set([CHANGELOG_NAME]);
// workflow 与守卫扩展的固定路径：C4 以守卫单键作判定、以 workflow 阶段注册表作非漂移备注，只在装配处定义一次
const WORKFLOW_REL = ["skills", "ddd-methodology", "scripts", "ddd-workflow.js"];
const GUARD_REL = ["extensions", "ddd-governance.ts"];
// 活文档遍历的专用排除集：共享 walk 会连 build、dist 等产物目录一并排除，使扫描面窄于设计声称的对外行为；此处只排除项目侧证据与依赖目录
const REF_EXCLUDE_DIRS = new Set(["node_modules", "docs"]);
const REF_CHECK_REL = "skills/ddd-methodology/scripts/ref-check.js";

// 路径归一绑定仓库根：供各校验项统一输出
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
// 随装脚本白名单由 install-manifest-check.js 的枚举解析，经装配注入结构文档校验，避免两处各写一份脚本枚举
const shippedScripts = installManifestCheck.parseShippedScripts(root);

// 统一上下文：仓库根、路径归一、活文档清单、规范读取器、两处固定路径与随装脚本白名单；注册表在装载后回填 registry 键
const ctx = { root, relPath, liveDocPaths, spec, workflowRel: WORKFLOW_REL, guardRel: GUARD_REL, shippedScripts };

// 装配四步之一、之二：装载注册表并校验契约完整性（缺陷由 C31 转为缺口），契约与缺陷同置于 registry
const registry = loadRegistry(ctx);
ctx.registry = registry;

// 装配四步之三、之四：注册表已按 id 数字序排序，逐个执行并汇总；单项异常记入漂移清单后继续，不中断其余项
const checkResults = [];
for (const contract of registry.contracts) {
  try {
    const drifts = contract.run(ctx);
    checkResults.push({
      id: contract.id,
      title: contract.name,
      drifts: Array.isArray(drifts) ? drifts : [drift(contract.id, REF_CHECK_REL, 0, "校验项的 run 须回传漂移项数组", "回传数组", typeof drifts)],
    });
  } catch (error) {
    checkResults.push({ id: contract.id, title: contract.name, drifts: [drift(contract.id, REF_CHECK_REL, 0, "单项校验异常须记入漂移清单并继续", "该单项正常完成", String((error && error.message) || error))] });
  }
}
const totalDrifts = checkResults.reduce((sum, result) => sum + result.drifts.length, 0);

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
  return capLines({ total: droppableIndex.length, build });
}

const entries = [{ droppable: false, text: "=== 跨文档引用一致性校验 ===" }, { droppable: false, text: `仓库根：${root}` }, { droppable: false, text: `活文档：${liveDocPaths.length} 份；校验项：${registry.contracts.length} 项` }];
for (const result of checkResults) {
  const passed = !result.drifts.length;
  entries.push({ droppable: false, text: passed ? `[${result.id} ${result.title}] 通过` : `[${result.id} ${result.title}] 漂移 ${result.drifts.length} 项` });
  for (const d of result.drifts) {
    const where = d.line ? `${d.file}:${d.line}` : d.file;
    const actual = d.found ? `；实际 ${d.found}` : "";
    entries.push({ droppable: true, text: `  ✗ ${d.item} ${where} :: ${d.criterion}；期望 ${d.expect}${actual}` });
  }
}
entries.push({ droppable: false, text: "" }, { droppable: false, text: totalDrifts ? `结果：存在 ${totalDrifts} 项漂移` : `结果：通过，${registry.contracts.length} 项校验无漂移` }, { droppable: false, text: totalDrifts ? "RESULT: drift" : "RESULT: pass" });

process.stdout.write(capRefReport(entries).join("\n") + "\n");
process.exit(totalDrifts ? 1 : 0);
