/**
 * 目标：把项目级代理实例与其模板的不可迭代面一致性外化为机械证据 C35，
 *   使项目级定义按设计可自迭代可迭代面的同时，不可迭代面的滞后漂移不再机械不可测。
 * 范围：C35 三项不可迭代面——其一，frontmatter 的 acceptanceRole，对应只读权限；
 *   其二，输出契约首句声明的报告章节列表，对应报告必备章节；其三，输出契约与停止条件两处声明的报告章节数的一致性。
 *   基准恒为模板，逐实例正向比对；实例缺失或无同名模板可比对时报不适用而非缺口，退出非错。
 * 不包含：四类可迭代面（检查项清单、项目特有判据、探索性检索面、报告建议归档命名）一律不纳入判据，否则阻断项目自迭代；
 *   代理名清单一致性见 lib/ref-external.js 的 C5，基线键一致性见 lib/ref-inventory.js 的 C24；命令行入口。
 * 依据：DESIGN-decisions.md 第十一节项目级代理演进机制、DESIGN-agents.md 第三节、DESIGN-checkchain.md 第二至三节。
 * 依赖：文本读取与漂移项构造取 ./text.js，标题去编号取 ./spec-doc.js。不引入第三方依赖。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./text.js");
const { stripHeadingNumber } = require("./spec-doc.js");

const ID = "C35";
// 实例落点与模板落点：两者同名比对；实例目录为点开头，故不属 ref-check 活文档扫描面
const INSTANCE_DIR_REL = [".pi", "agents"];
const TEMPLATE_DIR_REL = ["skills", "ddd-methodology", "assets", "agent-templates"];
// 代理定义文件名形态：kebab-case 且前缀 ddd-，与固定代理同名规约一致
const AGENT_FILE_RE = /^ddd-[a-z][a-z0-9-]*\.md$/;
// 报告章节数的计数声明：形如「九节」，取「节」前紧邻的计数字，中文或阿拉伯皆可
const COUNT_TOKEN_RE = /([〇零一二三四五六七八九十百千两\d]+)\s*节/;

// 目录内代理定义文件名，按字典序稳定输出；目录缺失或不可读回空数组
function agentFilesIn(dir) {
  let names; try { names = fs.readdirSync(dir); } catch (e) { return []; }
  return names.filter((name) => AGENT_FILE_RE.test(name)).sort();
}

// 指定标题的节：取首个命中标题（标题先剥编号），回传标题行号与其正文；未命中回 null
function sectionOf(text, title) {
  const rows = withLineNumbers(text);
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i].line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!m || stripHeadingNumber(m[2]) !== title) continue;
    const level = m[1].length;
    const body = [];
    for (let j = i + 1; j < rows.length; j++) {
      const n = rows[j].line.match(/^(#{1,6})\s+/);
      if (n && n[1].length <= level) break;
      body.push(rows[j].line);
    }
    return { line: rows[i].no, body: body.join("\n") };
  }
  return null;
}

// 首句：节正文压平后取首个句号之前，使后续句中的可迭代表述（如建议归档命名）不进入判据
function firstSentence(body) {
  const flat = String(body || "").replace(/\s+/g, " ").trim();
  const end = flat.indexOf("。");
  return end >= 0 ? flat.slice(0, end) : flat;
}

// 报告章节列表：自首句的列举部分按「、」切分，末项若含末位合取词「与」再拆，
//   使「甲、乙与丙」与「甲、乙、丙」两种列举写法归一，而项内「与」（如「审计范围与清单总数」）不误拆
function sectionListOf(body) {
  const sentence = firstSentence(body);
  let listText = sentence;
  const colon = sentence.indexOf("：");
  if (colon >= 0) listText = sentence.slice(colon + 1);
  else { const han = sentence.indexOf("含"); if (han >= 0) listText = sentence.slice(han + 1); }
  let items = listText.split("、").map((s) => s.trim()).filter(Boolean);
  if (items.length > 1) {
    const tail = items[items.length - 1].split("与").map((s) => s.trim()).filter(Boolean);
    if (tail.length > 1) items = items.slice(0, -1).concat(tail);
  }
  return items;
}

// 报告章节数声明：首句内「节」前紧邻的计数字，无声明回 null
function countTokenOf(body) {
  const m = firstSentence(body).match(COUNT_TOKEN_RE);
  return m ? m[1] : null;
}

// 单个定义的不可迭代面读面：acceptanceRole 及其行号、输出契约与停止条件两节、报告章节列表与两处章节数声明
function readDefinition(text) {
  const rows = withLineNumbers(text);
  const roleRow = rows.find((row) => /^\s*acceptanceRole\s*:/.test(row.line));
  const roleMatch = roleRow ? roleRow.line.match(/^\s*acceptanceRole\s*:\s*(\S+)\s*$/) : null;
  const output = sectionOf(text, "输出契约");
  const stop = sectionOf(text, "停止条件");
  return {
    role: roleMatch ? roleMatch[1] : null,
    roleLine: roleRow ? roleRow.no : 1,
    outputLine: output ? output.line : 0,
    stopLine: stop ? stop.line : 0,
    sections: output ? sectionListOf(output.body) : [],
    declaredToken: output ? countTokenOf(output.body) : null,
    stopToken: stop ? countTokenOf(stop.body) : null,
  };
}

// 面一：只读权限——acceptanceRole 须与模板一致，防项目自我放松为可写而自审自改
function checkRole(rel, template, instance) {
  if (template.role === instance.role) return [];
  return [drift(ID, rel, instance.roleLine, "项目级代理实例的 acceptanceRole 须与模板一致，只读权限属不可迭代面", `acceptanceRole: ${template.role}`, `实例 acceptanceRole: ${instance.role}`)];
}

// 面二：报告必备章节——输出契约声明的章节列表须与模板逐项一致，缺项、增项或改序即报，并指明首个差异位置
function checkSections(rel, template, instance) {
  const t = template.sections;
  const i = instance.sections;
  if (!t.length && !i.length) return [];
  if (t.length === i.length && t.every((name, k) => name === i[k])) return [];
  let at = 0;
  while (at < t.length && at < i.length && t[at] === i[at]) at++;
  return [drift(ID, rel, instance.outputLine, "输出契约声明的报告章节列表须与模板一致，报告必备章节属不可迭代面", `与模板一致（${t.length} 节：${t.join("、")}）`, `实例 ${i.length} 节，第 ${at + 1} 处起不符：${i.slice(at).join("、")}`)];
}

// 面三：报告章节数与停止条件声明的一致性——实例内两处声明的章节数须一致，且各自与模板一致
function checkCounts(rel, template, instance) {
  if (instance.declaredToken !== null && instance.stopToken !== null && instance.declaredToken !== instance.stopToken) {
    return [drift(ID, rel, instance.stopLine, "报告章节数须与停止条件声明一致", `停止条件声明与输出契约同为「${instance.declaredToken}节」`, `输出契约「${instance.declaredToken}节」、停止条件「${instance.stopToken}节」`)];
  }
  const found = [];
  if (instance.declaredToken !== template.declaredToken) found.push(drift(ID, rel, instance.outputLine, "输出契约声明的报告章节数须与模板一致", `「${template.declaredToken}节」`, `实例「${instance.declaredToken}节」`));
  if (instance.stopToken !== template.stopToken) found.push(drift(ID, rel, instance.stopLine, "停止条件声明的报告章节数须与模板一致", `「${template.stopToken}节」`, `实例「${instance.stopToken}节」`));
  return found;
}

// C35 判据入口：仅比对存在同名模板的项目级实例；无可比对对象时报不适用，不产漂移
function checkAgentInstances(ctx) {
  const { root, relPath } = ctx;
  const instanceDir = path.join(root, ...INSTANCE_DIR_REL);
  const instances = agentFilesIn(instanceDir);
  if (!instances.length) {
    process.stdout.write(`[C35 不适用] ${INSTANCE_DIR_REL.join("/")} 下无项目级代理实例，本校验不适用，不计入漂移\n`);
    return [];
  }
  const templateDir = path.join(root, ...TEMPLATE_DIR_REL);
  const found = [];
  let compared = 0;
  for (const name of instances) {
    const templatePath = path.join(templateDir, name);
    if (!fs.existsSync(templatePath)) continue;
    const rel = relPath(path.join(instanceDir, name));
    const template = readDefinition(readFileText(templatePath));
    const instance = readDefinition(readFileText(path.join(instanceDir, name)));
    found.push(...checkRole(rel, template, instance), ...checkSections(rel, template, instance), ...checkCounts(rel, template, instance));
    compared++;
  }
  if (!compared) {
    process.stdout.write(`[C35 不适用] 项目级代理实例无同名模板可比对，本校验不适用，不计入漂移\n`);
    return [];
  }
  return found;
}

// 注册表契约：id、简名与所属域随本模块声明；run 只转接本模块判据，装配处不掌握判据内容
module.exports = {
  contracts: [{ id: ID, name: "项目级代理不可迭代面一致", domain: "agent", run: (ctx) => checkAgentInstances(ctx) }],
};
