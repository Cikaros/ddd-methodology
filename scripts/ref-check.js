#!/usr/bin/env node
/**
 * 目标：把本仓库跨文档引用、常量、清单与冻结短语的一致性外化为可复现的机械证据，供文档同步链在提交前校验。
 * 范围：C1 至 C11 十一项校验；默认只读不落盘，仅 --fix 写盘，写盘范围限 workflow 的阶段注册表块。
 * 清单类校验 C5 与 C11 由 ./roster-check.js 提供，本脚本只作调用。
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
const { readFileText, withLineNumbers, drift } = require("./lib/text.js");
const decisionTables = require("./decision-tables.js");
const rosterCheck = require("./roster-check.js");

const argv = process.argv.slice(2);
const fixMode = argv.includes("--fix");
const root = path.resolve(argv.find((a) => !a.startsWith("--")) || process.cwd());
const REF_LIMIT_BYTES = 12000; // 与本脚本在脚本消费契约表中的输出上限一致
const SPEC_DIR_REL = ["skill", "ddd-methodology", "references"];
const SPEC_FILE_RE = /^spec.*\.md$/;
const WORKFLOW_REL = ["workflows", "ddd-workflow.js"];
const GUARD_REL = ["extensions", "ddd-governance.ts"];
const SKIP_FILE_NAMES = new Set(["CHANGELOG.md"]);
// 活文档遍历的专用排除集：共享 walk 会连 build、dist 等产物目录一并排除，使扫描面窄于设计声称的对外行为；此处只排除项目侧证据与依赖目录
const REF_EXCLUDE_DIRS = new Set(["node_modules", "docs"]);
// 冻结短语的锚点用于检出改写：命中锚点却未逐字含短语即判漂移；豁免串是合法的同族短语；存量重建节六条锚点取该短语独有片段，避免命中措辞相近的载体行
// 阈值锚点不入此清单：其一致性由 C3 按承载语义校验，若两处同校会因合法子集引用（如只写代码与基础能力两档）产生互斥误报
const FROZEN_PHRASES = [
  { phrase: "这个任务是只读的吗", anchors: ["任务是只读的"], exempt: [] },
  { phrase: "派发类型不匹配", anchors: ["派发类型不"], exempt: [] },
  { phrase: "记录被触碰文件的改动前后规模、是否拆解与依据的粒度预判", anchors: ["被触碰文件的改动前后规模"], exempt: [] },
  { phrase: "全量测试的唯一主体是 ddd-tester", anchors: ["唯一主体是"], exempt: [] },
  { phrase: "RESULT: pass", anchors: ["RESULT:"], exempt: ["RESULT: gap", "RESULT: report", "RESULT: drift"] },
  // 该短语在规范入口、仓库说明与全局规则三处并存；anchor 须整句前缀，短锚点会命中措辞不同的其他行而误报
  { phrase: "只读的探查、调研、方案比选、环境勘察、资料检索，一律派 scout", anchors: ["只读的探查、调研、方案比选、环境勘察、资料检索"], exempt: [] },
  { phrase: "触发时机由人工判断，落在入口", anchors: ["触发时机由人工判断"], exempt: [] },
  { phrase: "丢弃是相对旧版本的丢弃，不是绝对丢失", anchors: ["丢弃是相对旧版本的丢弃"], exempt: [] },
  { phrase: "对外契约；经审计确认仍然成立的设计决策；仍在被消费的能力", anchors: ["经审计确认仍然成立的设计决策"], exempt: [] },
  { phrase: "未列入废弃清单而实际不再使用的产物，视为静默保留，属缺陷", anchors: ["未列入废弃清单而实际不再使用的产物"], exempt: [] },
  // 废弃清单类别短语的载体在 templates-rebuild.md；锚点取含顿号分隔的独有片段，避免命中规范 17.5 中以「与」连接的措辞相近行
  { phrase: "架构、代码、测试、文档、配置", anchors: ["代码、测试、文档、配置"], exempt: [] },
  { phrase: "行为等价性以 AC 全量回归验证，不得以子集用例证明等价", anchors: ["行为等价性以 AC 全量回归验证"], exempt: [] },
];
function relPath(file) {
  return path.relative(root, file).split(path.sep).join("/");
}
// 节标题去掉编号前缀后即为跨文档引用的键，编号只是排序标识
function trimHeadingNumber(title) {
  return String(title || "").replace(/^\d+(?:\.\d+)*[.、]?\s*/, "").trim();
}
// 取指定标题的全部节（同文件可出现多处），标题匹配二级与三级：返回各自正文与标题行号
function sectionsWithTitle(text, title) {
  const rows = withLineNumbers(text);
  const matches = [];
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i].line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!m || trimHeadingNumber(m[2]) !== title) continue;
    const level = m[1].length;
    let end = rows.length;
    for (let j = i + 1; j < rows.length; j++) {
      const next = rows[j].line.match(/^(#{2,3})\s+/);
      if (next && next[1].length <= level) { end = j; break; }
    }
    matches.push({ body: rows.slice(i + 1, end).map((r) => r.line).join("\n"), line: rows[i].no });
  }
  return matches;
}

// 规范读取面：references 下全部 spec*.md 构成逻辑文本集合；节标题跨文件唯一，故可按标题全局定位
function collectSpecDocs() {
  const dir = path.join(root, ...SPEC_DIR_REL);
  let names = []; try { names = fs.readdirSync(dir); } catch (e) { return []; }
  return names.filter((name) => SPEC_FILE_RE.test(name)).map((name) => ({ rel: relPath(path.join(dir, name)), text: readFileText(path.join(dir, name)) }));
}
// 跨文件节查找：命中多于一处时回传歧义标记，不得静默取首个
function findSpecSection(title) {
  const hits = [];
  for (const doc of specDocs) for (const s of sectionsWithTitle(doc.text, title)) hits.push({ body: s.body, line: s.line, rel: doc.rel });
  return hits.length === 0 ? null : hits.length === 1 ? hits[0] : { ambiguous: true, hits };
}

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
const specDocs = collectSpecDocs();
// 规范节标题的跨文件索引：既作 C1 的引用键集合，又作 C1 唯一性判据的位置来源
const headingSources = new Map();
for (const doc of specDocs) {
  for (const row of withLineNumbers(doc.text)) {
    const m = row.line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!m) continue;
    const title = trimHeadingNumber(m[2]);
    headingSources.set(title, (headingSources.get(title) || []).concat({ rel: doc.rel, line: row.no }));
  }
}
const specHeadingSet = new Set(headingSources.keys());
// 规范文件回填：节缺失时漂移项须指向具体文件，不得退化为目录名；目录名只留在 found 提示
const SPEC_FILE_FALLBACK = SPEC_DIR_REL.concat("spec.md").join("/");
const firstSpecFile = () => (specDocs.length ? specDocs[0].rel : SPEC_FILE_FALLBACK);
const specMissing = (item, criterion) => [drift(item, firstSpecFile(), 0, criterion, "规范文件存在且可读", SPEC_DIR_REL.join("/"))];
// 节标题在规范中命中多于一处即歧义：漂移项指首处，found 列全部命中位置供人工复核
function specSectionDrift(item, title, hits) {
  return drift(item, hits[0].rel, hits[0].line, `规范节标题「${title}」须跨文件唯一，定位不得歧义`, "唯一命中", hits.map((h) => `${h.rel}:${h.line}`).join("、"));
}

// C1 语义化节引用有效：见「X」节 的 X 须命中规范的二级或三级标题；规范节标题去编号后须跨文件唯一
function checkSemanticRefs() {
  if (!specDocs.length) return specMissing("C1", "语义化节引用须解析到规范节标题");
  const found = [];
  for (const [title, hits] of headingSources) {
    if (hits.length > 1) found.push(drift("C1", hits[0].rel, hits[0].line, "规范二级与三级节标题去编号后须跨文件唯一", `「${title}」唯一命中`, hits.map((h) => `${h.rel}:${h.line}`).join("、")));
  }
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
    try { entries = fs.readdirSync(path.join(root, dirName), { withFileTypes: true }); } catch (e) { continue; }
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

// C3 阈值一致性：阈值以规范「粒度与独立性」节的锚点句为唯一权威，其余出现处须同值且承载正确语义
// 锚点解析：取该节含「行」阈值最多的一句，捕获「标签 数字 行」三元组；不足三档或不可解析即判漂移
function thresholdKeywords(label) {
  return label.split(/或/).map((part) => part.replace(/(文件|模块|项|契约|数)$/, "")).filter(Boolean);
}
function parseThresholdAnchor() {
  const section = findSpecSection("粒度与独立性");
  if (!section || section.ambiguous) return section && section.ambiguous ? { ambiguous: section.hits } : null;
  const lines = withLineNumbers(section.body).map((r) => r.line);
  const anchorLine = lines.slice().sort((a, b) => (b.match(/\d+\s*行/g) || []).length - (a.match(/\d+\s*行/g) || []).length)[0] || "";
  const rules = [];
  for (const m of anchorLine.matchAll(/([\u4e00-\u9fa5A-Za-z]+?)\s*(\d+)\s*行/g)) {
    const keywords = thresholdKeywords(m[1]);
    if (keywords.length) rules.push({ value: Number(m[2]), token: `${m[2]} 行`, label: m[1], cue: new RegExp(keywords.join("|")) });
  }
  return rules.length >= 3 ? { rules } : { invalid: true };
}
function checkThresholds() {
  if (!specDocs.length) return specMissing("C3", "规范粒度与独立性节须给出可解析的阈值锚点句");
  const anchor = parseThresholdAnchor();
  if (anchor && anchor.ambiguous) return [specSectionDrift("C3", "粒度与独立性", anchor.ambiguous)];
  if (!anchor || anchor.invalid) return [drift("C3", firstSpecFile(), 0, "规范粒度与独立性节须含可解析的三档阈值锚点句", "三档阈值锚点句", "锚点句不可解析")];
  const found = [];
  for (const file of liveDocPaths) {
    for (const row of withLineNumbers(readFileText(file))) {
      const hasRowToken = /\d+\s*行/.test(row.line);
      for (const rule of anchor.rules) {
        const mentioned = row.line.includes(rule.token);
        const cued = rule.cue.test(row.line);
        if (!hasRowToken || mentioned === cued) continue;
        found.push(drift("C3", relPath(file), row.no, mentioned ? `阈值 ${rule.token} 的上下文须承载锚点语义` : `阈值行须与锚点同值，${rule.label} 档锚点为 ${rule.token}`, mentioned ? `锚点语义 ${rule.label}` : `含 ${rule.token}`, row.line.trim()));
      }
    }
  }
  return found;
}

// C4 阶段键三方一致性：spec 键清单、workflow 阶段注册表、guard 单键
function extractSpecStageKeys() {
  const section = findSpecSection("状态文件");
  if (!section) return null;
  if (section.ambiguous) return { ambiguous: section.hits };
  for (const row of withLineNumbers(section.body)) {
    if (!/doneStages/.test(row.line)) continue;
    const m = row.line.match(/[:：]\s*(`?[a-z][a-z0-9-]*`?(?:\s*、\s*`?[a-z][a-z0-9-]*`?)+)/);
    if (m) return { keys: m[1].split("、").map((s) => s.replace(/[`\s]/g, "")), line: section.line + row.no, rel: section.rel };
  }
  return null;
}
// 三处副本的唯一读取入口：C4 与 --fix 共用，不得另立解析
function readStageKeySources() {
  const workflowPath = path.join(root, ...WORKFLOW_REL);
  const workflowText = readFileText(workflowPath);
  const stageRegistryBlock = workflowText.match(/const\s+stageRegistry\s*=\s*\[[\s\S]*?\]/);
  const spec = extractSpecStageKeys();
  const guard = readFileText(path.join(root, ...GUARD_REL)).match(/G5_INT_STAGE\s*=\s*"([^"]+)"/);
  return {
    workflowPath, workflowText, stageRegistryBlock,
    registryKeys: stageRegistryBlock ? [...stageRegistryBlock[0].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [],
    registryLine: stageRegistryBlock ? workflowText.slice(0, stageRegistryBlock.index).split("\n").length : 0,
    specKeys: spec && !spec.ambiguous ? spec.keys : null, specLine: spec && !spec.ambiguous ? spec.line : 0,
    specRel: spec && !spec.ambiguous ? spec.rel : firstSpecFile(), specAmbiguous: spec && spec.ambiguous ? spec.ambiguous : null,
    guardKey: guard ? guard[1] : null,
  };
}
// 三方比对的唯一实现：spec 为源，workflow 与 guard 为受控副本，任一缺失或多出即报漂移
function compareStageKeys(src) {
  if (!src.specKeys) return [drift("C4", src.specRel, 0, "规范状态文件节须以固定句列出 doneStages 键集合", "spec 键清单", "未解析到")];
  if (!src.registryKeys.length) return [drift("C4", relPath(src.workflowPath), 0, "stageRegistry 须为字符串数组字面量", "可解析的阶段键列表", "未解析到数组")];
  const found = [];
  for (const key of src.specKeys) {
    if (!src.registryKeys.includes(key)) found.push(drift("C4", relPath(src.workflowPath), src.registryLine, "三方键集合须一致", `registry 含键「${key}」`));
  }
  for (const key of src.registryKeys) {
    if (!src.specKeys.includes(key)) found.push(drift("C4", src.specRel, src.specLine, "三方键集合须一致", `spec 键清单含键「${key}」`));
  }
  if (!src.guardKey) found.push(drift("C4", GUARD_REL.join("/"), 0, "guard 单键须可解析且属于 spec 键清单", "G5_INT_STAGE 常量", "未解析到"));
  else if (!src.specKeys.includes(src.guardKey)) found.push(drift("C4", GUARD_REL.join("/"), 0, "guard 单键须属于 spec 键清单", `guard 键属于 ${src.specKeys.join("/")}`, src.guardKey));
  return found;
}
function checkStageKeys() {
  if (!specDocs.length) return specMissing("C4", "规范状态文件节须给出 doneStages 键集合");
  const src = readStageKeySources();
  if (src.specAmbiguous) return [specSectionDrift("C4", "状态文件", src.specAmbiguous)];
  return compareStageKeys(src);
}

// C6 门号一致性：文档中出现的门号须属于规范「质量门禁」节门禁表定义的门号集合
function extractSpecGateIds() {
  const section = findSpecSection("质量门禁");
  if (!section) return null;
  if (section.ambiguous) return { ambiguous: section.hits };
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
  if (!specDocs.length) return specMissing("C6", "规范质量门禁表须给出门号集合");
  const gateIds = extractSpecGateIds();
  if (gateIds && gateIds.ambiguous) return [specSectionDrift("C6", "质量门禁", gateIds.ambiguous)];
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
  const section = findSpecSection("机械约束");
  if (!section) return null;
  if (section.ambiguous) return { ambiguous: section.hits };
  const guards = new Map();
  for (const row of withLineNumbers(section.body)) {
    if (!row.line.trim().startsWith("|")) continue;
    const cells = row.line.split("|").map((cell) => cell.replace(/[`*\s]/g, ""));
    if (/^H-\d+$/.test(cells[1] || "")) guards.set(cells[1], { trigger: cells[2] || "", line: section.line + row.no });
  }
  return guards.size ? { guards, rel: section.rel } : null;
}
function checkGuardIds() {
  if (!specDocs.length) return specMissing("C9", "规范机械约束节须给出运行时守卫判定表");
  const specSection = extractSpecGuards();
  if (specSection && specSection.ambiguous) return [specSectionDrift("C9", "机械约束", specSection.ambiguous)];
  if (!specSection) return specMissing("C9", "规范机械约束节须给出运行时守卫判定表");
  const { guards: specGuards, rel: specGuardRel } = specSection;
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
    if (!specGuards.has(id)) found.push(drift("C9", specGuardRel, 0, "守卫编号集合须与规范守卫表一致", `规范守卫表含编号 ${id}`, id));
  }
  return found;
}
// 生成 workflow 阶段注册表块：与期望集合逐项且顺序一致；同一输入必得同一文本，保证 --fix 幂等
function renderStageRegistry(keys) {
  const lines = [];
  let line = "";
  for (const key of keys) {
    const token = `"${key}"`;
    const joined = line ? `${line}, ${token}` : token;
    if (line && joined.length > 74) { lines.push(`  ${line},`); line = token; }
    else line = joined;
  }
  if (line) lines.push(`  ${line},`);
  return `const stageRegistry = [\n${lines.join("\n")}\n]`;
}
// --fix 唯一写盘点：只重写 workflow 的阶段注册表块，写盘前先比对，无差异不写盘；guard 只校验不写
function runFix(src) {
  if (!src.specKeys) return { error: "spec 状态文件节的键清单不可解析", changes: [] };
  if (!src.stageRegistryBlock) return { error: "workflow 的 stageRegistry 数组块不可解析", changes: [] };
  const expected = renderStageRegistry(src.specKeys);
  const changes = [];
  if (src.stageRegistryBlock[0] !== expected) {
    const next = src.workflowText.slice(0, src.stageRegistryBlock.index) + expected + src.workflowText.slice(src.stageRegistryBlock.index + src.stageRegistryBlock[0].length);
    fs.writeFileSync(src.workflowPath, next);
    changes.push(`${relPath(src.workflowPath)}：阶段注册表已按 spec 键清单重写（${src.specKeys.length} 项）`);
  }
  return { changes, guardOk: !!src.guardKey && src.specKeys.includes(src.guardKey), guardKey: src.guardKey };
}

const CHECKS = [
  ["C1", "语义化节引用有效", checkSemanticRefs],
  ["C2", "裸章节号引用已清除", checkBareSectionRefs],
  ["C3", "阈值一致性", checkThresholds],
  ["C4", "阶段键一致性", checkStageKeys],
  ["C5", "代理清单一致性", () => rosterCheck.checkAgentRoster(root)],
  ["C6", "门号一致性", checkGateIds],
  ["C7", "脚本名一致性", checkScriptNames],
  ["C8", "冻结短语一致性", checkFrozenPhrases],
  ["C9", "守卫编号一致性", checkGuardIds],
  ["C10", "判定表默认分支", () => decisionTables.checkJudgmentDefault(liveDocPaths.map(relPath), (rel) => readFileText(path.join(root, rel)))],
  ["C11", "skill 清单一致性", () => rosterCheck.checkSkillRoster(root)],
];

// --fix 先于校验写盘，使报告与末行结论反映修复后状态；默认模式不触盘
const fixResult = fixMode ? runFix(readStageKeySources()) : null;

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
