#!/usr/bin/env node
/**
 * 交叉检查 check-file-design（前驱 detail-design）。
 *
 * 目标：在文件级设计交出后立即机械校对文件级清单与目录级契约的两类问题，使覆盖判据达标、文件级对外接口与目录级契约一致、
 *   被依赖清单闭合在同一次执行内被拦截。
 * 范围：三项检查——有对外导出的文件有对应文件级设计、文件级对外接口清单与目录级契约一致、被依赖清单闭合；
 *   检查项定义在 skills/ddd-methodology/assets/check-items.json 的 check-file-design 节点下，本脚本只落机械实现。
 * 不包含：目录级同构（check-design）、实现与测试（check-code）。不引入第三方依赖。
 * 不适用：本仓库为方法论自身、或无设计树时无判定对象，报不适用而非缺口，退出码零。
 * 输出形态：文本正文；末行机读结论 `RESULT: pass` 或 `RESULT: gap`。退出码：0 通过或不适用，1 存在缺口。
 * 依据：DESIGN-crosscheck.md 第二、三、四节；DESIGN-designtree.md 第三节。
 */

const fs = require("fs");
const path = require("path");
const { readFileText } = require("./lib/text.js");
const { runCrossCheck, finding, designDir, designDocs, sourceFiles } = require("./lib/cross-check.js");
const { sectionBody, readTable } = require("./lib/span-compare.js");

const root = process.argv[2] || process.cwd();
// 导出标记的宽口径：多语言导出形态，命中任一即视为有对外导出
const EXPORT_RE = /(?:^|\n)\s*(?:export\s|module\.exports|exports\.|public\s|def\s|class\s|function\s+[A-Za-z_$])/m;

const relOf = (abs) => path.relative(root, abs).split(path.sep).join("/");
// 源文件到文件级设计路径：设计树镜像代码根，文件级名由源文件基名派生且不带扩展名
function fileDesignPath(abs) {
  const rel = relOf(abs);
  const dir = path.dirname(rel) === "." ? "" : path.dirname(rel);
  const base = path.basename(rel, path.extname(rel));
  return path.join(designDir(root).dir, dir, `DESIGN-${base}.md`);
}
// 反引号标识符枚举：自给定节取反引号内标识符，作符号清单
function sectionSymbols(abs, title) {
  const section = sectionBody(readFileText(abs), title);
  if (section === null) return null;
  const symbols = new Set();
  for (const m of section.matchAll(/`([^`\n]+)`/g)) symbols.add(m[0]);
  return symbols;
}

const checks = {
  // 落点完备：有对外导出的源文件须有对应文件级设计，判据同覆盖两条
  "file-design-coverage": () => {
    const found = [];
    const docs = new Set(designDocs(root).map((d) => d.abs));
    for (const abs of sourceFiles(root)) {
      if (!EXPORT_RE.test(readFileText(abs))) continue;
      const design = fileDesignPath(abs);
      if (!docs.has(design) && !fs.existsSync(design)) found.push(finding("file-design-coverage", "落点完备", relOf(abs), `有对外导出的文件有文件级设计 ${relOf(design)}`, "未找到"));
    }
    return found;
  },
  // 引用可解析：文件级对外接口清单的符号须属目录级契约接口名集合
  "file-design-contract": () => {
    const found = [];
    const dirContracts = new Map();
    for (const doc of designDocs(root)) {
      if (doc.base !== "DESIGN") continue;
      const table = readTable(sectionBody(readFileText(doc.abs), "对外接口与约定") || readFileText(doc.abs), /接口名|接口/);
      if (table) dirContracts.set(doc.dirRel, new Set(table.rows.map((row) => (row[0] || "").replace(/`/g, "").trim())));
    }
    for (const doc of designDocs(root)) {
      if (!doc.base.startsWith("DESIGN-")) continue;
      const symbols = sectionSymbols(doc.abs, "对外接口清单");
      if (!symbols) continue;
      const contract = dirContracts.get(doc.dirRel);
      if (!contract) continue;
      for (const symbol of symbols) {
        const name = symbol.replace(/`/g, "").split(/[(<:：\s]/)[0].trim();
        if (name && !contract.has(name)) found.push(finding("file-design-contract", "引用可解析", doc.rel, `对外接口 ${name} 属目录级契约接口名集合`, "目录级契约未声明"));
      }
    }
    return found;
  },
  // 集合同一：被依赖清单引用的文件须存在且有对应文件级设计
  "file-design-deps-closed": () => {
    const found = [];
    const docs = new Set(designDocs(root).map((d) => d.abs));
    for (const doc of designDocs(root)) {
      if (!doc.base.startsWith("DESIGN-")) continue;
      const section = sectionBody(readFileText(doc.abs), "被依赖清单");
      if (!section) continue;
      // 被依赖文件相对代码目录定位：设计目录镜像代码根，设计文档所在目录的相对路径即代码目录
      const codeDir = path.join(root, doc.dirRel === "." ? "" : doc.dirRel);
      for (const m of section.matchAll(/`([^`\n]+?\.(?:[a-z]{1,4}))`/g)) {
        const target = path.join(codeDir, m[1]);
        if (!fs.existsSync(target)) found.push(finding("file-design-deps-closed", "集合同一", doc.rel, `被依赖文件 ${m[1]} 存在`, "未找到"));
        else if (!docs.has(fileDesignPath(target))) found.push(finding("file-design-deps-closed", "集合同一", doc.rel, `被依赖文件 ${m[1]} 有文件级设计`, "未建设计"));
      }
    }
    return found;
  },
};

process.exit(runCrossCheck({ nodeKey: "check-file-design", title: "检查集：文件级清单与目录级契约一致、被依赖清单闭合、覆盖判据达标", root, checks }));
