/**
 * 目标：把 ref-check 的冻结短语校验与其锚点清单外置为单一模块，使短语清单与校验判据同处一地。
 * 范围：C8 冻结短语一致性——按空白规范化后逐字比对；锚点清单与豁免串随本模块维护。
 * 不包含：引用形态（见 ref-refs.js）、常量集合（见 ref-constants.js）、阶段键（见 ref-stages.js）、规范读取面（见 spec-doc.js）、命令行入口。不引入第三方依赖。
 */

const { readFileText, withLineNumbers, drift } = require("./text.js");

// 冻结短语的锚点用于检出改写：命中锚点却未逐字含短语即判漂移；豁免串是合法的同族短语；
// 存量重建节六条锚点取该短语独有片段，避免命中措辞相近的载体行。
// 阈值锚点不入此清单：其一致性由 C3 按承载语义校验，若两处同校会因合法子集引用产生互斥误报。
const FROZEN_PHRASES = [
  { phrase: "这个任务是只读的吗", anchors: ["任务是只读的"], exempt: [] },
  { phrase: "派发类型不匹配", anchors: ["派发类型不"], exempt: [] },
  { phrase: "记录被触碰文件的改动前后规模、是否拆解与依据的粒度预判", anchors: ["被触碰文件的改动前后规模"], exempt: [] },
  { phrase: "全量测试的唯一主体是 ddd-tester", anchors: ["唯一主体是"], exempt: [] },
  { phrase: "RESULT: pass", anchors: ["RESULT:"], exempt: ["RESULT: gap", "RESULT: report", "RESULT: drift"] },
  // 该短语在规范入口、仓库说明与全局规则三处并存；anchor 须整句前缀，短锚点会命中措辞不同的其他行而误报
  { phrase: "只读的探查、调研、方案比选、环境勘察、资料检索，一律派 scout", anchors: ["只读的探查、调研、方案比选、环境勘察、资料检索"], exempt: [] },
  { phrase: "触发时机由人工判断，落在入口", anchors: ["触发时机由人工判断"], exempt: [] },
  { phrase: "丢弃是相对旧版本的丢弃，不是绝对丢失", anchors: ["丢弃是相对旧版本的丢弃"], exempt: [] },
  { phrase: "对外契约；经审计确认仍然成立的设计决策；仍在被消费的能力", anchors: ["经审计确认仍然成立的设计决策"], exempt: [] },
  { phrase: "未列入废弃清单而实际不再使用的产物，视为静默保留，属缺陷", anchors: ["未列入废弃清单而实际不再使用的产物"], exempt: [] },
  // 废弃清单类别短语的载体在 templates-rebuild.md；锚点取含顿号分隔的独有片段，避免命中规范 17.5 中以「与」连接的措辞相近行
  { phrase: "架构、代码、测试、文档、配置", anchors: ["代码、测试、文档、配置"], exempt: [] },
  { phrase: "行为等价性以 AC 全量回归验证，不得以子集用例证明等价", anchors: ["行为等价性以 AC 全量回归验证"], exempt: [] },
];

function createPhraseChecks(env) {
  const { relPath, liveDocPaths } = env;

  function checkFrozenPhrases() {
    const found = [];
    const flatten = (text) => String(text || "").replace(/\s+/g, "");
    for (const entry of FROZEN_PHRASES) {
      const phrase = flatten(entry.phrase);
      let occurrences = 0;
      for (const file of liveDocPaths) {
        for (const row of withLineNumbers(readFileText(file))) {
          const flat = flatten(row.line);
          if (flat.includes(phrase)) {
            occurrences++;
            continue;
          }
          if (!entry.anchors.some((anchor) => flat.includes(flatten(anchor)))) continue;
          if (entry.exempt.some((sibling) => flat.includes(flatten(sibling)))) continue;
          found.push(drift("C8", relPath(file), row.no, "冻结短语须逐字一致", `逐字含「${entry.phrase}」`, row.line.trim()));
        }
      }
      if (!occurrences) found.push(drift("C8", "活文档", 0, "冻结短语须在其载体文档中至少逐字出现一次", `出现「${entry.phrase}」`, "未检出"));
    }
    return found;
  }

  return { checkFrozenPhrases };
}

module.exports = { createPhraseChecks };
