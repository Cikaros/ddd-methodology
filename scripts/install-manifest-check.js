/**
 * 目标：枚举随包分发的脚本集合，作为 C17「结构与安装内容明细一致性」比对安装内容明细的白名单来源。
 * 范围：随包脚本集合的枚举——scripts/ 下全部 .js，减去仓库内部专用脚本，回传去扩展名的相对名，lib/ 子目录条目带 lib/ 前缀。
 * 不包含：安装脚本职责校验、安装参数解析、skill 与代理正文、workflows 与 extensions 的清单、命令行入口。不引入第三方依赖。
 * 消费方：ref-check.js 的装配处，取值经 env 注入 ref-structure.js 的 C17。
 */

const fs = require("fs");
const path = require("path");

// 仓库内部专用脚本：模型配比应用与旧安装迁移，依赖仓库在场运行、不进入随包分发的运行流程，故不入随包脚本集合
const REPO_ONLY_SCRIPTS = new Set(["apply-models.js", "migrate-to-package.js"]);

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

// 随包脚本集合：供 ref-check 的装配处注入 C17，与安装内容明细双向比对
function parseShippedScripts(root) {
  return new Set(collectShippedScripts(root));
}

module.exports = { REPO_ONLY_SCRIPTS, parseShippedScripts };
