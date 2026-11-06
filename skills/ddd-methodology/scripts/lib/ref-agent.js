/**
 * 目标：把项目级代理实例与其模板的不可迭代面一致性外化为机械证据 C35。
 *   读面取定义头部的 C35 契约标记，不从输出契约散文提取章节列举，使模板句式调整不再让判定静默失效。
 * 范围：标记四项不可迭代面——其一 role，对应只读权限主体，与 frontmatter 的 acceptanceRole 互校；
 *   其二 tools，对应只读权限的工具集，与 frontmatter 的 tools 互校，工具集含 write 或 edit 即报缺陷；
 *   其三 sections，对应报告必备章节的逐项列举；其四 headings，对应文件一级标题总数。
 *   两侧均以标记为准比对：role、tools 与 sections 逐项比模板，headings 各自与所属文件实际一级标题数比。
 *   输入输出契约的机械锚点仅由标记本体自证——标记四项齐备且 headings 与所属文件一级标题数一致，本判据不与输出契约正文互校。
 * 不包含：四类可迭代面（检查项清单、项目特有判据、探索性检索面、报告建议归档命名）一律不纳入判据，否则阻断项目自迭代；
 *   不可迭代面四项中的门禁挂钩点无结构化字段可机械比对，暂判不适用；
 *   代理名清单一致性见 lib/ref-external.js 的 C5，基线键一致性见 lib/ref-inventory.js 的 C24；命令行入口。
 * 依据：DESIGN-decisions.md 第十一节项目级代理演进机制、DESIGN-agents.md 第三节、DESIGN-checkchain.md 第二至三节。
 * 依赖：文本读取、拆行编号与漂移项构造取 ./text.js。不引入第三方依赖。
 * 基准恒为模板，逐实例正向比对；实例缺失或无同名模板可比对时报不适用而非缺口，退出非错。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./text.js");

const ID = "C35";
// 实例落点与模板落点：两者同名比对；实例目录为点开头，故不属 ref-check 活文档扫描面
const INSTANCE_DIR_REL = [".pi", "agents"];
const TEMPLATE_DIR_REL = ["skills", "ddd-methodology", "assets", "agent-templates"];
// 代理定义文件名形态：kebab-case 且前缀 ddd-，与固定代理同名规约一致
const AGENT_FILE_RE = /^ddd-[a-z][a-z0-9-]*\.md$/;
// 契约标记：以固定哨兵开头的 HTML 注释承载，闭于其后首个 -->；哨兵行与注释内说明行不含键，故不影响解析
const MARKER_OPEN_RE = /<!--\s*C35-CONTRACT\b/;
// 标记键：只认四键，其余行一律忽略，使标记可自由加注而不改判定
const MARKER_KEY_RE = /^\s*(role|tools|sections|headings)\s*:\s*(.+?)\s*$/;
// 标记缺任一键时的全量缺项表，供哨兵缺失与注释未闭合两条路径复用
const MARKER_KEYS = ["role", "tools", "sections", "headings"];
// 一级标题：行首单个 # 加空白；标记是 HTML 注释，天然不计入
const H1_RE = /^#\s+\S/;
// 只读权限的工具集违禁项：出现写权限即意味着可自审自改，只读声明不成立
const WRITE_TOOLS = ["write", "edit"];

// 不适用备注：统一前缀，供无实例、实例无同名模板、模板无对应实例三处逐项输出，保持不产漂移
function note(message) {
  process.stdout.write(`[C35 不适用] ${message}\n`);
}

// 目录内代理定义文件名，按字典序稳定输出；目录缺失或不可读回空数组
function agentFilesIn(dir) {
  let names; try { names = fs.readdirSync(dir); } catch (e) { return []; }
  return names.filter((name) => AGENT_FILE_RE.test(name)).sort();
}

// 一级标题数：只数 # 一级，对应标记的 headings 声明值
function headingCount(text) {
  return withLineNumbers(text).filter((row) => H1_RE.test(row.line)).length;
}

// frontmatter 块行：取首行三横线与次个三横线之间的行；头部非标准则回空，键取值只在块内进行，正文同形行不得误判
function frontmatterRows(text) {
  const rows = withLineNumbers(text);
  if (!rows.length || rows[0].line.trim() !== "---") return [];
  for (let k = 1; k < rows.length; k++) {
    if (rows[k].line.trim() === "---") return rows.slice(1, k);
  }
  return [];
}

// 只读权限的正文实际值面：frontmatter 块内的 acceptanceRole 与 tools 及其行号；
//   标记声明的 role 与 tools 由本值互校，防标记写假声明
function frontmatterReadonly(text) {
  const rows = frontmatterRows(text);
  const pick = (key) => {
    const row = rows.find((r) => new RegExp(`^\\s*${key}\\s*:`).test(r.line));
    const m = row ? row.line.match(/^\s*[A-Za-z]+\s*:\s*(.*?)\s*$/) : null;
    return { value: m ? m[1] : null, line: row ? row.no : 1 };
  };
  const role = pick("acceptanceRole");
  const tools = pick("tools");
  return { role: role.value, tools: tools.value, lines: { role: role.line, tools: tools.line } };
}

// 读契约标记：定位哨兵与其后首个 -->，取 role、tools、sections、headings 四键及各自行号；
//   四键缺任一即 present 为假并回传缺项，供「缺标记」缺口指明缺哪一侧、缺哪几项
function readMarker(text) {
  const rows = withLineNumbers(text);
  const open = rows.findIndex((row) => MARKER_OPEN_RE.test(row.line));
  if (open < 0) return { present: false, missing: MARKER_KEYS.slice(), line: 1 };
  let close = -1;
  for (let j = open; j < rows.length; j++) { if (rows[j].line.includes("-->")) { close = j; break; } }
  if (close < 0) return { present: false, missing: MARKER_KEYS.slice(), line: rows[open].no };
  const marker = { present: false, missing: [], line: rows[open].no, role: null, tools: null, sections: [], headings: null, lines: { role: rows[open].no, tools: rows[open].no, sections: rows[open].no, headings: rows[open].no } };
  for (let j = open + 1; j < close; j++) {
    const m = rows[j].line.match(MARKER_KEY_RE);
    if (!m) continue;
    marker.lines[m[1]] = rows[j].no;
    if (m[1] === "role") marker.role = m[2];
    else if (m[1] === "tools") marker.tools = m[2];
    else if (m[1] === "sections") marker.sections = m[2].split("、").map((s) => s.trim()).filter(Boolean);
    else marker.headings = /^\d+$/.test(m[2]) ? Number(m[2]) : null;
  }
  if (!marker.role) marker.missing.push("role");
  if (!marker.tools) marker.missing.push("tools");
  if (!marker.sections.length) marker.missing.push("sections");
  if (marker.headings === null) marker.missing.push("headings");
  marker.present = marker.missing.length === 0;
  return marker;
}

// 缺口一：任一侧缺标记即报，并指明缺哪一侧与缺哪几项，不得静默通过
function checkMarkerPresence(rel, side, marker) {
  if (marker.present) return [];
  return [drift(ID, rel, marker.line, "项目级代理定义头部须含 C35 契约标记，缺标记即报缺口并指明缺哪一侧", "头部含 C35-CONTRACT 注释与 role、tools、sections、headings 四键", `${side}侧缺标记，缺：${marker.missing.join("、")}`)];
}

// 缺口二：标记声明的只读权限须与 frontmatter 一致，否则标记即为假声明，其比对不成立
function checkMarkerTruth(rel, marker, fm) {
  const out = [];
  if (marker.role !== fm.role) out.push(drift(ID, rel, fm.lines.role, "标记声明的只读权限须与 frontmatter 的 acceptanceRole 一致，不得为通过校验写假声明", `acceptanceRole: ${marker.role}`, `frontmatter acceptanceRole: ${fm.role}`));
  if (marker.tools !== fm.tools) out.push(drift(ID, rel, fm.lines.tools, "标记声明的工具集须与 frontmatter 的 tools 一致，不得为通过校验写假声明", `tools: ${marker.tools}`, `frontmatter tools: ${fm.tools}`));
  return out;
}

// 缺口三：只读权限——两侧工具集含 write 或 edit 即报，含写权限即意味着可自审自改，只读声明不成立
function checkReadonlyTools(rel, side, tools, line) {
  const forbidden = String(tools || "").split(",").map((s) => s.trim()).filter((t) => WRITE_TOOLS.includes(t));
  if (!forbidden.length) return [];
  return [drift(ID, rel, line, "只读权限的判据面含工具集，含 write 或 edit 即报缺陷", "工具集不含 write 与 edit", `${side}侧工具集含写权限：${forbidden.join("、")}`)];
}

// 缺口四：只读权限主体——实例标记的 role 须与模板一致，防项目自我放松为可写而自审自改
function checkRole(rel, template, instance) {
  if (template.role === instance.role) return [];
  return [drift(ID, rel, instance.lines.role, "项目级代理实例的只读权限须与模板一致，只读权限属不可迭代面", `标记 role: ${template.role}`, `实例标记 role: ${instance.role}`)];
}

// 缺口五：只读权限工具集——实例标记的 tools 须与模板一致，工具集属只读权限判据面
function checkTools(rel, template, instance) {
  if (template.tools === instance.tools) return [];
  return [drift(ID, rel, instance.lines.tools, "项目级代理实例的工具集须与模板一致，只读权限的判据面含工具集，属不可迭代面", `标记 tools: ${template.tools}`, `实例标记 tools: ${instance.tools}`)];
}

// 缺口六：报告必备章节——实例标记的 sections 须与模板逐项一致，缺项、增项或改序即报，并指明首个差异位置
function checkSections(rel, template, instance) {
  const t = template.sections;
  const i = instance.sections;
  if (t.length === i.length && t.every((name, k) => name === i[k])) return [];
  let at = 0;
  while (at < t.length && at < i.length && t[at] === i[at]) at++;
  return [drift(ID, rel, instance.lines.sections, "标记声明的报告必备章节须与模板逐项一致，报告必备章节属不可迭代面", `与模板一致（${t.length} 项：${t.join("、")}）`, `实例 ${i.length} 项，第 ${at + 1} 处起不符：${i.slice(at).join("、")}`)];
}

// 缺口七：标记声明的文件一级标题总数须与文件实际相符，使模板改写章节而漏改标记得以被发现
function checkHeadings(rel, marker, actual) {
  if (marker.headings === actual) return [];
  return [drift(ID, rel, marker.lines.headings, "标记声明的文件一级标题总数须与文件实际相符，防模板改写章节后标记未同步", `文件实际一级标题 ${actual} 个`, `标记声明 headings: ${marker.headings}`)];
}

// C35 判据入口：仅比对存在同名模板的项目级实例；无可比对对象时报不适用，不产漂移
function checkAgentInstances(ctx) {
  const { root, relPath } = ctx;
  const instanceDir = path.join(root, ...INSTANCE_DIR_REL);
  const templateDir = path.join(root, ...TEMPLATE_DIR_REL);
  const instances = agentFilesIn(instanceDir);
  if (!instances.length) {
    note(`${INSTANCE_DIR_REL.join("/")} 下无项目级代理实例，本校验不适用，不计入漂移`);
    return [];
  }
  const found = [];
  const compared = new Set();
  for (const name of instances) {
    const templatePath = path.join(templateDir, name);
    const instancePath = path.join(instanceDir, name);
    const iRel = relPath(instancePath);
    if (!fs.existsSync(templatePath)) {
      note(`实例 ${iRel} 无同名模板可比对，本项不适用，不计入漂移`);
      continue;
    }
    compared.add(name);
    const tText = readFileText(templatePath);
    const iText = readFileText(instancePath);
    const tRel = relPath(templatePath);
    const t = readMarker(tText);
    const i = readMarker(iText);
    // 缺标记只报缺标记一处；标记不完整时其后的互校无意义，故各缺口只在对应标记齐备时执行，避免噪声掩盖主因
    found.push(...checkMarkerPresence(tRel, "模板", t), ...checkMarkerPresence(iRel, "实例", i));
    if (t.present) {
      const tFm = frontmatterReadonly(tText);
      found.push(...checkHeadings(tRel, t, headingCount(tText)), ...checkMarkerTruth(tRel, t, tFm), ...checkReadonlyTools(tRel, "模板", t.tools, t.lines.tools));
    }
    if (i.present) {
      const iFm = frontmatterReadonly(iText);
      found.push(...checkHeadings(iRel, i, headingCount(iText)), ...checkMarkerTruth(iRel, i, iFm), ...checkReadonlyTools(iRel, "实例", i.tools, i.lines.tools));
    }
    if (t.present && i.present) found.push(...checkRole(iRel, t, i), ...checkTools(iRel, t, i), ...checkSections(iRel, t, i));
  }
  // 模板无对应实例：逐项输出不适用备注，保持不产漂移
  for (const name of agentFilesIn(templateDir)) {
    if (compared.has(name)) continue;
    note(`模板 ${relPath(path.join(templateDir, name))} 无对应实例，本项不适用，不计入漂移`);
  }
  if (!compared.size) {
    note("项目级代理实例无同名模板可比对，本校验不适用，不计入漂移");
    return [];
  }
  return found;
}

// 注册表契约：id、简名与所属域随本模块声明；run 只转接本模块判据，装配处不掌握判据内容
module.exports = {
  contracts: [{ id: ID, name: "项目级代理不可迭代面一致", domain: "agent", run: (ctx) => checkAgentInstances(ctx) }],
};
