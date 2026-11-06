#!/usr/bin/env node
/**
 * 交叉检查 check-scope（前驱 architect）。
 *
 * 目标：在架构设计交出后立即机械校对集合同一与顺序一致两类问题，落 DESIGN-crosscheck.md 第二节的五类之一，
 *   使结构树、包清单、语言栈、技能清单、目录规划五处同集与字段名阶段键同集在同一次执行内被拦截。
 * 范围：五项检查——五处同集、状态文件字段名与阶段键同集、声明路径可解析、阶段键序一致、目录数声明相符；
 *   检查项定义在 skills/ddd-methodology/assets/check-items.json 的 check-scope 节点下，本脚本只落机械实现。
 * 不包含：契约表与设计树同构（check-design）、文件级清单（check-file-design）、语义判定。不引入第三方依赖。
 * 不适用：本仓库为方法论自身、或目标项目尚未进入设计阶段时无判定对象，报不适用而非缺口，退出码零；判据与表述见 lib/repo-scope.js。
 * 输出形态：文本正文；末行机读结论 `RESULT: pass`（无缺口）或 `RESULT: gap`（存在缺口）。退出码：0 通过或不适用，1 存在缺口。
 * 依据：DESIGN-crosscheck.md 第二、三、四节；DESIGN-governance.md 第二节 G3。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, withLineNumbers } = require("./lib/text.js");
const { runCrossCheck, emitNotApplicable, finding, readStatus, designDir, nodeUniverse } = require("./lib/cross-check.js");
const { notApplicableReason } = require("./lib/repo-scope.js");

const root = process.argv[2] || process.cwd();
const STATUS_FIELDS = ["channel", "doneStages", "lastStage", "status", "freezeAnchor"];
const DEP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "target", "vendor", "__pycache__", "coverage"]);
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

// ARCHITECTURE 文本与存在性：本节点的判定对象，缺失即由各检查项报缺口
function archText() {
  return readFileText(path.join(root, "ARCHITECTURE.md"));
}

// 声明的目录集合：自 ARCHITECTURE 的围栏结构树取目录条目，另并入反引号内以斜杠收尾的路径；
// 目录条目形如「├── src/」或整行「src/core/」，取末段路径拼回，围栏外不复述
function declaredDirs(text) {
  const dirs = new Set();
  let inFence = false;
  for (const raw of text.split("\n")) {
    if (/^\s*```/.test(raw)) { inFence = !inFence; continue; }
    if (inFence) {
      const m = raw.match(/[├└]──\s*([^\s#]+)/) || raw.match(/^\s*([\w][\w./-]*\/)\s*$/);
      if (m) dirs.add(m[1].replace(/\/$/, ""));
    }
    for (const m of raw.matchAll(/`([\w][\w./-]*)\/?`/g)) if (!/\.\w+$/.test(m[1])) dirs.add(m[1]);
  }
  return [...dirs].filter(Boolean);
}

// 仓库实际目录集合：自根起两层深度优先枚举，跳过点开头与依赖目录，回传仓库相对路径
function actualDirs() {
  const out = [];
  const scan = (dir, rel, depth) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || DEP_DIRS.has(entry.name)) continue;
      if (!entry.isDirectory()) continue;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      out.push(child);
      if (depth < 2) scan(path.join(dir, entry.name), child, depth + 1);
    }
  };
  scan(root, "", 1);
  return out;
}

const checks = {
  // 集合同一：目录规划声明的目录与仓库实际目录同集，逐名比对而非只比数量
  "scope-five-sets": () => {
    const text = archText();
    if (!text) return [finding("scope-five-sets", "集合同一", "ARCHITECTURE.md", "含目录规划节且可读", "未找到 ARCHITECTURE.md")];
    const declared = new Set(declaredDirs(text).map((d) => d.replace(/^\.\//, "")));
    const actual = new Set(actualDirs());
    const found = [];
    for (const d of declared) {
      if (actual.has(d) || fs.existsSync(path.join(root, d))) continue;
      found.push(finding("scope-five-sets", "集合同一", "ARCHITECTURE.md", `目录规划声明的 ${d} 在仓库中存在`, d));
    }
    for (const d of actual) {
      if (declared.has(d)) continue;
      found.push(finding("scope-five-sets", "集合同一", "ARCHITECTURE.md", `仓库目录 ${d} 已在目录规划中声明`, "未声明"));
    }
    return found;
  },
  // 集合同一：状态文件字段集合与固定五字段同集，且 doneStages 每元素属节点全集
  "scope-field-stage": () => {
    const status = readStatus(root);
    if (!status) return [finding("scope-field-stage", "集合同一", "docs/.ddd-state.json", "状态文件存在且可读", "未找到")];
    if (status.__invalid) return [finding("scope-field-stage", "集合同一", "docs/.ddd-state.json", "合法 JSON", status.__invalid)];
    const expected = new Set(STATUS_FIELDS);
    const actual = new Set(Object.keys(status));
    const universe = new Set(nodeUniverse());
    const found = [];
    for (const f of expected) if (!actual.has(f)) found.push(finding("scope-field-stage", "集合同一", "docs/.ddd-state.json", `字段 ${f} 存在`, "缺失"));
    for (const f of actual) if (!expected.has(f)) found.push(finding("scope-field-stage", "集合同一", "docs/.ddd-state.json", "字段名属固定五字段", f));
    for (const key of Array.isArray(status.doneStages) ? status.doneStages : []) {
      if (!universe.has(key)) found.push(finding("scope-field-stage", "集合同一", "docs/.ddd-state.json", `阶段键 ${key} 属节点全集`, "未知键"));
    }
    return found;
  },
  // 引用可解析：ARCHITECTURE 声明的设计树根路径对应目录须存在
  "scope-refs": () => {
    const info = designDir(root);
    if (!fs.existsSync(info.dir)) return [finding("scope-refs", "引用可解析", "ARCHITECTURE.md", `设计树根 ${info.dir} 存在`, "未找到")];
    return [];
  },
  // 顺序一致：doneStages 的元素次序须为节点全集（通道 A 设计序）的子序列
  "scope-order": () => {
    const status = readStatus(root);
    if (!status || status.__invalid || !Array.isArray(status.doneStages)) return [];
    const order = new Map(nodeUniverse().map((key, index) => [key, index]));
    const found = [];
    let last = -1;
    for (const key of status.doneStages) {
      const at = order.has(key) ? order.get(key) : -1;
      if (at < last) found.push(finding("scope-order", "顺序一致", "docs/.ddd-state.json", `阶段键序与节点全集一致，${key} 不得早于其前驱`, "次序颠倒"));
      if (at > last) last = at;
    }
    return found;
  },
  // 计数相符：ARCHITECTURE 中形如「共N个目录/模块」的数字声明与其紧随枚举数相符
  "scope-counts": () => {
    const text = archText();
    if (!text) return [];
    const found = [];
    for (const row of withLineNumbers(text)) {
      const m = row.line.match(/共\s*([零一二三四五六七八九十\d]+)\s*个[^\n]*?(?:目录|模块|文件)/);
      if (!m) continue;
      const token = m[1];
      const declared = CN_NUM[token] !== undefined ? CN_NUM[token] : (/^\d+$/.test(token) ? Number(token) : null);
      if (declared === null) continue;
      const enumerated = declaredDirs(text).length;
      if (declared !== enumerated) found.push(finding("scope-counts", "计数相符", `ARCHITECTURE.md:${row.no}`, `声明 ${declared} 个目录与枚举 ${enumerated} 个相符`, `声明 ${declared}`));
    }
    return found;
  },
};

const NODE_KEY = "check-scope";
const TITLE = "检查集：结构树、包清单、语言栈、技能清单、目录规划五处同集；字段名与阶段键同集";
// 不适用出口：本仓库为方法论自身、或目标项目尚未进入设计阶段时无判定对象，与其余五个脚本及 trace-check 共用 lib/repo-scope.js 的同一判据
const naReason = notApplicableReason(root, `交叉检查 ${NODE_KEY} 无判定对象`);
if (naReason) process.exit(emitNotApplicable(NODE_KEY, TITLE, naReason));
process.exit(runCrossCheck({ nodeKey: NODE_KEY, title: TITLE, root, checks }));
