/**
 * 目标：枚举随包分发的脚本集合，作为 C17「结构与安装内容明细一致性」比对安装内容明细的白名单来源。
 * 范围：随包脚本集合的枚举——skills/ddd-methodology/scripts/ 下全部 .js，回传去扩展名的相对名，lib/ 子目录条目带 lib/ 前缀。
 *   0.8.0 结构重排后脚本位置为技能目录 skills/ddd-methodology/scripts/；此处按新位置枚举，路径不再有第二份副本。
 * 不包含：安装脚本职责校验、安装参数解析、skill 与代理正文、workflows 与 extensions 的清单、命令行入口。不引入第三方依赖。
 * 依赖项的处置：原仓库内部专用脚本 apply-models.js 与 migrate-to-package.js 已随模型配比改声明删除（见 DESIGN-decisions.md D07、D38），
 *   故不再保留排除集；现网无仓库内部专用脚本，随包集合即 scripts/ 下全部 .js。
 * 消费方：ref-check.js 的装配处，取值经 env 注入 ref-structure.js 的 C17。
 */

const fs = require("fs");
const path = require("path");

// skills/ddd-methodology/scripts/ 下随包分发的脚本名集合：递归取全部 .js，回传去扩展名的相对名
function collectShippedScripts(root) {
  const out = [];
  const walk = (dir, prefix) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) { walk(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name); continue; }
      if (!entry.name.endsWith(".js")) continue;
      const base = entry.name.replace(/\.js$/, "");
      out.push(prefix ? `${prefix}/${base}` : base);
    }
  };
  walk(path.join(root, "skills", "ddd-methodology", "scripts"), "");
  return out;
}

// 随包脚本集合：供 ref-check 的装配处注入 C17，与安装内容明细双向比对
function parseShippedScripts(root) {
  return new Set(collectShippedScripts(root));
}

module.exports = { parseShippedScripts };
