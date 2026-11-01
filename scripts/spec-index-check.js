/**
 * 目标：把规范索引表与八份规范文件实际顶层标题的一致性外化为可复现的机械证据，供文档同步链在提交前校验。
 * 范围：解析 spec.md 索引表的节编号、节标题与所在文件三列，解析八份 spec*.md 的顶层二级标题的编号与标题，
 *   按所在文件作双向三列比对，任列不符即回传漂移项；只比顶层二级标题。
 * 不包含：三级及更深标题的比对（16.x、17.x 等子节不参与，避免误判为缺漏）、其他校验项、目录遍历与路径解析、命令行入口。
 * 调用形态：checkSpecIndex(root, specFileRels, indexRel)；root 为仓库根；规范文件清单与索引入口路径由调用方注入，
 *   本模块不再自定目录与匹配规则，避免与调用方形成同一事实两处定义；回传漂移项数组，字段与 ref-check 现有漂移项一致，
 *   含 item、file、line、criterion、expect、found。
 * 调用方：scripts/ref-check.js 的 C12 校验项，由其传入已枚举的规范文件相对路径集合与索引文件相对路径。
 * 依赖：文本读取、行号与漂移项构造取 ./lib/text.js 的 readFileText、withLineNumbers、drift，本模块不再内联重复实现。
 */

const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./lib/text.js");

// 节条目形态：编号加句点加空格加标题；索引表首格与规范二级标题共用该形态，故共用同一解析
// 命名为 INDEX_ENTRY_RE 而非 SECTION_RE，以避开与 trace-check.js 中语义不同的同名常量造成重复嫌疑噪音
const INDEX_ENTRY_RE = /^(\d+)\.\s+(.+)$/;

// 索引表行：竖线分隔，首格为「编号. 标题」、次格为所在文件；表头与分隔行不匹配 INDEX_ENTRY_RE 故自然跳过，首尾空白按格去除
function parseIndexRows(text) {
  const rows = [];
  for (const row of withLineNumbers(text)) {
    if (!row.line.trim().startsWith("|")) continue;
    const cells = row.line.split("|").slice(1, -1).map((cell) => cell.trim());
    const head = (cells[0] || "").match(INDEX_ENTRY_RE);
    if (!head) continue;
    rows.push({ number: head[1], title: head[2], file: cells[1] || "", line: row.no });
  }
  return rows;
}

// 顶层二级标题：恰好两个井号加空白；三级标题的第三个井号使该形态不成立，不参与比对
function parseTopHeadings(text) {
  const rows = [];
  for (const row of withLineNumbers(text)) {
    const m = row.line.match(/^\s*##\s+(.+?)\s*$/);
    if (!m) continue;
    const head = m[1].match(INDEX_ENTRY_RE);
    if (!head) continue;
    rows.push({ number: head[1], title: head[2], line: row.no });
  }
  return rows;
}

// 三列键：编号、标题、所在文件任一不同即为不同条目，使仅改标题或仅改文件都能被检出
function entryKey(row) {
  return `${row.number}\u0000${row.title}\u0000${row.file}`;
}
// 同编号实际条目的描述：索引侧或实际侧不符时回传对照项，无同编号者明示
function describeSiblings(list) {
  return list.length ? list.map((r) => `「${r.number}. ${r.title}」于 ${r.file}`).join("、") : "无同编号条目";
}

// C12 规范索引表一致性：索引表与八份规范二级标题的编号、标题、所在文件三列双向比对，任一列不符即漂移
function checkSpecIndex(root, specFileRels, indexRel) {
  const indexRows = parseIndexRows(readFileText(path.join(root, indexRel)));
  if (!indexRows.length) return [drift("C12", indexRel, 0, "规范索引入口须含形如「编号. 标题 | 文件」的索引表条目", "至少一条索引行")];
  // 规范文件清单由调用方注入，按文件名排序以固定 actual 的产出顺序；无文件时以索引目录名作漂移项指向
  const specFiles = specFileRels
    .map((rel) => ({ rel, name: path.basename(rel) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (!specFiles.length) return [drift("C12", path.posix.dirname(indexRel), 0, "规范目录须含 spec 文件", "八份 spec*.md")];

  const actual = [];
  for (const { rel, name } of specFiles) {
    for (const head of parseTopHeadings(readFileText(path.join(root, rel)))) {
      actual.push({ number: head.number, title: head.title, file: name, line: head.line, rel });
    }
  }
  const indexKeys = new Set(indexRows.map(entryKey));
  const actualKeys = new Set(actual.map(entryKey));
  const byNumber = (list) => list.reduce((map, row) => map.set(row.number, (map.get(row.number) || []).concat(row)), new Map());
  const indexByNumber = byNumber(indexRows);
  const actualByNumber = byNumber(actual);

  const found = [];
  for (const row of indexRows) {
    if (actualKeys.has(entryKey(row))) continue;
    found.push(drift("C12", indexRel, row.line, "索引表条目须命中规范二级标题，编号、标题与所在文件三列一致", `规范含「${row.number}. ${row.title}」且所在文件为 ${row.file}`, describeSiblings(actualByNumber.get(row.number) || [])));
  }
  for (const row of actual) {
    if (indexKeys.has(entryKey(row))) continue;
    found.push(drift("C12", row.rel, row.line, "规范二级标题须在索引表登记，编号、标题与所在文件三列一致", `索引表含「${row.number}. ${row.title}」且所在文件为 ${row.file}`, describeSiblings(indexByNumber.get(row.number) || [])));
  }
  return found;
}

module.exports = { checkSpecIndex };
