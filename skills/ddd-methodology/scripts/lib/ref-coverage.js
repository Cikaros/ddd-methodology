/**
 * 目标：把 ref-check 中「教训回写映射」这一域的校验外置为单一模块，检出映射产物中不存在或不一致的条目。
 * 范围：C15 校验项映射一致性——逐条核对三项：映射中的校验项真实存在（脚本类须有对应脚本文件，仓库内校验项须属 ref-check 的校验清单）；
 *   条目所引债务在登记簿中存在且状态为已清偿；条目的根因分类与该债务登记的根因分类一致。
 *   映射产物属内部产物，按回退链定位：随包分发的目标项目产物在 docs/，本仓库自身副本在 docs/internal/；
 *   两者皆无时报「不适用」而非「漂移」，与规范「本仓库适用边界」节「报为不适用而非缺口」同旨。
 *   反向完整性，即以新增或扩展机械校验清偿的债务须有条目，无机械判据，由审计代理核验，本模块不承担。
 * 不包含：引用形态（见 ref-refs.js）、常量集合（见 ref-constants.js）、冻结短语（见 ref-phrases.js）、阶段键（见 ref-stages.js）、
 *   规范读取面（见 spec-doc.js）、命令行入口。不引入第三方依赖。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./text.js");
const { DEBT_BOOK_REL, artifactCandidates } = require("./paths.js");

// 映射产物候选路径，按共享层回退链：随包分发的目标项目产物在 docs/，本仓库自身副本在 docs/internal/
const COVERAGE_RELS = artifactCandidates("docs/check-coverage.json");
// 登记簿候选路径同形回退：paths.js 的常量服务目标项目，本仓库自身副本在 docs/internal/
const DEBT_BOOK_RELS = artifactCandidates(DEBT_BOOK_REL);
const REF_CHECK_REL = "skills/ddd-methodology/scripts/ref-check.js";
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

  // 登记簿条目表：编号到条目的映射，供债务存在性、已清偿与根因一致三项断言查询；按回退链逐个候选尝试
  function readDebtBook() {
    for (const rel of DEBT_BOOK_RELS) {
      const text = readFileText(path.join(root, ...rel.split("/")));
      if (!text) continue;
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data && data.debts)) return data.debts;
      } catch (e) { /* 该候选不可解析，落到下一候选 */ }
    }
    return null;
  }

  function checkCheckCoverage() {
    const found = [];
    const rel = COVERAGE_RELS.find((candidate) => fs.existsSync(path.join(root, ...candidate.split("/"))));
    if (!rel) {
      // 映射产物缺失非缺陷：按回退链两处皆无才报，与规范「本仓库适用边界」节同旨，不产生漂移项
      process.stdout.write(`[C15 不适用] 教训回写映射产物缺失：${COVERAGE_RELS.join(" 与 ")} 均不存在，按规范「本仓库适用边界」节报不适用，不计入漂移\n`);
      return found;
    }
    const file = path.join(root, ...rel.split("/"));
    let data;
    try {
      data = JSON.parse(readFileText(file));
    } catch (e) {
      found.push(drift("C15", rel, 0, "映射产物须为合法 JSON", "可解析", e.message));
      return found;
    }
    const list = data && Array.isArray(data.coverage) ? data.coverage : null;
    if (!list) {
      found.push(drift("C15", rel, 0, "映射产物须含 coverage 数组", "coverage 为数组", "未解析到"));
      return found;
    }
    const checkIds = new Set(readCheckIds());
    const debts = readDebtBook();
    const byId = new Map();
    if (debts) for (const entry of debts) if (entry && entry.id) byId.set(entry.id, entry);
    list.forEach((item, index) => {
      const label = item && item.check ? item.check : `第 ${index + 1} 条`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        found.push(drift("C15", rel, 0, "映射条目须为对象", "含 rootCause、check 与 debt 的对象", label));
        return;
      }
      if (typeof item.rootCause !== "string" || item.rootCause.trim() === "") {
        found.push(drift("C15", rel, 0, "映射条目须给出根因分类", "rootCause 非空", label));
      }
      if (typeof item.check !== "string" || item.check.trim() === "") {
        found.push(drift("C15", rel, 0, "校验项须以名字标识", "非空 check", label));
      } else if (SCRIPT_NAME_RE.test(item.check)) {
        // 脚本类给脚本文件名，核对仓库内脚本文件存在；其余视为校验编号，核对属于 ref-check 的校验清单
        if (!fs.existsSync(path.join(root, "skills", "ddd-methodology", "scripts", item.check))) {
          found.push(drift("C15", rel, 0, "脚本类校验项须在仓库中真实存在", `skills/ddd-methodology/scripts/${item.check} 存在`, item.check));
        }
      } else if (!checkIds.has(item.check)) {
        found.push(drift("C15", rel, 0, "仓库内校验项须属 ref-check 的校验清单", `校验清单含 ${item.check}`, item.check));
      }
      // 债务引用三项：编号非空、在登记簿中存在、已清偿、根因分类与登记一致
      if (typeof item.debt !== "string" || item.debt.trim() === "") {
        found.push(drift("C15", rel, 0, "映射条目须给出所引来源债务编号", "debt 非空", label));
        return;
      }
      if (!debts) {
        found.push(drift("C15", rel, 0, "登记簿须可解析以核对债务引用", `${DEBT_BOOK_REL} 可解析`, "未解析到"));
        return;
      }
      const debt = byId.get(item.debt);
      if (!debt) {
        found.push(drift("C15", rel, 0, "映射条目所引债务须在登记簿中存在", `登记簿含 ${item.debt}`, item.debt));
        return;
      }
      if (debt.status !== "closed") {
        found.push(drift("C15", rel, 0, "映射条目所引债务须已清偿", `${item.debt} 状态为 closed`, debt.status));
      }
      if (item.rootCause !== debt.rootCause) {
        found.push(drift("C15", rel, 0, "映射条目的根因分类须与该债务登记一致", `${item.debt} 根因为 ${debt.rootCause}`, item.rootCause));
      }
    });
    return found;
  }

  return { checkCheckCoverage };
}

module.exports = { createCoverageChecks };
