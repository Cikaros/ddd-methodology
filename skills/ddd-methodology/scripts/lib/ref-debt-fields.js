/**
 * 目标：把 ref-check 中「债务登记簿字段清单」这一域的校验外置为单一模块，检出债务模板与 debt-check 常量两处的字段集合漂移。
 * 范围：C14 登记簿字段集合一致性——顶层字段集合、条目字段集合与根因分类集合两方互比，债务模板 `templates-debts.md` 的
 *   「字段说明」节为源（字段权威在本文件），debt-check 常量为受控副本；另比根因字段表行的类别数声明与根因集合大小，集合扩员而单元格漏改即报。
 * 不包含：引用形态（见 ref-refs.js）、常量集合（见 ref-constants.js）、冻结短语（见 ref-phrases.js）、阶段键（见 ref-stages.js）、
 *   规范读取面（见 spec-doc.js）、命令行入口。不引入第三方依赖。
 */

const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./text.js");

// 字段权威在债务模板的字段说明节；debt-check 常量为受控副本，两者互比
const TEMPLATE_REL = "skills/ddd-methodology/references/templates-debts.md";
const SCRIPT_REL = "skills/ddd-methodology/scripts/debt-check.js";

// 模板字段表定位标记：顶层字段表、条目字段表与根因分类各用同义句承载，标记随文本维护
const TMPL_TOP_MARK = "顶层字段：";
const TMPL_ENTRY_MARK = "条目字段（";
const TMPL_ROOT_MARK = "根因分类";
// 类别数声明的中文数字映射：字段表行形如「取六类之一」，其数字须与根因集合大小一致
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
// 声明数：取形如「取N类之一」的 N，无此声明时回 null，由调用方报漂移
function declaredClassCount(text) {
  const m = String(text).match(/取([零一二三四五六七八九十\d]+)类之一/);
  if (!m) return null;
  const token = m[1];
  return CN_NUM[token] !== undefined ? CN_NUM[token] : (/^\d+$/.test(token) ? Number(token) : null);
}

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

// 两集合不等的漂移项：expect 列权威源集合，found 列副本集合，供人工定位差项
function setDrift(rel, line, criterion, sourceSet, copySet) {
  return drift("C14", rel, line, criterion, `与债务模板字段说明节一致：${sorted(sourceSet)}`, sorted(copySet));
}

function createDebtFieldChecks(env) {
  const { root } = env;
  const templateRows = () => withLineNumbers(readFileText(path.join(root, ...TEMPLATE_REL.split("/"))));
  const readScript = () => readFileText(path.join(root, ...SCRIPT_REL.split("/")));

  // 权威源：债务模板字段说明节的顶层字段表、条目字段表与根因分类
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
    const tmpl = readTemplateFields();
    const script = readScriptFields();

    if (!tmpl.top || !tmpl.entry || !tmpl.root) {
      found.push(drift("C14", TEMPLATE_REL, tmpl.topLine || 0, "债务模板字段说明节须给出顶层字段表、条目字段表与根因分类", "三处均可解析", "解析不全"));
      return found;
    }
    if (!script.top || !script.entry || !script.root) {
      found.push(drift("C14", SCRIPT_REL, 0, "debt-check 须给出顶层字段、条目字段与根因分类常量", "三处均可解析", "解析不全"));
      return found;
    }

    const tmplTop = new Set(tmpl.top);
    const tmplEntry = new Set(tmpl.entry);
    const tmplRoot = new Set(tmpl.root);
    const scriptTop = new Set(script.top);
    const scriptEntry = new Set(script.entry);
    const scriptRoot = new Set(script.root);

    if (sorted(tmplTop) !== sorted(scriptTop)) found.push(setDrift(SCRIPT_REL, 0, "debt-check 顶层字段须与债务模板字段说明节顶层字段表同集", tmplTop, scriptTop));
    if (sorted(tmplEntry) !== sorted(scriptEntry)) found.push(setDrift(SCRIPT_REL, 0, "debt-check 条目字段须与债务模板字段说明节条目字段表同集", tmplEntry, scriptEntry));
    if (sorted(tmplRoot) !== sorted(scriptRoot)) found.push(setDrift(SCRIPT_REL, 0, "debt-check 根因分类常量须与债务模板字段说明节根因分类同集", tmplRoot, scriptRoot));
    // 类别数声明：字段表行的「取N类之一」须与根因集合大小一致，集合扩员而单元格漏改即报，塔住先前只比单元格外的集合而漏声明数字的盲区
    if (tmpl.rootDeclared !== tmplRoot.size) found.push(drift("C14", TEMPLATE_REL, tmpl.rootCell ? tmpl.rootCell.no : tmpl.rootLine, "根因分类的类别数声明须与集合大小一致", `声明 ${tmplRoot.size} 类`, tmpl.rootDeclared === null ? "未检出声明" : `声明 ${tmpl.rootDeclared} 类`));
    return found;
  }

  return { checkDebtFieldSets };
}

module.exports = { createDebtFieldChecks };
