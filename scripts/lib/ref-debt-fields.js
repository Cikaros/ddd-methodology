/**
 * 目标：把 ref-check 中「债务登记簿字段清单」这一域的校验外置为单一模块，检出规范表、模板表与 debt-check 常量三处的字段集合漂移。
 * 范围：C14 登记簿字段集合一致性——顶层字段集合、条目字段集合与根因分类集合三方互比，规范 12.1 为源，模板与脚本常量为受控副本。
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
const TMPL_ROOT_MARK = "根因分类五类：";

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
  return drift("C14", rel, line, criterion, `与规范 12.1 一致：${sorted(sourceSet)}`, sorted(copySet));
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
    };
  }

  // 模板副本：顶层字段表、条目字段表与根因分类
  function readTemplateFields() {
    const rows = templateRows();
    const topRow = rows.find((r) => r.line.includes(TMPL_TOP_MARK));
    const entryRow = rows.find((r) => r.line.includes(TMPL_ENTRY_MARK));
    const rootRow = rows.find((r) => r.line.includes(TMPL_ROOT_MARK));
    return {
      top: topRow ? tableFirstColumn(rows, rows.indexOf(topRow) + 1) : null,
      topLine: topRow ? topRow.no : 0,
      entry: entryRow ? tableFirstColumn(rows, rows.indexOf(entryRow) + 1) : null,
      entryLine: entryRow ? entryRow.no : 0,
      root: rootRow ? commaSeparatedTail(rootRow.line, TMPL_ROOT_MARK) : null,
      rootLine: rootRow ? rootRow.no : 0,
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
      found.push(drift("C14", SPEC_REL, spec.topLine || 0, "规范 12.1 须给出顶层字段说明、条目字段表与根因分类", "三处均可解析", "解析不全"));
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

    if (sorted(specTop) !== sorted(tmplTop)) found.push(setDrift(TEMPLATE_REL, tmpl.topLine, "模板顶层字段表须与规范 12.1 顶层字段说明同集", specTop, tmplTop));
    if (sorted(specTop) !== sorted(scriptTop)) found.push(setDrift(SCRIPT_REL, 0, "debt-check 顶层字段须与规范 12.1 顶层字段说明同集", specTop, scriptTop));
    if (sorted(specEntry) !== sorted(tmplEntry)) found.push(setDrift(TEMPLATE_REL, tmpl.entryLine, "模板条目字段表须与规范 12.1 条目字段表同集", specEntry, tmplEntry));
    if (sorted(specEntry) !== sorted(scriptEntry)) found.push(setDrift(SCRIPT_REL, 0, "debt-check 条目字段须与规范 12.1 条目字段表同集", specEntry, scriptEntry));
    if (sorted(specRoot) !== sorted(tmplRoot)) found.push(setDrift(TEMPLATE_REL, tmpl.rootLine, "模板根因分类须与规范 12.1 同集", specRoot, tmplRoot));
    if (sorted(specRoot) !== sorted(scriptRoot)) found.push(setDrift(SCRIPT_REL, 0, "debt-check 根因分类常量须与规范 12.1 同集", specRoot, scriptRoot));
    return found;
  }

  return { checkDebtFieldSets };
}

module.exports = { createDebtFieldChecks };
