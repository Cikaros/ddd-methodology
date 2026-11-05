/**
 * 目标：把 ref-check 中「权威源、其余位置为受控副本」这一域的常量集合校验外置为单一模块，控制 ref-check 的行数规模。
 * 范围：C3 阈值一致性、C6 门号一致性——两者均以治理技能与主技能中的权威节为源，比对其他位置的副本；
 *   C9 守卫编号一致性按废弃处置，只报不适用（守卫表权威在 docs/ 排除集内，仓库内无非排除权威）。
 * 不包含：引用形态（见 ref-refs.js）、冻结短语（见 ref-phrases.js）、阶段键（见 ref-stages.js）、规范读取面（见 spec-doc.js）、命令行入口。不引入第三方依赖。
 */

const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./text.js");
const { sectionInText } = require("./spec-doc.js");

// 阈值权威源：代码类阈值在 governance-code，文档类阈值在 governance-document；两文件为定义处，不参与副本扫描
const THRESHOLD_AUTHORITY_RELS = [
  ["skills", "governance-code", "SKILL.md"],
  ["skills", "governance-document", "SKILL.md"],
];
// 阈值对象：对象名在各处用词不一，别名把同义写法归一到同一对象；期望值从权威源按「对象名 + 数字 行」抽取
const THRESHOLD_OBJECTS = [
  { label: "代码文件", source: /(?:代码文件|单文件)[^。\n]*?(\d+)\s*行/, cue: /代码文件|单文件/ },
  { label: "基础或核心模块", source: /(?:基础或核心模块|基础能力|核心模块)[^。\n]*?(\d+)\s*行/, cue: /基础或核心模块|基础|核心/ },
  { label: "文档", source: /(?:设计文档|活文档)[^。\n]*?(\d+)\s*行/, cue: /设计文档|活文档|文档/ },
];
// 门号权威源：主技能 SKILL.md 的门禁表；门号只是标识，集合以该表为准
const MAIN_SKILL_REL = ["skills", "ddd-methodology", "SKILL.md"];

function createConstantChecks(env) {
  const { root, relPath, liveDocPaths } = env;

  // C3 阈值一致性：阈值以治理类技能的阈值句为唯一权威，其余出现处须同值且承载正确对象语义
  function readThresholdRules() {
    const rels = THRESHOLD_AUTHORITY_RELS.map((parts) => parts.join("/"));
    const authorityText = THRESHOLD_AUTHORITY_RELS.map((parts) => readFileText(path.join(root, ...parts))).join("\n");
    const rules = [];
    for (const object of THRESHOLD_OBJECTS) {
      const m = authorityText.match(object.source);
      if (!m) return { rels, invalid: true };
      rules.push({ label: object.label, token: `${m[1]} 行`, cue: object.cue });
    }
    return { rels, rules };
  }
  function checkThresholds() {
    const parsed = readThresholdRules();
    if (parsed.invalid) {
      return [drift("C3", THRESHOLD_AUTHORITY_RELS[0].join("/"), 0, "阈值权威源须给出各档阈值锚点句，三档均可解析", "三档阈值锚点句", "锚点句不可解析")];
    }
    const authorityRels = new Set(parsed.rels);
    const found = [];
    for (const file of liveDocPaths) {
      const rel = relPath(file);
      if (authorityRels.has(rel)) continue;
      for (const row of withLineNumbers(readFileText(file))) {
        if (!/\d+\s*行/.test(row.line)) continue;
        for (const rule of parsed.rules) {
          const mentioned = row.line.includes(rule.token);
          const cued = rule.cue.test(row.line);
          if (mentioned === cued) continue;
          found.push(drift("C3", rel, row.no, mentioned ? `阈值 ${rule.token} 的上下文须承载对象语义「${rule.label}」` : `含「${rule.label}」的阈值行须与权威同值，权威为 ${rule.token}`, mentioned ? `对象语义 ${rule.label}` : `含 ${rule.token}`, row.line.trim()));
        }
      }
    }
    return found;
  }

  // C6 门号一致性：文档中出现的门号须属于主技能门禁表定义的门号集合
  function extractGateIds() {
    const section = sectionInText(readFileText(path.join(root, ...MAIN_SKILL_REL)), "门禁");
    const ids = new Set();
    for (const row of (section ? section.body : "").split("\n")) {
      if (!row.trim().startsWith("|")) continue;
      for (const cell of row.split("|")) {
        const value = cell.replace(/[`*\s]/g, "");
        if (/^G\d+(?:\.\d+|-INT)?$/.test(value)) ids.add(value);
      }
    }
    return ids.size ? ids : null;
  }
  function checkGateIds() {
    const gateIds = extractGateIds();
    if (!gateIds) return [drift("C6", MAIN_SKILL_REL.join("/"), 0, "主技能门禁表须给出门号集合", "门禁表含门号集合", "未解析到")];
    const allowed = [...gateIds].join("/");
    const found = [];
    for (const file of liveDocPaths) {
      for (const row of withLineNumbers(readFileText(file))) {
        for (const m of row.line.matchAll(/(?<![\w-])G\d+(?:\.\d+|-INT)?(?![\w-])/g)) {
          if (!gateIds.has(m[0])) found.push(drift("C6", relPath(file), row.no, "门号须属于主技能门禁表定义的门号集合", `门号属于 ${allowed}`, m[0]));
        }
      }
    }
    return found;
  }

  // C9 守卫编号一致性：守卫表的权威在 DESIGN-extensions.md，该文件位于 ref-check 的排除集 docs/ 内，仓库内无第二个非排除权威；
  // 按废弃处置，本项不作判定、不产漂移，保留编号使既有引用不漂移，并显式报不适用
  function checkGuardIds() {
    process.stdout.write("[C9 不适用] 守卫表权威为 DESIGN-extensions.md（位于 ref-check 排除集 docs/ 内），仓库内无非排除权威，本校验项按废弃处置\n");
    return [];
  }

  return { checkThresholds, checkGateIds, checkGuardIds };
}

module.exports = { createConstantChecks };
