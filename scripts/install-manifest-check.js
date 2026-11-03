/**
 * 目标：把安装与卸载脚本的职责一致性外化为机械证据。脚本收敛后不再复制任何资源，唯一职责是调用仓库内部专用脚本
 *   apply-models.js 应用或撤回模型配比，故本校验核对这一职责在各脚本中是否一致且不漂移。
 * 范围：C13 四项断言——其一，install.sh、install.bat、uninstall.sh、uninstall.bat 须存在且可读；
 *   其二，各脚本引用的 scripts/*.js 须属仓库内部专用脚本集合 REPO_ONLY_SCRIPTS，不得引用随包分发的脚本；
 *   其三，各脚本引用的脚本须在仓库中实际存在；
 *   其四，两份安装脚本的引用集合双向一致、两份卸载脚本的引用集合双向一致，防止 sh 与 bat 各写一份而悄悄漂移。
 * 不包含：安装参数解析、随包脚本集合的枚举（见 collectShippedScripts，供结构文档校验 C17 消费）、skill 与代理正文、
 *   workflows 与 extensions 的清单、命令行入口。不引入第三方依赖。
 * 应随装集合：脚本收敛后资源由整仓提供，无复制白名单；随包分发脚本集合由 collectShippedScripts 按 scripts/ 递归枚举减去
 *   仓库内部专用脚本得到，供 C17 比对结构文档的安装内容明细，本模块与 C17 共用同一枚举以免两处各写一份。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./lib/text.js");

// 仓库内部专用脚本：模型配比应用与旧安装迁移，依赖仓库在场运行、不进入随包分发的运行流程，故不入随包脚本集合
const REPO_ONLY_SCRIPTS = new Set(["apply-models.js", "migrate-to-package.js"]);
const SCRIPT_REF_RE = /scripts[\\/]([A-Za-z0-9][A-Za-z0-9._-]*\.js)/g;
// 各脚本的受控载体与期望职责：安装脚本应用配比、卸载脚本撤回配比，四者都只应引用仓库内部专用脚本
const INSTALL_SCRIPTS = ["scripts/install.sh", "scripts/install.bat"];
const UNINSTALL_SCRIPTS = ["scripts/uninstall.sh", "scripts/uninstall.bat"];
const CONTROLLED_SCRIPTS = [...INSTALL_SCRIPTS, ...UNINSTALL_SCRIPTS];

// 提取脚本内引用的 scripts/*.js 相对名：shell 用正斜杠、batch 用反斜杠，两种写法一并归一
function referencedScripts(text) {
  const out = new Set();
  for (const m of String(text || "").matchAll(SCRIPT_REF_RE)) out.add(m[1]);
  return out;
}

// scripts/ 下随包分发的脚本名集合：递归取全部 .js，去掉仓库内部专用脚本，回传去扩展名的相对名
function collectShippedScripts(root) {
  const out = [];
  const walk = (dir, prefix) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) { walk(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name); continue; }
      if (!entry.name.endsWith(".js") || REPO_ONLY_SCRIPTS.has(entry.name)) continue;
      const base = entry.name.replace(/\.js$/, "");
      out.push(prefix ? `${prefix}/${base}` : base);
    }
  };
  walk(path.join(root, "scripts"), "");
  return out;
}

// 随包脚本集合：供结构文档校验 C17 与安装内容明细比对，本模块与 ref-structure.js 共用同一枚举
function parseShippedScripts(root) {
  return new Set(collectShippedScripts(root));
}

function checkInstallManifest(root) {
  const found = [];
  const read = (rel) => readFileText(path.join(root, ...rel.split("/")));
  const texts = new Map();
  for (const rel of CONTROLLED_SCRIPTS) {
    const text = read(rel);
    texts.set(rel, text);
    if (!text) found.push(drift("C13", rel, 0, "安装与卸载脚本须存在且可读", `${rel} 可读`));
  }

  // 断言二与三：各脚本引用的脚本须属仓库内部专用脚本集合，且须在仓库中实际存在
  const refsByScript = new Map();
  for (const rel of CONTROLLED_SCRIPTS) {
    const refs = referencedScripts(texts.get(rel));
    refsByScript.set(rel, refs);
    for (const name of refs) {
      if (!REPO_ONLY_SCRIPTS.has(name)) found.push(drift("C13", rel, 0, "安装与卸载脚本只应引用仓库内部专用脚本", `引用属 ${[...REPO_ONLY_SCRIPTS].join("、")}`, name));
      if (!fs.existsSync(path.join(root, "scripts", name))) found.push(drift("C13", rel, 0, "安装与卸载脚本引用的脚本须在仓库中实际存在", `scripts/${name} 存在`, name));
    }
  }

  // 断言四：两份安装脚本的引用集合双向一致、两份卸载脚本的引用集合双向一致
  const comparePair = (a, b, criterion) => {
    const setA = refsByScript.get(a);
    const setB = refsByScript.get(b);
    for (const name of setA) if (!setB.has(name)) found.push(drift("C13", b, 0, criterion, `含 ${name}`, name));
    for (const name of setB) if (!setA.has(name)) found.push(drift("C13", a, 0, criterion, `含 ${name}`, name));
  };
  comparePair(INSTALL_SCRIPTS[0], INSTALL_SCRIPTS[1], "两份安装脚本引用的脚本集合须一致");
  comparePair(UNINSTALL_SCRIPTS[0], UNINSTALL_SCRIPTS[1], "两份卸载脚本引用的脚本集合须一致");

  // 断言二之职责面：四者都须经由 apply-models.js 承担模型配比，收敛后这是唯一职责，缺则职责丢失
  for (const rel of CONTROLLED_SCRIPTS) {
    if (!refsByScript.get(rel).has("apply-models.js")) found.push(drift("C13", rel, 0, "安装与卸载脚本须引用 apply-models.js 以承担模型配比", "引用 scripts/apply-models.js", "未引用"));
  }

  return found;
}

module.exports = { checkInstallManifest, parseShippedScripts, collectShippedScripts };
