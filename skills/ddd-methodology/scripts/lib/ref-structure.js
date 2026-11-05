/**
 * 目标：把 STRUCTURE.md 的结构树与安装内容明细外化为机械可判的一致性，作为结构与安装内容明细的机械消费方。
 * 范围：C17 两项断言、C21 命令入口清单一致性与 C22 模板章节引用一致性——C17 其一，结构树内全部文件与目录条目在仓库中真实存在，且仓库内除点开头条目外的文件与目录均在树中列出，即双向一致；
 *   树中以目录节点列出而无展开子项的目录视为未展开，其内容不作反向核对，只核对其自身存在性；
 *   反向核对只面向随仓库发布的条目，被 .gitignore 排除者不属漏登记，故按 git 忽略语义跳过；树内条目须真实存在的前向核对不跳过；
 *   其二，安装内容明细中列出的脚本名集合与随包脚本集合双向一致。
 * 不包含：结构树与安装内容明细的排版、其他校验项、命令行入口。不引入第三方依赖。
 * 集合来源：随包脚本集合取自 install-manifest-check.js 的枚举，经装配注入 env，本模块不另写第二份 skills/ddd-methodology/scripts/ 枚举。
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { readFileText, drift } = require("./text.js");

const STRUCTURE_REL = "STRUCTURE.md";
// 明细中的脚本名形态：小写字母起、其后为字母数字、连字符或点（点用于 matrix.test.js 一类带点基名），点分扩展名为 js
const DETAIL_SCRIPT_RE = /^[a-z][a-z0-9.-]*\.js$/;

function createStructureChecks(env) {
  const { root, shippedScripts, liveDocPaths } = env;

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
      // 复合路径名（如 skills/ddd-methodology）隐含的上级目录一并入表，使仓库顶层目录也被声明
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

  // 忽略集：结构树的反向核对只面向随仓库发布的条目，被 .gitignore 排除者不属漏登记，故按 git 忽略语义剔除；
  // git 不可用或当前根非仓库时退回直读 .gitignore 的最小匹配，两条路径都只排除确属忽略者，降级不得误报
  function readIgnoredRels(items) {
    if (!items.length) return new Set();
    const res = spawnSync("git", ["-C", root, "check-ignore", "--stdin", "-z"], {
      input: items.map((item) => `${item.rel}\0`).join(""),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    // check-ignore 以 1 表示无命中，属正常结果；其余非零或 spawn 失败才走最小匹配兜底
    if (res.status === 0 || res.status === 1) return new Set(String(res.stdout || "").split("\0").filter(Boolean));
    return minimalIgnoredRels(items);
  }

  // 最小忽略匹配：仅在 git 不可用时兜底，直读根 .gitignore，支持注释、目录限定与 *、? 通配；
  // 不求完整 gitignore 语义，只保证不把确属忽略的条目误报为漏登记
  function minimalIgnoredRels(items) {
    const rules = [];
    for (const raw of (readFileText(path.join(root, ".gitignore")) || "").split("\n")) {
      const line = raw.replace(/\s+$/, "");
      if (!line || line.startsWith("#")) continue;
      const dirOnly = line.endsWith("/");
      const body = line.replace(/^\/+/, "").replace(/\/+$/, "");
      const anchored = line.startsWith("/") || body.includes("/");
      const expr = body.split("/").map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]")).join("/");
      rules.push(new RegExp(`${anchored ? "^" : "(^|/)"}${expr}${dirOnly ? "(?:/|$)" : "$"}`));
    }
    const hit = (rel) => rules.some((re) => re.test(rel));
    const ignored = new Set();
    for (const item of items) {
      const parts = item.rel.split("/");
      for (let k = 1; k <= parts.length; k++) {
        if (hit(parts.slice(0, k).join("/"))) { ignored.add(item.rel); break; }
      }
    }
    return ignored;
  }

  // 安装内容明细节：自「## 安装内容」标题至下一二级标题前
  function readInstallSection(text) {
    const start = text.search(/^##\s*安装内容/m);
    if (start < 0) return null;
    const tail = text.slice(start);
    const end = tail.slice(1).search(/^##\s/m);
    return end < 0 ? tail : tail.slice(0, end + 1);
  }

  // 明细中列出的脚本名：取反引号内 token 的基名（脚本可能以完整安装路径出现）；
  // 口径与随包脚本集合一一对应，不单侧排除 workflow——编排脚本同属 scripts/ 下的 .js，已在安装内容明细中列出
  function collectDetailScripts(section) {
    const names = new Set();
    for (const m of section.matchAll(/`([^`]+)`/g)) {
      const base = m[1].trim().split("/").pop();
      if (!DETAIL_SCRIPT_RE.test(base)) continue;
      names.add(base);
    }
    return names;
  }

  // 集合归一：随包脚本的 lib/ 前缀条目剥去前缀只留基名并补扩展名，与明细短名同形
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
    const repoItems = scanRepo();
    const ignored = readIgnoredRels(repoItems);
    for (const item of repoItems) {
      if (ignored.has(item.rel) || entries.has(item.rel) || underUnexpanded(item.rel)) continue;
      found.push(drift("C17", STRUCTURE_REL, 0, "仓库内文件与目录须在结构树中列出", `结构树含 ${item.rel}`, item.rel));
    }

    // 断言二：安装内容明细的随装脚本集合与随包脚本集合双向一致
    const section = readInstallSection(text);
    if (!section) {
      found.push(drift("C17", STRUCTURE_REL, 0, "须含安装内容明细节", "含安装内容明细", "未找到"));
      return found;
    }
    const detail = collectDetailScripts(section);
    const shipped = normalizeShipped();
    for (const name of shipped) {
      if (!detail.has(name)) found.push(drift("C17", STRUCTURE_REL, 0, "随包脚本集合的脚本须在安装内容明细中列出", `${name} 已列出`, name));
    }
    for (const name of detail) {
      if (!shipped.has(name)) found.push(drift("C17", STRUCTURE_REL, 0, "安装内容明细列出的脚本须属随包脚本集合", `集合含 ${name}`, name));
    }
    return found;
  }

  // C21 命令入口清单一致性：README 的「脚本清单」节内 skills/ddd-methodology/scripts/xxx.js 清单与仓库中含 shebang 的入口双向比对，
  // 使新增入口必须登记、已删入口必须清除，避免清单随脚本增长而失真
  function checkEntryInventory() {
    const found = [];
    const readme = readFileText(path.join(root, "README.md"));
    if (!readme) return found;
    const section = readme.split(/^## /m).find((part) => part.startsWith("脚本清单"));
    if (!section) {
      found.push(drift("C21", "README.md", 0, "README 须含「脚本清单」节并登记全部命令入口", "含脚本清单节", "未检出"));
      return found;
    }
    const listed = new Set([...section.matchAll(/`(scripts\/[A-Za-z0-9._-]+\.js)`/g)].map((m) => m[1]));
    const actual = new Set();
    for (const file of fs.readdirSync(path.join(root, "skills", "ddd-methodology", "scripts"))) {
      if (!file.endsWith(".js")) continue;
      const text = readFileText(path.join(root, "skills", "ddd-methodology", "scripts", file));
      if (/^#!/.test(text)) actual.add(`scripts/${file}`);
    }
    for (const rel of actual) {
      if (!listed.has(rel)) found.push(drift("C21", "README.md", 0, "仓库中的命令入口须在 README 脚本清单中登记", `清单含 ${rel}`, "未列出"));
    }
    for (const rel of listed) {
      if (!actual.has(rel)) found.push(drift("C21", "README.md", 0, "README 脚本清单中的路径须对应实际的命令入口", `${rel} 为命令入口`, "无此入口"));
    }
    return found;
  }
  // C22 模板章节引用一致性：文档对模板文件与其章节的引用须落到实处，使模板拆解或改名不静默留下悬空引用。
  // 两级判据：文件级校验 templates 系列文件名在 references 下存在；章节级校验「的 X 节／段／表」三式收尾形态，
  // X 经标题侧归一 .md 与引用侧归一书名号及 .md 后须命中目标模板的二级或三级标题。泛称节名、动词收尾与文件级引用不判章节。
  function checkTemplateSectionRefs() {
    const found = [];
    const fileRe = /(templates(?:-[a-z]+)?)(?:\.md)?/g;
    const sectionRe = /(templates(?:-[a-z]+)?)(?:\.md)?`?\s*的\s*「?([^。；，\n]+?)」?\s*(?:节|段|表)/g;
    const genericRe = /对应|各产物|相应|该/;
    const referencesDir = path.join(root, "skills", "ddd-methodology", "references");
    const headingCache = new Map();
    const headingsOf = (file) => {
      if (!headingCache.has(file)) {
        const text = readFileText(path.join(referencesDir, file)) || "";
        headingCache.set(file, new Set([...text.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].trim().replace(/\.md$/i, ""))));
      }
      return headingCache.get(file);
    };
    for (const file of liveDocPaths) {
      const rel = path.relative(root, file).split(path.sep).join("/");
      const text = readFileText(file) || "";
      const seenFiles = new Set();
      for (const m of text.matchAll(fileRe)) {
        const target = `${m[1]}.md`;
        if (seenFiles.has(target)) continue;
        seenFiles.add(target);
        if (!fs.existsSync(path.join(referencesDir, target))) {
          found.push(drift("C22", rel, 0, "引用的模板文件须存在", `${target} 存在于 references`, "未检出"));
        }
      }
      for (const m of text.matchAll(sectionRe)) {
        const target = `${m[1]}.md`;
        const section = m[2].trim().replace(/\.md$/i, "");
        if (genericRe.test(section)) continue;
        const headings = headingsOf(target);
        if (headings.size === 0) {
          found.push(drift("C22", rel, 0, "模板章节引用须指向存在的模板文件", `${target} 存在且含二级或三级标题`, "文件不存在或无标题"));
          continue;
        }
        if (!headings.has(section)) {
          found.push(drift("C22", rel, 0, "模板章节引用须命中目标模板的标题", `${target} 含标题「${section}」`, "未检出"));
        }
      }
    }
    return found;
  }

  return { checkStructureDoc, checkEntryInventory, checkTemplateSectionRefs };
}

module.exports = { createStructureChecks };
