/**
 * 目标：把 ref-check 中「债务登记簿字段清单」这一域的校验外置为单一模块，检出规范表、模板表与 debt-check 常量三处的字段集合漂移。
 * 范围：C14 登记簿字段集合一致性——顶层字段集合、条目字段集合与根因分类集合三方互比，规范「存量债务的登记与清偿」节为源，模板与脚本常量为受控副本；
 *   另比根因字段表行的类别数声明与根因集合大小，集合扩员而单元格漏改即报。
 * 不包含：引用形态（见 ref-refs.js）、常量集合（见 ref-constants.js）、冻结短语（见 ref-phrases.js）、阶段键（见 ref-stages.js）、
 *   规范读取面（见 spec-doc.js）、命令行入口。不引入第三方依赖。
 */

const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./text.js");

const SPEC_REL = "skill/ddd-methodology/references/spec-declare.md";
const TEMPLATE_REL = "skill/ddd-methodology/references/templates-debts.md";
const SCRIPT_REL = "scripts/debt-check.js";

// 顶层字段说明与条目字段表的定位标记：规范与模板各用同义句承载，标记随文本维护
const SPEC_TOP_MARK = "顶层三字段固定";
const SPEC_TOP_END = "其元素字段固定";
const SPEC_ENTRY_MARK = "其元素字段固定如下";
const SPEC_ROOT_MARK = "之一：";
const TMPL_TOP_MARK = "顶层字段：";
const TMPL_ENTRY_MARK = "条目字段（";
// 类别数声明的中文数字映射：字段表行形如「取六类之一」，其数字须与根因集合大小一致
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
// 声明数：取形如「取N类之一」的 N，无此声明时回 null，由调用方报漂移
function declaredClassCount(text) {
  const m = String(text).match(/取([零一二三四五六七八九十\d]+)类之一/);
  if (!m) return null;
  const token = m[1];
  return CN_NUM[token] !== undefined ? CN_NUM[token] : (/^\d+$/.test(token) ? Number(token) : null);
}
const TMPL_ROOT_MARK = "根因分类";

// 模板根因分类行的定位：取以「根因分类」起首且非表格行的行，不绑定类别数，扩类时不需改本模块（标记随文本维护）
function templateRootRow(rows) {
  return rows.find((r) => r.line.trim().startsWith(TMPL_ROOT_MARK) && !r.line.trim().startsWith("|"));
}

// 首列取值：自起始行起，跳过表头与分隔行，取连续表格行的首个单元格，去反引号与空白
function tableFirstColumn(rows, startIndex) {
  const cells = [];
  let started = false;
  for (let i = startIndex; i < rows.length; i++) {
    const line = rows[i].line.trim();
    if (!line.startsWith("|")) {
      if (started) break;
      continue;
    }
    if (!started) { started = true; continue; }
    const cell = line.split("|")[1].replace(/`/g, "").trim();
    if (!cell || /^[-:]+$/.test(cell)) continue;
    cells.push(cell);
  }
  return cells;
}

// 反引号内的标识符：用于顶层字段说明的散文枚举
function backtickTokens(text) {
  return [...String(text).matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
}

// 顿号分隔的分类枚举：去掉行尾管道与句号后按顿号切分
function commaSeparatedTail(text, marker) {
  const tail = String(text).slice(String(text).indexOf(marker) + marker.length);
  return tail.replace(/[|。\s]+$/, "").split("、").map((s) => s.trim()).filter(Boolean);
}

// 数组字面量的字符串元素：用于 debt-check 的常量清单
function arrayLiteral(text, name) {
  const m = text.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  return m ? [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]) : null;
}

// 字符串常量：用于 debt-check 的条目数组字段名
function stringLiteral(text, name) {
  const m = text.match(new RegExp(`const\\s+${name}\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : null;
}

const sorted = (set) => [...set].sort().join("、");

// 两集合不等的漂移项：expect 列规范源集合，found 列副本集合，供人工定位差项
function setDrift(rel, line, criterion, sourceSet, copySet) {
  return drift("C14", rel, line, criterion, `与规范「存量债务的登记与清偿」节一致：${sorted(sourceSet)}`, sorted(copySet));
}

function createDebtFieldChecks(env) {
  const { root, relPath } = env;
  const specRows = () => withLineNumbers(readFileText(path.join(root, ...SPEC_REL.split("/"))));
  const templateRows = () => withLineNumbers(readFileText(path.join(root, ...TEMPLATE_REL.split("/"))));
  const readScript = () => readFileText(path.join(root, ...SCRIPT_REL.split("/")));

  // 规范源：顶层字段说明、条目字段表与根因分类
  function readSpecFields() {
    const rows = specRows();
    const topRow = rows.find((r) => r.line.includes(SPEC_TOP_MARK));
    const entryRow = rows.find((r) => r.line.includes(SPEC_ENTRY_MARK));
    const rootRow = rows.find((r) => r.line.includes(SPEC_ROOT_MARK) && r.line.includes("根因分类"));
    return {
      top: topRow ? backtickTokens(topRow.line.slice(topRow.line.indexOf(SPEC_TOP_MARK)).split(SPEC_TOP_END)[0]) : null,
      topLine: topRow ? topRow.no : 0,
      entry: entryRow ? tableFirstColumn(rows, rows.indexOf(entryRow) + 1) : null,
      entryLine: entryRow ? entryRow.no : 0,
      root: rootRow ? commaSeparatedTail(rootRow.line, SPEC_ROOT_MARK) : null,
      rootLine: rootRow ? rootRow.no : 0,
      rootDeclared: rootRow ? declaredClassCount(rootRow.line) : null,
    };
  }

  // 模板副本：顶层字段表、条目字段表与根因分类
  function readTemplateFields() {
    const rows = templateRows();
    const topRow = rows.find((r) => r.line.includes(TMPL_TOP_MARK));
    const entryRow = rows.find((r) => r.line.includes(TMPL_ENTRY_MARK));
    const rootRow = templateRootRow(rows);
    // 字段表单元格行与段落行分列：类别数声明在单元格行，集合在段落行，两者同为 C14 比对源
    const rootCell = rows.find((r) => /^\|\s*rootCause\b/.test(r.line.trim())) || null;
    return {
      top: topRow ? tableFirstColumn(rows, rows.indexOf(topRow) + 1) : null,
      topLine: topRow ? topRow.no : 0,
      entry: entryRow ? tableFirstColumn(rows, rows.indexOf(entryRow) + 1) : null,
      entryLine: entryRow ? entryRow.no : 0,
      root: rootRow ? commaSeparatedTail(rootRow.line, TMPL_ROOT_MARK).map((s) => s.replace(/^[零一二三四五六七八九十百\d]+类[：:]\s*/, "")) : null,
      rootLine: rootRow ? rootRow.no : 0,
      rootDeclared: rootCell ? declaredClassCount(rootCell.line) : null,
      rootCell,
    };
  }

  // 脚本副本：必填顶层字段加条目数组字段为顶层集合，必填与可省条目字段合并为条目集合，根因分类为独立集合
  function readScriptFields() {
    const text = readScript();
    const requiredTop = arrayLiteral(text, "REQUIRED_TOP");
    const requiredEntry = arrayLiteral(text, "REQUIRED_ENTRY");
    const optionalEntry = arrayLiteral(text, "OPTIONAL_ENTRY");
    const rootCauses = arrayLiteral(text, "ROOT_CAUSES");
    const entryArrayField = stringLiteral(text, "ENTRY_ARRAY_FIELD");
    return {
      top: requiredTop && entryArrayField ? [...requiredTop, entryArrayField] : null,
      entry: requiredEntry && optionalEntry ? [...requiredEntry, ...optionalEntry] : null,
      root: rootCauses,
    };
  }

  function checkDebtFieldSets() {
    const found = [];
    const spec = readSpecFields();
    const tmpl = readTemplateFields();
    const script = readScriptFields();

    if (!spec.top || !spec.entry || !spec.root) {
      found.push(drift("C14", SPEC_REL, spec.topLine || 0, "规范「存量债务的登记与清偿」节须给出顶层字段说明、条目字段表与根因分类", "三处均可解析", "解析不全"));
      return found;
    }
    if (!tmpl.top || !tmpl.entry || !tmpl.root) {
      found.push(drift("C14", TEMPLATE_REL, tmpl.topLine || 0, "模板须给出顶层字段表、条目字段表与根因分类", "三处均可解析", "解析不全"));
      return found;
    }
    if (!script.top || !script.entry || !script.root) {
      found.push(drift("C14", SCRIPT_REL, 0, "debt-check 须给出顶层字段、条目字段与根因分类常量", "三处均可解析", "解析不全"));
      return found;
    }

    const specTop = new Set(spec.top);
    const specEntry = new Set(spec.entry);
    const specRoot = new Set(spec.root);
    const tmplTop = new Set(tmpl.top);
    const tmplEntry = new Set(tmpl.entry);
    const tmplRoot = new Set(tmpl.root);
    const scriptTop = new Set(script.top);
    const scriptEntry = new Set(script.entry);
    const scriptRoot = new Set(script.root);

    if (sorted(specTop) !== sorted(tmplTop)) found.push(setDrift(TEMPLATE_REL, tmpl.topLine, "模板顶层字段表须与规范「存量债务的登记与清偿」节顶层字段说明同集", specTop, tmplTop));
    if (sorted(specTop) !== sorted(scriptTop)) found.push(setDrift(SCRIPT_REL, 0, "debt-check 顶层字段须与规范「存量债务的登记与清偿」节顶层字段说明同集", specTop, scriptTop));
    if (sorted(specEntry) !== sorted(tmplEntry)) found.push(setDrift(TEMPLATE_REL, tmpl.entryLine, "模板条目字段表须与规范「存量债务的登记与清偿」节条目字段表同集", specEntry, tmplEntry));
    if (sorted(specEntry) !== sorted(scriptEntry)) found.push(setDrift(SCRIPT_REL, 0, "debt-check 条目字段须与规范「存量债务的登记与清偿」节条目字段表同集", specEntry, scriptEntry));
    if (sorted(specRoot) !== sorted(tmplRoot)) found.push(setDrift(TEMPLATE_REL, tmpl.rootLine, "模板根因分类须与规范「存量债务的登记与清偿」节同集", specRoot, tmplRoot));
    if (sorted(specRoot) !== sorted(scriptRoot)) found.push(setDrift(SCRIPT_REL, 0, "debt-check 根因分类常量须与规范「存量债务的登记与清偿」节同集", specRoot, scriptRoot));
    // 类别数声明：字段表行的「取N类之一」须与根因集合大小一致，集合扩员而单元格漏改即报，塔住先前只比单元格外的集合而漏声明数字的盲区
    for (const [rel, line, declared] of [[SPEC_REL, spec.rootLine, spec.rootDeclared], [TEMPLATE_REL, tmpl.rootCell ? tmpl.rootCell.no : tmpl.rootLine, tmpl.rootDeclared]]) {
      if (declared !== specRoot.size) found.push(drift("C14", rel, line, "根因分类的类别数声明须与集合大小一致", `声明 ${specRoot.size} 类`, declared === null ? "未检出声明" : `声明 ${declared} 类`));
    }
    return found;
  }

  return { checkDebtFieldSets };
}

module.exports = { createDebtFieldChecks };
