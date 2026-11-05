/**
 * 目标：把 ref-check 的清单类校验中外置为单一模块——提示模板集一致性与基线键一致性，
 *   使包清单声明的提示模板目录与模板名受一次机械比对、两份基线的键随结构迁移不残留陈旧条目。
 * 范围：C23 提示模板集一致性——package.json 的 pi.prompts 声明目录存在，其下 *.md 命名字形合法且全局唯一，至少一份；
 *   C24 基线键一致性——收敛基线 docHeadings 键对应的活文档须存在、工具链基线 entries 键对应的入口须存在且有 shebang。
 * 不包含：模板正文语义、基线的数值比对（分别见各脚本自身）、命令行入口。不引入第三方依赖。
 * 依据：DESIGN-structure.md 第四、七节；DESIGN-crosscheck.md 第二、六节。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./text.js");

const PACKAGE_REL = "package.json";
const CONVERGENCE_BASELINE_REL = "skills/ddd-methodology/scripts/lib/convergence-baseline.json";
const TOOLCHAIN_BASELINE_REL = "skills/ddd-methodology/scripts/lib/toolchain-baseline.json";
// 提示模板名形态：kebab-case，前缀 ddd-，一个文件一个命令，见 DESIGN-structure.md 第四节命名规则
const PROMPT_NAME_RE = /^ddd-[a-z][a-z0-9-]*\.md$/;

function createInventoryChecks(env) {
  const { root } = env;

  // package.json 读取：不可解析时回 null，由调用方报漂移
  function readPackage() {
    try { return JSON.parse(readFileText(path.join(root, PACKAGE_REL))); } catch (e) { return null; }
  }

  // C23 提示模板集一致性：声明目录存在，模板名合法且唯一，至少一份
  function checkPromptTemplates() {
    const pkg = readPackage();
    if (!pkg) return [drift("C23", PACKAGE_REL, 0, "package.json 须存在且可解析", "合法 JSON", "未找到或不可解析")];
    const dirs = pkg && pkg.pi && Array.isArray(pkg.pi.prompts) ? pkg.pi.prompts : null;
    if (!dirs || !dirs.length) return [drift("C23", PACKAGE_REL, 0, "package.json 须声明 pi.prompts 目录", "pi.prompts 为非空数组", "未声明")];
    const found = [];
    const seen = new Map();
    let count = 0;
    for (const rel of dirs) {
      const abs = path.join(root, rel.replace(/^\.\//, ""));
      if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) { found.push(drift("C23", rel, 0, "pi.prompts 声明的目录须存在", `${rel} 为目录`, "未找到")); continue; }
      let names; try { names = fs.readdirSync(abs).filter((n) => n.endsWith(".md")); } catch (e) { names = []; }
      for (const name of names) {
        count++;
        if (!PROMPT_NAME_RE.test(name)) found.push(drift("C23", `${rel}/${name}`, 0, "提示模板名须为 kebab-case 且前缀 ddd-", "形如 ddd-init.md", name));
        if (seen.has(name)) found.push(drift("C23", `${rel}/${name}`, 0, "提示模板名须全局唯一", `与 ${seen.get(name)} 不同名`, name));
        else seen.set(name, `${rel}/${name}`);
      }
    }
    if (!count) found.push(drift("C23", dirs.join("、"), 0, "提示模板目录下须至少有一份模板", "含 ddd-*.md 模板", "零份"));
    return found;
  }

  // C24 基线键一致性：两份基线的键须指向当前结构中真实存在的对象，迁移后不残留陈旧键
  function checkBaselineKeys() {
    const found = [];
    const convText = readFileText(path.join(root, ...CONVERGENCE_BASELINE_REL.split("/")));
    if (!convText) {
      found.push(drift("C24", CONVERGENCE_BASELINE_REL, 0, "收敛度基线须存在", "convergence-baseline.json 可读", "未找到"));
    } else {
      try {
        const conv = JSON.parse(convText);
        for (const rel of Object.keys((conv && conv.docHeadings) || {})) {
          if (!fs.existsSync(path.join(root, ...rel.split("/")))) found.push(drift("C24", CONVERGENCE_BASELINE_REL, 0, "收敛基线 docHeadings 键须对应存在的活文档", `${rel} 存在`, "残留键"));
        }
      } catch (e) {
        found.push(drift("C24", CONVERGENCE_BASELINE_REL, 0, "收敛度基线须可解析", "合法 JSON", e.message));
      }
    }
    const tcText = readFileText(path.join(root, ...TOOLCHAIN_BASELINE_REL.split("/")));
    if (!tcText) {
      found.push(drift("C24", TOOLCHAIN_BASELINE_REL, 0, "工具链基线须存在", "toolchain-baseline.json 可读", "未找到"));
    } else {
      try {
        const tc = JSON.parse(tcText);
        for (const rel of Object.keys((tc && tc.entries) || {})) {
          const abs = path.join(root, ...rel.split("/"));
          if (!fs.existsSync(abs)) found.push(drift("C24", TOOLCHAIN_BASELINE_REL, 0, "工具链基线 entries 键须对应存在的入口脚本", `${rel} 存在`, "残留键"));
          else if (!/^#!/.test(readFileText(abs))) found.push(drift("C24", TOOLCHAIN_BASELINE_REL, 0, "工具链基线 entries 键须对应有 shebang 的命令行入口", `${rel} 为命令行入口`, "非入口"));
        }
      } catch (e) {
        found.push(drift("C24", TOOLCHAIN_BASELINE_REL, 0, "工具链基线须可解析", "合法 JSON", e.message));
      }
    }
    return found;
  }

  return { checkPromptTemplates, checkBaselineKeys };
}

module.exports = { createInventoryChecks };
