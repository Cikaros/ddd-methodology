/**
 * 目标：把 STRUCTURE.md 的结构树与安装内容明细外化为机械可判的一致性，作为结构与安装内容明细的机械消费方。
 * 范围：C17 两项断言——其一，结构树内全部文件与目录条目在仓库中真实存在，且仓库内除点开头条目外的文件与目录均在树中列出，即双向一致；
 *   树中以目录节点列出而无展开子项的目录视为未展开，其内容不作反向核对，只核对其自身存在性；
 *   其二，安装内容明细中列出的脚本名集合与安装脚本的随装脚本白名单双向一致。
 * 不包含：结构树与安装内容明细的排版、安装参数表（见 ref-install-params.js）、其他校验项、命令行入口。不引入第三方依赖。
 * 白名单来源：随装脚本白名单取自安装清单一致性校验已解析的集合，经装配注入 env，本模块不另写第二份安装脚本解析。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./text.js");

const STRUCTURE_REL = "STRUCTURE.md";
// workflow 脚本经 workflows/ 目录单独随装，不在 scripts 随装脚本白名单内，故明细比对时排除
const WORKFLOW_SCRIPT_NAME = "ddd-workflow.js";
// 明细中的脚本名形态：小写字母起、其后为字母数字或连字符，点分扩展名为 js
const DETAIL_SCRIPT_RE = /^[a-z][a-z0-9-]*\.js$/;

function createStructureChecks(env) {
  const { root, shippedScripts } = env;

  // 结构树解析：取「## 仓库结构」节内首个围栏块，按 tree 缩进（每级四字符）还原层级，回传仓库相对路径到条目的映射
  function parseTree(text) {
    const entries = new Map();
    const lines = text.split("\n");
    const sectionStart = lines.findIndex((line) => /^##\s*仓库结构/.test(line));
    if (sectionStart < 0) return { entries, error: "未找到仓库结构节" };
    let fence = -1;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i])) break;
      if (/^\s*```/.test(lines[i])) { fence = i; break; }
    }
    if (fence < 0) return { entries, error: "仓库结构节内未找到结构树围栏" };
    // 目录栈：记录各级目录的相对路径与缩进层级，供子项拼接完整路径
    const stack = [];
    for (let i = fence + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*```/.test(line)) break;
      const glyph = line.search(/[├└]──/);
      if (glyph < 0) continue; // 树根行无分干支，天然跳过
      const depth = Math.floor(glyph / 4);
      const name = line.slice(glyph + 3).replace(/\s+#.*$/, "").trim();
      if (!name) continue;
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
      const parent = stack.length ? stack[stack.length - 1].full : "";
      const rel = parent ? `${parent}/${name.replace(/\/$/, "")}` : name.replace(/\/$/, "");
      const kind = name.endsWith("/") ? "dir" : "file";
      const lineNo = i + 1;
      // 复合路径名（如 skill/ddd-methodology）隐含的上级目录一并入表，使仓库顶层目录也被声明
      const parts = rel.split("/");
      for (let k = 1; k < parts.length; k++) {
        const ancestor = parts.slice(0, k).join("/");
        if (!entries.has(ancestor)) entries.set(ancestor, { kind: "dir", line: lineNo });
      }
      entries.set(rel, { kind, line: lineNo });
      if (kind === "dir") stack.push({ depth, full: rel });
    }
    return { entries, error: null };
  }

  // 仓库实际集合：深度优先列举，跳过点开头条目，回传仓库相对路径与类别
  function scanRepo() {
    const out = [];
    const walkDir = (dir, base) => {
      let items; try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const item of items) {
        if (item.name.startsWith(".")) continue;
        const rel = base ? `${base}/${item.name}` : item.name;
        if (item.isDirectory()) { out.push({ rel, kind: "dir" }); walkDir(path.join(dir, item.name), rel); }
        else out.push({ rel, kind: "file" });
      }
    };
    walkDir(root, "");
    return out;
  }

  // 安装内容明细节：自「## 安装内容」标题至下一二级标题前
  function readInstallSection(text) {
    const start = text.search(/^##\s*安装内容/m);
    if (start < 0) return null;
    const tail = text.slice(start);
    const end = tail.slice(1).search(/^##\s/m);
    return end < 0 ? tail : tail.slice(0, end + 1);
  }

  // 明细中列出的脚本名：取反引号内 token 的基名（脚本可能以完整安装路径出现），workflow 脚本另行随装故排除
  function collectDetailScripts(section) {
    const names = new Set();
    for (const m of section.matchAll(/`([^`]+)`/g)) {
      const base = m[1].trim().split("/").pop();
      if (!DETAIL_SCRIPT_RE.test(base) || base === WORKFLOW_SCRIPT_NAME) continue;
      names.add(base);
    }
    return names;
  }

  // 白名单归一：安装脚本的 lib/ 前缀条目剥去前缀只留基名并补扩展名，与明细短名同形
  const normalizeShipped = () => new Set([...shippedScripts].map((name) => `${name.split("/").pop()}.js`));

  function checkStructureDoc() {
    const found = [];
    const text = readFileText(path.join(root, STRUCTURE_REL));
    if (!text) {
      found.push(drift("C17", STRUCTURE_REL, 0, "结构与安装内容明细文档须存在且可读", `${STRUCTURE_REL} 可读`));
      return found;
    }
    const { entries, error } = parseTree(text);
    if (error) {
      found.push(drift("C17", STRUCTURE_REL, 0, "仓库结构树须可解析", "含仓库结构节与围栏结构树", error));
      return found;
    }

    // 断言一之前向：树内每个条目须在仓库中真实存在且类别相符
    for (const [rel, meta] of entries) {
      let stat; try { stat = fs.statSync(path.join(root, rel)); } catch (e) { stat = null; }
      if (!stat) {
        found.push(drift("C17", STRUCTURE_REL, meta.line, "结构树条目须在仓库中真实存在", `${rel} 存在`, rel));
      } else if (meta.kind === "dir" && !stat.isDirectory()) {
        found.push(drift("C17", STRUCTURE_REL, meta.line, "结构树目录条目须对应仓库中的目录", `${rel} 为目录`, rel));
      } else if (meta.kind === "file" && stat.isDirectory()) {
        found.push(drift("C17", STRUCTURE_REL, meta.line, "结构树文件条目须对应仓库中的文件", `${rel} 为文件`, rel));
      }
    }
    // 断言一之反向：仓库内实际条目须已列入树中；未展开列出的目录其内容不入反向核对
    const expanded = new Set();
    for (const rel of entries.keys()) {
      const idx = rel.lastIndexOf("/");
      if (idx >= 0) expanded.add(rel.slice(0, idx));
    }
    const unexpandedDirs = [];
    for (const [rel, meta] of entries) if (meta.kind === "dir" && !expanded.has(rel)) unexpandedDirs.push(rel);
    const underUnexpanded = (rel) => unexpandedDirs.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`));
    for (const item of scanRepo()) {
      if (entries.has(item.rel) || underUnexpanded(item.rel)) continue;
      found.push(drift("C17", STRUCTURE_REL, 0, "仓库内文件与目录须在结构树中列出", `结构树含 ${item.rel}`, item.rel));
    }

    // 断言二：安装内容明细的随装脚本集合与安装脚本白名单双向一致
    const section = readInstallSection(text);
    if (!section) {
      found.push(drift("C17", STRUCTURE_REL, 0, "须含安装内容明细节", "含安装内容明细", "未找到"));
      return found;
    }
    const detail = collectDetailScripts(section);
    const shipped = normalizeShipped();
    for (const name of shipped) {
      if (!detail.has(name)) found.push(drift("C17", STRUCTURE_REL, 0, "安装脚本白名单的随装脚本须在安装内容明细中列出", `${name} 已列出`, name));
    }
    for (const name of detail) {
      if (!shipped.has(name)) found.push(drift("C17", STRUCTURE_REL, 0, "安装内容明细列出的脚本须属安装脚本白名单", `白名单含 ${name}`, name));
    }
    return found;
  }

  return { checkStructureDoc };
}

module.exports = { createStructureChecks };
