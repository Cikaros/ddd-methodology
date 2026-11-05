#!/usr/bin/env node
/**
 * 交叉检查 check-code（前驱 implement、test-plan）。
 *
 * 目标：在实现与测试规划交出后立即机械校对导出符号与用例覆盖两类问题，使导出符号与两级设计签名一致、
 *   用例与模块级 AC 覆盖、基础能力独立用例存在在同一次执行内被拦截。
 * 范围：三项检查——导出符号与两级设计签名一致、用例与模块级 AC 覆盖、基础能力独立用例存在；
 *   检查项定义在 skills/ddd-methodology/assets/check-items.json 的 check-code 节点下，本脚本只落机械实现。
 * 不包含：目录与文件级设计一致性（check-design、check-file-design）、语义判定。不引入第三方依赖。
 * 不适用：本仓库为方法论自身、或无设计树时无判定对象，报不适用而非缺口，退出码零。
 * 输出形态：文本正文；末行机读结论 `RESULT: pass` 或 `RESULT: gap`。退出码：0 通过或不适用，1 存在缺口。
 * 依据：DESIGN-crosscheck.md 第二、三、四节；DESIGN-designtree.md 第二节。
 */

const fs = require("fs");
const path = require("path");
const { readFileText } = require("./lib/text.js");
const { runCrossCheck, finding, designDocs } = require("./lib/cross-check.js");
const { sectionBody, readTable } = require("./lib/span-compare.js");

const root = process.argv[2] || process.cwd();

// 测试文档枚举：自仓库根深度优先取名为 TEST.md 的文件，与设计树镜像路径对应
function testFiles() {
  const skip = new Set(["node_modules", ".git", "docs", "dist", "build", "out", "target", "vendor", "__pycache__", "coverage", ".pi"]);
  const out = [];
  const scan = (dir) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (/^TEST.*\.md$/i.test(entry.name)) out.push(full);
    }
  };
  scan(root);
  return out;
}

// 基础能力清单：自 ARCHITECTURE 的基础能力清单节取反引号内以代码扩展名收尾的文件路径
function baseCapabilities() {
  const section = sectionBody(readFileText(path.join(root, "ARCHITECTURE.md")), "基础能力清单");
  if (!section) return [];
  const out = new Set();
  for (const m of section.matchAll(/`([^`\n]+?\.(?:[a-z]{1,4}))`/g)) out.add(m[1].trim());
  return [...out];
}

const checks = {
  // 引用可解析：契约表接口名须在消费方模块所指文件中确实出现
  "code-exports": () => {
    const found = [];
    for (const doc of designDocs(root)) {
      if (doc.base !== "DESIGN") continue;
      const table = readTable(sectionBody(readFileText(doc.abs), "对外接口与约定") || readFileText(doc.abs), /接口名|接口/);
      if (!table) continue;
      const consumers = table.headers.findIndex((h) => /消费方/.test(h));
      for (const row of table.rows) {
        const name = (row[0] || "").replace(/`/g, "").trim();
        if (!name) continue;
        const cell = consumers >= 0 ? (row[consumers] || "").replace(/`/g, "").trim() : "";
        if (!/[\\/.]/.test(cell)) continue; // 无消费方或为逻辑模块名，无判定对象，跳过
        const file = path.join(root, cell);
        if (!fs.existsSync(file)) { found.push(finding("code-exports", "引用可解析", doc.rel, `消费方文件 ${cell} 存在`, "未找到")); continue; }
        if (!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`).test(readFileText(file))) {
          found.push(finding("code-exports", "引用可解析", doc.rel, `消费方文件 ${cell} 含导出符号 ${name}`, "未检出"));
        }
      }
    }
    return found;
  },
  // 引用可解析：设计侧模块级 AC 须被 TEST 文档引用
  "code-test-ac": () => {
    const tests = testFiles().map((f) => readFileText(f)).join("\n");
    const found = [];
    for (const doc of designDocs(root)) {
      const section = sectionBody(readFileText(doc.abs), "模块级验收要点");
      if (section === null) continue;
      for (const m of section.matchAll(/\bAC-\d+\b/g)) {
        if (!tests.includes(m[0])) found.push(finding("code-test-ac", "引用可解析", doc.rel, `模块级 AC ${m[0]} 被 TEST 文档覆盖`, "未覆盖"));
      }
    }
    return found;
  },
  // 落点完备：基础能力清单的文件须有独立用例存在（其基名出现于某 TEST 文档）
  "code-base-capability": () => {
    const caps = baseCapabilities();
    if (!caps.length) return [finding("code-base-capability", "落点完备", "ARCHITECTURE.md", "基础能力清单节含至少一个能力文件", "未找到")];
    const tests = testFiles().map((f) => readFileText(f)).join("\n");
    const found = [];
    for (const cap of caps) {
      const base = path.basename(cap, path.extname(cap));
      if (!tests.includes(base) && !tests.includes(cap)) found.push(finding("code-base-capability", "落点完备", "ARCHITECTURE.md", `基础能力 ${cap} 有独立用例`, "未检出用例"));
    }
    return found;
  },
};

process.exit(runCrossCheck({ nodeKey: "check-code", title: "检查集：导出符号与两级设计签名一致、用例与模块级 AC 覆盖、基础能力独立用例存在", root, checks }));
