#!/usr/bin/env node
/**
 * 交叉检查 check-design（前驱 decomposer）。
 *
 * 目标：在分解设计交出后立即机械校对契约表与设计树两类问题，使设计树与代码目录逐层同构、契约表列头完整、
 *   义务编号唯一、契约与 AC 覆盖在同一次执行内被拦截。
 * 范围：五项检查——设计树逐层同构、契约表列头完整、义务编号唯一、契约表与 AC 覆盖、模块数声明相符；
 *   检查项定义在 skills/ddd-methodology/assets/check-items.json 的 check-design 节点下，本脚本只落机械实现。
 * 不包含：文件级清单与被依赖闭合（check-file-design）、实现与测试（check-code）。不引入第三方依赖。
 * 不适用：本仓库为方法论自身、或无设计树时无判定对象，报不适用而非缺口，退出码零。
 * 输出形态：文本局部；末行机读结论 `RESULT: pass` 或 `RESULT: gap`。退出码：0 通过或不适用，1 存在缺口。
 * 依据：DESIGN-crosscheck.md 第二、三、四节；DESIGN-designtree.md 第一、二、六节。
 */

const fs = require("fs");
const path = require("path");
const { readFileText } = require("./lib/text.js");
const { runCrossCheck, finding, designDir, designDocs, acIds } = require("./lib/cross-check.js");
const { sectionBody, readTable } = require("./lib/span-compare.js");

const root = process.argv[2] || process.cwd();
// 契约表列头的固定八列，被机械校验锚定不得改写，权威见 DESIGN-designtree.md 第二节
const CONTRACT_HEADERS = ["接口名", "签名", "参数", "返回", "错误语义", "时序依赖与副作用", "消费方模块", "调用示例"];

// ARCHITECTURE 声明的模块目录集合：自目录规划节的反引号路径取含斜杠者为模块目录候选
function declaredModuleDirs() {
  const text = readFileText(path.join(root, "ARCHITECTURE.md"));
  const section = sectionBody(text, "目录规划") || text;
  const dirs = new Set();
  for (const m of section.matchAll(/`([\w][\w./-]*)\/?`/g)) if (!/\.\w+$/.test(m[1])) dirs.add(m[1].replace(/\/$/, ""));
  return [...dirs];
}

// 契约表列头：取 DESIGN 文本中表头含「接口名」的表格的列头
function contractHeaders(text) {
  const table = readTable(sectionBody(text, "对外接口与约定") || text, /接口名|接口/);
  return table ? table.headers : null;
}

const checks = {
  // 集合同一：设计树目录与代码目录逐层同构，声明的模块目录须有 DESIGN.md，设计目录须有对应代码目录
  "design-tree-isomorphic": () => {
    const docs = designDocs(root);
    if (!docs.length) return [finding("design-tree-isomorphic", "集合同一", designDir(root).dir, "设计树下至少一份 DESIGN 文档", "零份")];
    const designDirRels = new Set(docs.map((d) => d.dirRel).filter((d) => d !== ""));
    const found = [];
    for (const rel of declaredModuleDirs()) {
      const key = rel.replace(/^\.\//, "");
      if (!designDirRels.has(key)) found.push(finding("design-tree-isomorphic", "集合同一", "ARCHITECTURE.md", `模块目录 ${rel} 有对应 DESIGN.md（${designDir(root).dir}/${rel}/DESIGN.md）`, "未建目录级设计"));
    }
    for (const rel of designDirRels) {
      if (!fs.existsSync(path.join(root, rel))) found.push(finding("design-tree-isomorphic", "集合同一", `${designDir(root).dir}/${rel}`, `代码目录 ${rel} 存在`, "未找到"));
    }
    return found;
  },
  // 引用可解析：每份目录级 DESIGN 的契约表列头须与固定八列逐字一致
  "design-contract-header": () => {
    const found = [];
    for (const doc of designDocs(root)) {
      if (doc.base !== "DESIGN") continue;
      const headers = contractHeaders(readFileText(doc.abs));
      if (!headers) { found.push(finding("design-contract-header", "引用可解析", doc.rel, "含「对外接口与约定」契约表", "未找到契约表")); continue; }
      const want = CONTRACT_HEADERS.join("、");
      const got = headers.map((h) => h.replace(/[`*\s]/g, "")).join("、");
      if (want !== got) found.push(finding("design-contract-header", "引用可解析", doc.rel, `契约表列头为 ${want}`, got));
    }
    return found;
  },
  // 集合同一：义务编号跨设计文档唯一，OB- 前缀条目不得重号
  "design-obligation-unique": () => {
    const seen = new Map();
    const found = [];
    for (const doc of designDocs(root)) {
      for (const m of readFileText(doc.abs).matchAll(/(?<![\w-])(OB-FILE-[^\s`，、。:：|]+|OB-\d+)(?![\w-])/g)) {
        const id = m[1];
        if (seen.has(id) && seen.get(id) !== doc.rel) found.push(finding("design-obligation-unique", "集合同一", doc.rel, `义务编号 ${id} 唯一`, `已于 ${seen.get(id)} 出现`));
        else seen.set(id, doc.rel);
      }
    }
    return found;
  },
  // 引用可解析：目录级 DESIGN 的模块级验收要点引用的 AC 须在 AC.md 中存在
  "design-contract-ac": () => {
    const known = acIds(root);
    if (!known.size) return [finding("design-contract-ac", "引用可解析", "AC.md", "AC.md 含 AC 编号条目", "未找到")];
    const found = [];
    for (const doc of designDocs(root)) {
      const section = sectionBody(readFileText(doc.abs), "模块级验收要点");
      if (section === null) continue;
      for (const m of section.matchAll(/\bAC-\d+\b/g)) {
        if (!known.has(m[0])) found.push(finding("design-contract-ac", "引用可解析", doc.rel, `模块级 AC ${m[0]} 在 AC.md 中存在`, "悬空引用"));
      }
    }
    return found;
  },
  // 计数相符：目录级 DESIGN 声称的模块数（若有声明）与设计树目录枚举数相符
  "design-counts": () => {
    const docs = designDocs(root);
    const dirCount = new Set(docs.map((d) => d.dirRel)).size;
    const found = [];
    for (const doc of docs) {
      if (doc.base !== "DESIGN") continue;
      for (const m of readFileText(doc.abs).matchAll(/共\s*(\d+)\s*个模块/g)) {
        if (Number(m[1]) !== dirCount) found.push(finding("design-counts", "计数相符", doc.rel, `声明模块数与枚举 ${dirCount} 相符`, `声明 ${m[1]}`));
      }
    }
    return found;
  },
};

process.exit(runCrossCheck({ nodeKey: "check-design", title: "检查集：契约表与 AC 覆盖、设计树与代码目录逐层同构、义务编号唯一、契约表列头完整", root, checks }));
