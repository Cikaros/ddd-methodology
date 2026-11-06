/**
 * 目标：把 ref-check 的规范读取面收敛为单一模块——枚举 references 下的 spec*.md，构建节标题的跨文件索引，并按去编号标题定位节。
 * 范围：路径归一、节标题去编号、取指定标题的全部节、规范文件枚举、节标题唯一性索引、节缺失与节歧义的漂移项构造。
 * 不包含：活文档遍历与排除集、具体校验语义、命令行入口，均留在调用方。不引入第三方依赖。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./text.js");

const SPEC_DIR_REL = ["skills", "ddd-methodology", "references"];
const SPEC_FILE_RE = /^spec.*\.md$/;
const SPEC_INDEX_REL = SPEC_DIR_REL.concat("spec.md").join("/");

// 路径归一：相对仓库根，正斜杠分隔，供各校验项的定位列统一输出
function relPath(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

// 节标题去掉编号前缀后即为跨文档引用的键，编号只是排序标识
function trimHeadingNumber(title) {
  return String(title || "").replace(/^\d+(?:\.\d+)*[.、]?\s*/, "").trim();
}

// 去编号前缀：规范文件以阿拉伯数字编号，主技能等以中文数字编号；两种前缀剥去后共用同一节定位键，
// 故权威源移出规范文件集合后仍可按标题定位，不必各写一套解析
function stripHeadingNumber(title) {
  return String(title || "").replace(/^[〇零一二三四五六七八九十百千\d]+(?:[.、]\d+)*(?:[.、])?\s*/, "").trim();
}

// 任意文本内的节定位：首个命中去编号标题的二级或三级节，回传节正文及其在文内的行号；未命中回 null。
// 供权威源不在规范文件集合时（主技能与治理技能）复用同一节边界解析
function sectionInText(text, title) {
  const rows = withLineNumbers(text);
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i].line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!m || stripHeadingNumber(m[2]) !== title) continue;
    const level = m[1].length;
    let end = rows.length;
    for (let j = i + 1; j < rows.length; j++) {
      const next = rows[j].line.match(/^(#{2,3})\s+/);
      if (next && next[1].length <= level) { end = j; break; }
    }
    return { body: rows.slice(i + 1, end).map((r) => r.line).join("\n"), line: rows[i].no };
  }
  return null;
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

// 读取器工厂：规范读取面在单次运行内是不变的逻辑文本集合，故一次性枚举并建索引后回传，避免各校验项各自遍历
function createSpecReader(root) {
  const dir = path.join(root, ...SPEC_DIR_REL);
  let names = []; try { names = fs.readdirSync(dir); } catch (e) { names = []; }
  const docs = names.filter((name) => SPEC_FILE_RE.test(name)).map((name) => ({ rel: relPath(root, path.join(dir, name)), text: readFileText(path.join(dir, name)) }));
  // 节标题的跨文件索引：既作语义化引用的键集合，又作唯一性判据的位置来源
  const headingSources = new Map();
  for (const doc of docs) {
    for (const row of withLineNumbers(doc.text)) {
      const m = row.line.match(/^(#{2,3})\s+(.+?)\s*$/);
      if (!m) continue;
      const title = trimHeadingNumber(m[2]);
      headingSources.set(title, (headingSources.get(title) || []).concat({ rel: doc.rel, line: row.no }));
    }
  }
  const headingSet = new Set(headingSources.keys());
  // 跨文件节查找：命中多于一处时回传歧义标记，不得静默取首个
  const findSection = (title) => {
    const hits = [];
    for (const doc of docs) for (const s of sectionsWithTitle(doc.text, title)) hits.push({ body: s.body, line: s.line, rel: doc.rel });
    return hits.length === 0 ? null : hits.length === 1 ? hits[0] : { ambiguous: true, hits };
  };
  // 规范文件缺失时漂移项须指向具体文件，不得退化为目录名；目录名只留在 found 提示
  const firstRel = () => (docs.length ? docs[0].rel : SPEC_INDEX_REL);
  const missing = (item, criterion) => [drift(item, firstRel(), 0, criterion, "规范文件存在且可读", SPEC_DIR_REL.join("/"))];
  // 节标题命中多于一处即歧义：漂移项指首处，found 列全部命中位置供人工复核
  const sectionDrift = (item, title, hits) => drift(item, hits[0].rel, hits[0].line, `规范节标题「${title}」须跨文件唯一，定位不得歧义`, "唯一命中", hits.map((h) => `${h.rel}:${h.line}`).join("、"));
  return { docs, headingSources, headingSet, findSection, firstRel, missing, sectionDrift };
}

module.exports = { createSpecReader, relPath, trimHeadingNumber, sectionInText, SPEC_INDEX_REL };
