#!/usr/bin/env node
/**
 * 目标：把本仓库跨文档引用、常量、清单与冻结短语的一致性外化为可复现的机械证据，供文档同步链在提交前校验。
 * 范围：C1 至 C9 九项校验，只读，不落盘；不做语义级判断，语义级重复与纸面消费方仍归审计代理。
 * 用法：node ref-check.js <仓库根>
 * 输出形态：文本正文；末行机读结论 `RESULT: pass`（无漂移）或 `RESULT: drift`（存在漂移）
 * 退出码：0 通过，1 存在漂移。门禁地位：本仓库文档同步链，不作被开发项目的门禁证据。
 * 输出上限：12000 字节，按 UTF-8 计量；超限截断明细，末行结论与明细计数行保留。
 * 扫描范围：活文档。排除 docs/ 与 CHANGELOG.md——前者是项目侧证据、审计归档与历史改造设计记录，
 *   后者的历史条目按当时版本的章节编号记述；两者的编号随版本成立，改写它们不产生一致性收益。
 *   其中 C2 的扫描面另含 scripts/*.js 与 extensions/*.ts 的脚本文件，其余校验项仍为活文档。
 * 规范依据：规范「结构与注释的机械证据」节的脚本消费契约表，与「结构与契约的演进治理」节的机械约束条。
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const REF_LIMIT_BYTES = 12000; // 与本脚本在脚本消费契约表中的输出上限一致
const SPEC_REL = ["skill", "ddd-methodology", "references", "spec.md"];
const WORKFLOW_REL = ["workflows", "ddd-workflow.js"];
const GUARD_REL = ["extensions", "ddd-governance.ts"];
const SKIP_DIR_NAMES = new Set(["node_modules", "docs"]);
const SKIP_FILE_NAMES = new Set(["CHANGELOG.md"]);
// 声明代理集合的入口：规范入口、仓库说明与安装脚本；卸载脚本随同一清单，不另立第二份
const AGENT_DECLARATION_FILES = [["skill", "ddd-methodology", "SKILL.md"], ["README.md"], ["scripts", "install.sh"], ["scripts", "install.bat"]];
const NON_AGENT_TOKENS = new Set(["ddd-methodology"]); // ddd- 前缀但非代理名：skill 包名
// 冻结短语的锚点用于检出改写：命中锚点却未逐字含短语即判漂移；豁免串是合法的同族短语
// 阈值锚点不入此清单：其一致性由 C3 按承载语义校验，若两处同校会因合法子集引用（如只写代码与基础能力两档）产生互斥误报
const FROZEN_PHRASES = [
  { phrase: "这个任务是只读的吗", anchors: ["任务是只读的"], exempt: [] },
  { phrase: "派发类型不匹配", anchors: ["派发类型不"], exempt: [] },
  { phrase: "记录被触碰文件的改动前后规模、是否拆解与依据的粒度预判", anchors: ["被触碰文件的改动前后规模"], exempt: [] },
  { phrase: "全量测试的唯一主体是 ddd-tester", anchors: ["唯一主体是"], exempt: [] },
  { phrase: "RESULT: pass", anchors: ["RESULT:"], exempt: ["RESULT: gap", "RESULT: report", "RESULT: drift"] },
  // 该短语在规范入口、仓库说明与全局规则三处并存；anchor 须整句前缀，短锚点会命中措辞不同的其他行而误报
  { phrase: "只读的探查、调研、方案比选、环境勘察、资料检索，一律派 scout", anchors: ["只读的探查、调研、方案比选、环境勘察、资料检索"], exempt: [] },
];
// 阈值上下文判据：阈值数字集中定义于规范「粒度与独立性」节，其余出现处须带正确的承载语义
const THRESHOLD_RULES = [
  { token: "500 行", cue: /代码|源码/, expect: "同段含代码文件语义" },
  { token: "300 行", cue: /基础|核心模块/, expect: "同段含基础或核心模块语义" },
  { token: "200 行", cue: /文档/, expect: "同段含文档语义" },
];

function readFileText(file) {
  try {
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  } catch (e) {
    return "";
  }
}
function withLineNumbers(text) {
  return String(text || "").split("\n").map((line, index) => ({ line, no: index + 1 }));
}
function relPath(file) {
  return path.relative(root, file).split(path.sep).join("/");
}
function drift(item, file, line, criterion, expect, found) {
  return { item, file, line, criterion, expect, found: found === undefined ? "" : String(found).slice(0, 60) };
}
// 活文档清单：只取扫描范围内的 md，docs/ 与版本记录由 SKIP_* 常量排除
function collectLiveDocs(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectLiveDocs(full, out);
    else if (entry.name.endsWith(".md") && !SKIP_FILE_NAMES.has(entry.name)) out.push(full);
  }
  return out;
}
// 节标题去掉编号前缀后即为跨文档引用的键，编号只是排序标识
function trimHeadingNumber(title) {
  return String(title || "").replace(/^\d+(?:\.\d+)*[.、]?\s*/, "").trim();
}
// 取指定标题的节正文与标题行号，标题匹配二级与三级
function sectionBody(text, title) {
  const rows = withLineNumbers(text);
  let startIndex = -1;
  let level = 0;
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i].line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!m) continue;
    if (startIndex < 0) {
      if (trimHeadingNumber(m[2]) === title) {
        startIndex = i;
        level = m[1].length;
      }
    } else if (m[1].length <= level) {
      return { body: rows.slice(startIndex + 1, i).map((r) => r.line).join("\n"), line: rows[startIndex].no };
    }
  }
  return startIndex < 0 ? null : { body: rows.slice(startIndex + 1).map((r) => r.line).join("\n"), line: rows[startIndex].no };
}

const liveDocPaths = collectLiveDocs(root);
const specPath = path.join(root, ...SPEC_REL);
const specText = readFileText(specPath);
const specHeadingSet = new Set();
for (const m of specText.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)) specHeadingSet.add(trimHeadingNumber(m[1]));
const specMissing = (item, criterion) => [drift(item, relPath(specPath), 0, criterion, "规范文件存在且可读")];

// C1 语义化节引用有效：见「X」节 的 X 须命中规范的二级或三级标题
function checkSemanticRefs() {
  if (!specText) return specMissing("C1", "语义化节引用须解析到规范节标题");
  const found = [];
  for (const file of liveDocPaths) {
    for (const row of withLineNumbers(readFileText(file))) {
      for (const m of row.line.matchAll(/见「([^」\n]+)」节/g)) {
        const title = trimHeadingNumber(m[1]);
        if (specHeadingSet.has(title)) continue;
        found.push(drift("C1", relPath(file), row.no, "见「X」节 的 X 须命中规范二级或三级标题", `标题「${title}」在规范节标题集合中`, m[0]));
      }
    }
  }
  return found;
}

// C2 的扩展扫描面：scripts/ 与 extensions/ 下的脚本文件，只取本层，不递归
function collectScanScripts() {
  const out = [];
  for (const [dirName, suffix] of [["scripts", ".js"], ["extensions", ".ts"]]) {
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, dirName), { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(suffix)) out.push(path.join(root, dirName, entry.name));
    }
  }
  return out;
}
// C2 裸章节号引用已清除：活文档与脚本文件中，编号须与语义化节名同行，规范允许编号附于语义化引用之后
function checkBareSectionRefs() {
  const found = [];
  for (const file of liveDocPaths.concat(collectScanScripts())) {
    for (const row of withLineNumbers(readFileText(file))) {
      if (!/§\s*\d/.test(row.line) || /见「[^」]+」节/.test(row.line)) continue;
      found.push(drift("C2", relPath(file), row.no, "跨节引用须用语义化节名，编号不得独立出现", "形如 见「节标题」节 的引用", row.line.trim()));
    }
  }
  return found;
}

// C3 阈值一致性：阈值数字三档各自的承载语义须与规范「粒度与独立性」节的锚点一致
function checkThresholds() {
  const found = [];
  for (const file of liveDocPaths) {
    for (const row of withLineNumbers(readFileText(file))) {
      for (const rule of THRESHOLD_RULES) {
        if (!row.line.includes(rule.token) || rule.cue.test(row.line)) continue;
        found.push(drift("C3", relPath(file), row.no, `阈值 ${rule.token} 的上下文须语义正确`, rule.expect, row.line.trim()));
      }
    }
  }
  return found;
}

// C4 阶段键一致性：workflow 的 stageRegistry 与规范「状态文件」节的 doneStages 键集合完全一致
function extractSpecStageKeys() {
  const section = sectionBody(specText, "状态文件");
  if (!section) return null;
  for (const row of withLineNumbers(section.body)) {
    if (!/doneStages/.test(row.line)) continue;
    const m = row.line.match(/[:：]\s*(`?[a-z][a-z0-9-]*`?(?:\s*、\s*`?[a-z][a-z0-9-]*`?)+)/);
    if (m) return { keys: m[1].split("、").map((s) => s.replace(/[`\s]/g, "")), line: section.line + row.no };
  }
  return null;
}
function checkStageKeys() {
  if (!specText) return specMissing("C4", "规范状态文件节须给出 doneStages 键集合");
  const workflowPath = path.join(root, ...WORKFLOW_REL);
  const workflowText = readFileText(workflowPath);
  const arrayMatch = workflowText.match(/const\s+stageRegistry\s*=\s*\[([\s\S]*?)\]/);
  const registryKeys = arrayMatch ? [...arrayMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  const arrayLine = arrayMatch ? workflowText.slice(0, arrayMatch.index).split("\n").length : 0;
  const specKeys = extractSpecStageKeys();
  if (!specKeys) return specMissing("C4", "规范状态文件节须以固定句列出 doneStages 键集合");
  if (!registryKeys.length) return [drift("C4", relPath(workflowPath), 0, "stageRegistry 须为字符串数组字面量", "可解析的阶段键列表", "未解析到数组")];
  const found = [];
  for (const key of specKeys.keys) {
    if (!registryKeys.includes(key)) found.push(drift("C4", relPath(workflowPath), arrayLine, "阶段注册表键集合须与规范状态文件节一致", `registry 含键「${key}」`));
  }
  for (const key of registryKeys) {
    if (!specKeys.keys.includes(key)) found.push(drift("C4", relPath(specPath), specKeys.line, "阶段注册表键集合须与规范状态文件节一致", `规范状态文件节含键「${key}」`));
  }
  return found;
}

// C5 代理清单一致性：agents/ddd-*.md 的文件集合与入口文档、安装脚本声明的代理集合一致
function checkAgentRoster() {
  let roster = [];
  try {
    roster = fs.readdirSync(path.join(root, "agents")).filter((name) => /^ddd-.*\.md$/.test(name)).map((name) => name.replace(/\.md$/, ""));
  } catch (e) {
    roster = [];
  }
  if (!roster.length) return [drift("C5", "agents/", 0, "代理定义目录须含 ddd-*.md", "至少一份代理定义")];
  const declared = new Map();
  for (const rel of AGENT_DECLARATION_FILES) {
    for (const row of withLineNumbers(readFileText(path.join(root, ...rel)))) {
      for (const m of row.line.matchAll(/(?<![\w./-])ddd-[a-z][a-z0-9-]*(?![\w./-])/g)) {
        if (!NON_AGENT_TOKENS.has(m[0]) && !declared.has(m[0])) declared.set(m[0], { file: rel.join("/"), line: row.no });
      }
    }
  }
  const found = [];
  for (const [token, at] of declared) {
    if (!roster.includes(token)) found.push(drift("C5", at.file, at.line, "声明的代理名须对应 agents/ 下的代理定义", `agents/${token}.md 存在`, token));
  }
  for (const name of roster) {
    if (!declared.has(name)) found.push(drift("C5", AGENT_DECLARATION_FILES.map((r) => r.join("/")).join("、"), 0, "每个代理定义须被入口文档或安装脚本声明", `${name} 被声明`, name));
  }
  return found;
}

// C6 门号一致性：文档中出现的门号须属于规范「质量门禁」节门禁表定义的门号集合
function extractSpecGateIds() {
  const section = sectionBody(specText, "质量门禁");
  if (!section) return null;
  const ids = new Set();
  for (const row of section.body.split("\n")) {
    if (!row.trim().startsWith("|")) continue;
    for (const cell of row.split("|")) {
      const value = cell.replace(/[`*\s]/g, "");
      if (/^G\d+(?:\.\d+|-INT)?$/.test(value)) ids.add(value);
    }
  }
  return ids.size ? ids : null;
}
function checkGateIds() {
  if (!specText) return specMissing("C6", "规范质量门禁表须给出门号集合");
  const gateIds = extractSpecGateIds();
  if (!gateIds) return specMissing("C6", "规范质量门禁表须给出门号集合");
  const allowed = [...gateIds].join("/");
  const found = [];
  for (const file of liveDocPaths) {
    for (const row of withLineNumbers(readFileText(file))) {
      for (const m of row.line.matchAll(/(?<![\w-])G\d+(?:\.\d+|-INT)?(?![\w-])/g)) {
        if (!gateIds.has(m[0])) found.push(drift("C6", relPath(file), row.no, "门号须属于规范门禁表定义的门号集合", `门号属于 ${allowed}`, m[0]));
      }
    }
  }
  return found;
}

// C7 脚本名一致性：文档引用的 scripts/ 下脚本名须存在对应文件
function checkScriptNames() {
  const found = [];
  const scriptsDir = path.join(root, "scripts");
  for (const file of liveDocPaths) {
    for (const row of withLineNumbers(readFileText(file))) {
      for (const m of row.line.matchAll(/scripts\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:js|sh|bat))/g)) {
        if (!fs.existsSync(path.join(scriptsDir, m[1]))) found.push(drift("C7", relPath(file), row.no, "引用的脚本名须存在对应文件", `scripts/${m[1]} 存在`, m[0]));
      }
    }
  }
  return found;
}

// C8 冻结短语一致性：按空白规范化后逐字比对；锚点用于检出改写，短语无载体亦判漂移
function checkFrozenPhrases() {
  const found = [];
  const flatten = (text) => String(text || "").replace(/\s+/g, "");
  for (const entry of FROZEN_PHRASES) {
    const phrase = flatten(entry.phrase);
    let occurrences = 0;
    for (const file of liveDocPaths) {
      for (const row of withLineNumbers(readFileText(file))) {
        const flat = flatten(row.line);
        if (flat.includes(phrase)) {
          occurrences++;
          continue;
        }
        if (!entry.anchors.some((anchor) => flat.includes(flatten(anchor)))) continue;
        if (entry.exempt.some((sibling) => flat.includes(flatten(sibling)))) continue;
        found.push(drift("C8", relPath(file), row.no, "冻结短语须逐字一致", `逐字含「${entry.phrase}」`, row.line.trim()));
      }
    }
    if (!occurrences) found.push(drift("C8", "活文档", 0, "冻结短语须在其载体文档中至少逐字出现一次", `出现「${entry.phrase}」`, "未检出"));
  }
  return found;
}

// C9 守卫编号一致性：扩展文件头的编号与触发点，与规范「机械约束」节的守卫判定表一致
function normalizeGuardToken(text) {
  return String(text || "").replace(/[`*\s]/g, "");
}
function extractHeaderGuards(extText) {
  const headerMatch = extText.match(/\/\*\*([\s\S]*?)\*\//);
  const guards = new Map();
  for (const row of withLineNumbers(headerMatch ? headerMatch[1] : "")) {
    const m = row.line.match(/^\s*\*\s*-\s*(H-\d+)\b(.*)$/);
    if (!m) continue;
    const labeled = m[2].match(/触发点\s*[:：]\s*([^。；;\n]+)/);
    const paren = m[2].match(/[（(]([^）)]+)[）)]/);
    guards.set(m[1], normalizeGuardToken(labeled ? labeled[1] : paren ? paren[1] : ""));
  }
  return guards;
}
function extractSpecGuards() {
  const section = sectionBody(specText, "机械约束");
  if (!section) return null;
  const guards = new Map();
  for (const row of withLineNumbers(section.body)) {
    if (!row.line.trim().startsWith("|")) continue;
    const cells = row.line.split("|").map((cell) => cell.replace(/[`*\s]/g, ""));
    if (/^H-\d+$/.test(cells[1] || "")) guards.set(cells[1], { trigger: cells[2] || "", line: section.line + row.no });
  }
  return guards.size ? guards : null;
}
function checkGuardIds() {
  if (!specText) return specMissing("C9", "规范机械约束节须给出运行时守卫判定表");
  const specGuards = extractSpecGuards();
  if (!specGuards) return specMissing("C9", "规范机械约束节须给出运行时守卫判定表");
  const guardPath = path.join(root, ...GUARD_REL);
  const headerGuards = extractHeaderGuards(readFileText(guardPath));
  if (!headerGuards.size) {
    return [drift("C9", relPath(guardPath), 0, "守卫扩展文件头须按编号列出触发点", "形如 - H-1 触发点：… 的条目", "未解析到编号条目")];
  }
  const found = [];
  for (const [id, row] of specGuards) {
    if (!headerGuards.has(id)) {
      found.push(drift("C9", relPath(guardPath), 0, "守卫编号集合须与规范守卫表一致", `文件头含编号 ${id}`, id));
      continue;
    }
    if (headerGuards.get(id) !== row.trigger) {
      found.push(drift("C9", relPath(guardPath), 0, "守卫触发点须与规范守卫表逐字一致", `${id} 的触发点为 ${row.trigger}`, headerGuards.get(id)));
    }
  }
  for (const id of headerGuards.keys()) {
    if (!specGuards.has(id)) found.push(drift("C9", relPath(specPath), 0, "守卫编号集合须与规范守卫表一致", `规范守卫表含编号 ${id}`, id));
  }
  return found;
}

const CHECKS = [
  ["C1", "语义化节引用有效", checkSemanticRefs],
  ["C2", "裸章节号引用已清除", checkBareSectionRefs],
  ["C3", "阈值一致性", checkThresholds],
  ["C4", "阶段键一致性", checkStageKeys],
  ["C5", "代理清单一致性", checkAgentRoster],
  ["C6", "门号一致性", checkGateIds],
  ["C7", "脚本名一致性", checkScriptNames],
  ["C8", "冻结短语一致性", checkFrozenPhrases],
  ["C9", "守卫编号一致性", checkGuardIds],
];

// 每项独立执行：单项异常记入漂移清单后继续，不中断其余项
const checkResults = [];
for (const [id, title, run] of CHECKS) {
  try {
    checkResults.push({ id, title, drifts: run() });
  } catch (error) {
    checkResults.push({ id, title, drifts: [drift(id, "scripts/ref-check.js", 0, "单项校验异常须记入漂移清单并继续", "该单项正常完成", String((error && error.message) || error))] });
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
  for (let keep = droppableIndex.length; keep >= 0; keep--) {
    const lines = build(keep);
    if (Buffer.byteLength(lines.join("\n"), "utf8") <= REF_LIMIT_BYTES) return lines;
  }
  return build(0);
}

const entries = [
  { droppable: false, text: "=== 跨文档引用一致性校验 ===" },
  { droppable: false, text: `仓库根：${root}` },
  { droppable: false, text: `活文档：${liveDocPaths.length} 份；校验项：${CHECKS.length} 项` },
];
for (const result of checkResults) {
  const passed = !result.drifts.length;
  entries.push({ droppable: false, text: passed ? `[${result.id} ${result.title}] 通过` : `[${result.id} ${result.title}] 漂移 ${result.drifts.length} 项` });
  for (const d of result.drifts) {
    const where = d.line ? `${d.file}:${d.line}` : d.file;
    const actual = d.found ? `；实际 ${d.found}` : "";
    entries.push({ droppable: true, text: `  ✗ ${d.item} ${where} :: ${d.criterion}；期望 ${d.expect}${actual}` });
  }
}
entries.push({ droppable: false, text: "" });
entries.push({ droppable: false, text: totalDrifts ? `结果：存在 ${totalDrifts} 项漂移` : "结果：通过，九项校验无漂移" });
entries.push({ droppable: false, text: totalDrifts ? "RESULT: drift" : "RESULT: pass" });

process.stdout.write(capRefReport(entries).join("\n") + "\n");
process.exit(totalDrifts ? 1 : 0);
