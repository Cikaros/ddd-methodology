#!/usr/bin/env node
/**
 * 交叉检查 check-consistency（前驱 test-execute）。
 *
 * 目标：在测试执行交出后机械校对全量命名集合、计数声明与引用落点三类问题，使声明之间不再残留任何机械可判定的不一致；
 *   语义部分的消费方判定由声明面审计者承担，本脚本只落机械部分。
 * 范围：四项检查——全量命名集合三处一致、计数声明三处一致、声明落点完备、无悬空引用；
 *   检查项定义在 skills/ddd-methodology/assets/check-items.json 的 check-consistency 节点下，本脚本只落机械实现。
 * 不包含：语义判定（审计者）。不引入第三方依赖。
 * 不适用：本仓库为方法论自身、或目标项目尚未进入设计阶段时无判定对象，报不适用而非缺口，退出码零；判据与表述见 lib/repo-scope.js。
 * 输出形态：文本正文；末行机读结论 `RESULT: pass` 或 `RESULT: gap`。退出码：0 通过或不适用，1 存在缺口。
 * 依据：DESIGN-crosscheck.md 第二、三、四节；DESIGN-governance.md 第七节。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, withLineNumbers } = require("./lib/text.js");
const { runCrossCheck, emitNotApplicable, finding, designDocs, acIds, sourceFiles } = require("./lib/cross-check.js");
const { notApplicableReason } = require("./lib/repo-scope.js");
const { sectionBody } = require("./lib/span-compare.js");

const root = process.argv[2] || process.cwd();
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const CODE_EXT_RE = /\.(?:js|mjs|cjs|ts|tsx|jsx|py|java|go|rs|sh|ps1)$/;
const SKIP = new Set(["node_modules", ".git", "docs", "dist", "build", "out", "target", "vendor", "__pycache__", "coverage", ".pi"]);

// 测试文档枚举：与 check-code 同口径，取仓库内 TEST*.md
function testText() {
  const out = [];
  const scan = (dir) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (/^TEST.*\.md$/i.test(entry.name)) out.push(readFileText(full));
    }
  };
  scan(root);
  return out.join("\n");
}

const checks = {
  // 集合同一：总 AC 集合须在 AC.md、设计侧模块级验收要点与测试文档三处一致
  "consistency-sets": () => {
    const total = acIds(root);
    if (!total.size) return [finding("consistency-sets", "集合同一", "AC.md", "AC.md 含 AC 编号条目", "未找到")];
    const designRefs = new Set();
    for (const doc of designDocs(root)) {
      const section = sectionBody(readFileText(doc.abs), "模块级验收要点");
      if (section) for (const m of section.matchAll(/\bAC-\d+\b/g)) designRefs.add(m[0]);
    }
    const tests = testText();
    const found = [];
    for (const id of total) {
      if (!designRefs.has(id)) found.push(finding("consistency-sets", "集合同一", "AC.md", `总 AC ${id} 被设计侧承接`, "未承接"));
      if (!tests.includes(id)) found.push(finding("consistency-sets", "集合同一", "AC.md", `总 AC ${id} 被测试文档引用`, "未引用"));
    }
    return found;
  },
  // 计数相符：设计文档中形如「共N个接口/模块」的数字声明与其紧随枚举数相符
  "consistency-counts": () => {
    const found = [];
    for (const doc of designDocs(root)) {
      const text = readFileText(doc.abs);
      for (const row of withLineNumbers(text)) {
        const m = row.line.match(/共\s*([零一二三四五六七八九十\d]+)\s*个(接口|模块|契约)/);
        if (!m) continue;
        const declared = CN_NUM[m[1]] !== undefined ? CN_NUM[m[1]] : (/^\d+$/.test(m[1]) ? Number(m[1]) : null);
        if (declared === null) continue;
        const section = sectionBody(text, "对外接口与约定");
        const enumerated = section ? (section.match(/^\s*\|/gm) || []).filter((l) => !/^\s*\|[\s:|-]+\|?\s*$/.test(l)).length - 1 : 0;
        if (enumerated >= 0 && declared !== enumerated) found.push(finding("consistency-counts", "计数相符", `${doc.rel}:${row.no}`, `声明 ${declared} 个与枚举 ${enumerated} 个相符`, `声明 ${declared}`));
      }
    }
    return found;
  },
  // 落点完备：ARCHITECTURE 与 AGENTS 声明的脚本路径须真实存在
  "consistency-landing": () => {
    const found = [];
    for (const name of ["ARCHITECTURE.md", "AGENTS.md"]) {
      const text = readFileText(path.join(root, name));
      if (!text) continue;
      for (const m of text.matchAll(/`([\w][\w./-]*\/[\w.-]+\.(?:js|sh|ps1|py|ts))`/g)) {
        const rel = m[1].replace(/^\.\//, "");
        if (rel.startsWith("docs/design")) continue;
        if (!fs.existsSync(path.join(root, rel))) found.push(finding("consistency-landing", "落点完备", name, `声明的脚本 ${rel} 存在`, "未找到"));
      }
    }
    return found;
  },
  // 引用可解析：设计文档与架构文档引用的源文件路径须存在，无悬空引用
  "consistency-refs": () => {
    const found = [];
    const targets = [{ rel: "ARCHITECTURE.md", abs: path.join(root, "ARCHITECTURE.md") }]
      .concat(designDocs(root).map((d) => ({ rel: d.rel, abs: d.abs })));
    const sourceSet = new Set(sourceFiles(root));
    for (const { rel, abs } of targets) {
      const text = readFileText(abs);
      for (const m of text.matchAll(/`([\w][\w./-]*\/[\w.-]+\.(?:js|ts|py|java|go|rs))`/g)) {
        const target = m[1].replace(/^\.\//, "");
        if (target.startsWith("docs/")) continue;
        const full = path.join(root, target);
        if (!sourceSet.has(full) && !fs.existsSync(full)) found.push(finding("consistency-refs", "引用可解析", rel, `引用的 ${target} 存在`, "悬空引用"));
      }
    }
    return found;
  },
};

const NODE_KEY = "check-consistency";
const TITLE = "检查集：全量命名集合与计数声明三处一致、声明落点完备、无悬空引用";
// 不适用出口：本仓库为方法论自身、或目标项目尚未进入设计阶段时无判定对象，与其余五个脚本及 trace-check 共用 lib/repo-scope.js 的同一判据
const naReason = notApplicableReason(root, `交叉检查 ${NODE_KEY} 无判定对象`);
if (naReason) process.exit(emitNotApplicable(NODE_KEY, TITLE, naReason));
process.exit(runCrossCheck({ nodeKey: NODE_KEY, title: TITLE, root, checks }));
