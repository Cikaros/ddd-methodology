/**
 * 目标：把安装与卸载脚本的清单一致性外化为机械证据，消除「删项后仓内校验仍通过、部署态模块缺失」的盲区。
 * 范围：C13 一项——解析 install.sh 与 install.bat 的随装脚本白名单、uninstall.sh 与 uninstall.bat 的 skill 白名单；
 *   校验两份安装脚本的脚本白名单双向一致、两份卸载脚本的 skill 白名单双向一致；
 *   校验脚本白名单每个条目在仓库中实际存在；校验脚本白名单等于 scripts/ 下应随装的全部 .js（递归含 lib/）。
 * 不包含：安装参数解析、skill 与代理正文、workflows 与 extensions 的清单、命令行入口。不引入第三方依赖。
 * 白名单载体：安装脚本的脚本清单是脚本内唯一的字面量 for-in 列表，其余 for-in 列表取变量或含 % $ 引号而非字面量，
 *   故解析全部字面量 for-in token 即为脚本白名单；卸载脚本的 skill 白名单取自 DDD_SKILLS 赋值。
 * 应随装集合：scripts/ 下全部 .js（递归）减去仓库内部专用脚本，后者只在仓库内运行、不复制进 skill 包。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./lib/text.js");

// 仓库内部专用脚本：应用模型配比与合并全局规则，依赖仓库在场运行，按 README 不随安装复制
const REPO_ONLY_SCRIPTS = new Set(["apply-models.js", "merge-append-system.js"]);
const SCRIPT_ENTRY_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SKILL_NAME_RE = /^ddd-[a-z][a-z0-9-]*$/;

// 提取脚本内的全部字面量 for-in token：变量或含引号、% $ 的 token 不匹配形态，自然排除
function literalForTokens(text) {
  const tokens = [];
  const push = (list) => {
    for (const raw of String(list).split(/\s+/)) {
      const token = raw.trim();
      if (!token) continue;
      const entryPath = token.replace(/\\/g, "/");
      if (SCRIPT_ENTRY_RE.test(entryPath)) tokens.push(entryPath);
    }
  };
  for (const m of text.matchAll(/for\s+%%?[A-Za-z]\s+in\s+\(([^)\n]*)\)/g)) push(m[1]);
  for (const m of text.matchAll(/for\s+[A-Za-z_]\w*\s+in\s+([^;\n]*);\s*do/g)) push(m[1]);
  return tokens;
}

// 提取 skill 白名单：shell 取 DDD_SKILLS=(...) 赋值，batch 取 set DDD_SKILLS=... 赋值
function skillTokens(text, isBatch) {
  const m = isBatch ? text.match(/set\s+DDD_SKILLS=([^\r\n]*)/i) : text.match(/DDD_SKILLS=\(([^)]*)\)/);
  if (!m) return [];
  return m[1].split(/\s+/).map((token) => token.trim()).filter((token) => SKILL_NAME_RE.test(token));
}

// scripts/ 下应随装的脚本名集合：递归取全部 .js，去掉仓库内部专用脚本，回传去扩展名的相对名
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

function checkInstallManifest(root) {
  const found = [];
  const read = (rel) => readFileText(path.join(root, ...rel.split("/")));
  const installSh = read("scripts/install.sh");
  const installBat = read("scripts/install.bat");
  const uninstallSh = read("scripts/uninstall.sh");
  const uninstallBat = read("scripts/uninstall.bat");
  for (const [rel, text] of [["scripts/install.sh", installSh], ["scripts/install.bat", installBat], ["scripts/uninstall.sh", uninstallSh], ["scripts/uninstall.bat", uninstallBat]]) {
    if (!text) found.push(drift("C13", rel, 0, "安装与卸载脚本须存在且可读", `${rel} 可读`));
  }

  const shScripts = new Set(literalForTokens(installSh));
  const batScripts = new Set(literalForTokens(installBat));
  if (!shScripts.size) found.push(drift("C13", "scripts/install.sh", 0, "install.sh 须含随装脚本白名单", "字面量脚本清单", "未解析到"));
  if (!batScripts.size) found.push(drift("C13", "scripts/install.bat", 0, "install.bat 须含随装脚本白名单", "字面量脚本清单", "未解析到"));
  for (const name of shScripts) if (!batScripts.has(name)) found.push(drift("C13", "scripts/install.bat", 0, "安装脚本的随装脚本白名单须与 install.sh 一致", `含 ${name}`, name));
  for (const name of batScripts) if (!shScripts.has(name)) found.push(drift("C13", "scripts/install.sh", 0, "安装脚本的随装脚本白名单须与 install.bat 一致", `含 ${name}`, name));

  const unionScripts = new Set([...shScripts, ...batScripts]);
  for (const name of unionScripts) if (!fs.existsSync(path.join(root, "scripts", `${name}.js`))) found.push(drift("C13", `scripts/${name}.js`, 0, "脚本白名单条目须在仓库中实际存在", `scripts/${name}.js 存在`, name));

  const shipped = new Set(collectShippedScripts(root));
  if (!shipped.size) found.push(drift("C13", "scripts/", 0, "scripts/ 下须含应随装脚本", "至少一项应随装脚本"));
  else {
    for (const name of shipped) if (!unionScripts.has(name)) found.push(drift("C13", "scripts/install.sh", 0, "脚本白名单须覆盖 scripts/ 下应随装的全部文件", `白名单含 ${name}`, name));
    for (const name of unionScripts) if (!shipped.has(name)) found.push(drift("C13", "scripts/", 0, "脚本白名单条目须属于 scripts/ 下应随装文件集合", `应随装集合含 ${name}`, name));
  }

  const uninstallShSkills = new Set(skillTokens(uninstallSh, false));
  const uninstallBatSkills = new Set(skillTokens(uninstallBat, true));
  if (!uninstallShSkills.size) found.push(drift("C13", "scripts/uninstall.sh", 0, "uninstall.sh 须含 skill 白名单", "DDD_SKILLS 清单", "未解析到"));
  if (!uninstallBatSkills.size) found.push(drift("C13", "scripts/uninstall.bat", 0, "uninstall.bat 须含 skill 白名单", "DDD_SKILLS 清单", "未解析到"));
  for (const name of uninstallShSkills) if (!uninstallBatSkills.has(name)) found.push(drift("C13", "scripts/uninstall.bat", 0, "卸载脚本的 skill 白名单须与 uninstall.sh 一致", `含 ${name}`, name));
  for (const name of uninstallBatSkills) if (!uninstallShSkills.has(name)) found.push(drift("C13", "scripts/uninstall.sh", 0, "卸载脚本的 skill 白名单须与 uninstall.bat 一致", `含 ${name}`, name));

  return found;
}

module.exports = { checkInstallManifest };
