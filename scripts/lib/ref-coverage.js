/**
 * 目标：把 ref-check 中「教训回写映射」这一域的校验外置为单一模块，检出 docs/check-coverage.json 映射里不存在的校验项。
 * 范围：C15 校验项映射一致性——逐条核对映射中的校验项真实存在，脚本类须有对应脚本文件，仓库内校验项须属 ref-check 的校验清单。
 * 不包含：引用形态（见 ref-refs.js）、常量集合（见 ref-constants.js）、冻结短语（见 ref-phrases.js）、阶段键（见 ref-stages.js）、
 *   规范读取面（见 spec-doc.js）、命令行入口。不引入第三方依赖。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./text.js");

const COVERAGE_REL = "docs/check-coverage.json";
const REF_CHECK_REL = "scripts/ref-check.js";
const SCRIPT_NAME_RE = /\.js$/;
// 校验清单的唯一定义处在 ref-check 的 CHECKS 数组：取每项的编号首格，形如 ["C1", ...
const CHECK_ID_RE = /^\s*\["(C\d+)"\s*,/gm;

function createCoverageChecks(env) {
  const { root } = env;

  // 校验清单的编号集合：读装配脚本，避免本模块另立一份编号权威
  function readCheckIds() {
    const text = readFileText(path.join(root, ...REF_CHECK_REL.split("/")));
    return [...text.matchAll(CHECK_ID_RE)].map((m) => m[1]);
  }

  function checkCheckCoverage() {
    const found = [];
    const file = path.join(root, ...COVERAGE_REL.split("/"));
    if (!fs.existsSync(file)) {
      found.push(drift("C15", COVERAGE_REL, 0, "教训回写映射产物须存在", `${COVERAGE_REL} 存在`, "未找到"));
      return found;
    }
    let data;
    try {
      data = JSON.parse(readFileText(file));
    } catch (e) {
      found.push(drift("C15", COVERAGE_REL, 0, "映射产物须为合法 JSON", "可解析", e.message));
      return found;
    }
    const list = data && Array.isArray(data.coverage) ? data.coverage : null;
    if (!list) {
      found.push(drift("C15", COVERAGE_REL, 0, "映射产物须含 coverage 数组", "coverage 为数组", "未解析到"));
      return found;
    }
    const checkIds = new Set(readCheckIds());
    list.forEach((item, index) => {
      const label = item && item.check ? item.check : `第 ${index + 1} 条`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        found.push(drift("C15", COVERAGE_REL, 0, "映射条目须为对象", "含 rootCause 与 check 的对象", label));
        return;
      }
      if (typeof item.rootCause !== "string" || item.rootCause.trim() === "") {
        found.push(drift("C15", COVERAGE_REL, 0, "映射条目须给出根因分类", "rootCause 非空", label));
      }
      if (typeof item.check !== "string" || item.check.trim() === "") {
        found.push(drift("C15", COVERAGE_REL, 0, "校验项须以名字标识", "非空 check", label));
        return;
      }
      // 脚本类给脚本文件名，核对仓库内脚本文件存在；其余视为校验编号，核对属于 ref-check 的校验清单
      if (SCRIPT_NAME_RE.test(item.check)) {
        if (!fs.existsSync(path.join(root, "scripts", item.check))) {
          found.push(drift("C15", COVERAGE_REL, 0, "脚本类校验项须在仓库中真实存在", `scripts/${item.check} 存在`, item.check));
        }
      } else if (!checkIds.has(item.check)) {
        found.push(drift("C15", COVERAGE_REL, 0, "仓库内校验项须属 ref-check 的校验清单", `校验清单含 ${item.check}`, item.check));
      }
    });
    return found;
  }

  return { checkCheckCoverage };
}

module.exports = { createCoverageChecks };
