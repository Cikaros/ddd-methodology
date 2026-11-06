/**
 * 目标：把判据由顶层脚本提供的五项校验接入注册表——使其与各域校验项同形，装配处无须为它们各写一条装配语句。
 * 范围：C5 代理清单一致性、C10 判定表默认分支、C11 skill 清单一致性、C12 规范索引表一致性、C25 矩阵与技能清单一致性；
 *   五项判据的实现在顶层脚本 roster-check.js、decision-tables.js、spec-index-check.js 与同目录 matrix.js，本模块只做契约包装与上下文转接。
 * 不包含：五项判据本体、活文档遍历、命令行入口。不引入第三方依赖。
 * 依赖方向：lib 校验模块委托顶层脚本的判据，故本模块 require ../ 下三个库与 ./matrix.js；顶层脚本不反向依赖本模块。
 */

const path = require("path");
const { readFileText } = require("./text.js");
const { SPEC_INDEX_REL } = require("./spec-doc.js");
const { checkAgentRoster, checkSkillRoster } = require("../roster-check.js");
const { checkJudgmentDefault } = require("../decision-tables.js");
const { checkSpecIndex } = require("../spec-index-check.js");
const { checkMatrix } = require("./matrix.js");

// 契约与各域校验项同形：run 只做上下文转接，判据仍由顶层脚本给出
const CONTRACTS = [
  { id: "C5", name: "代理清单一致性", domain: "external", run: (ctx) => checkAgentRoster(ctx.root) },
  {
    id: "C10",
    name: "判定表默认分支",
    domain: "external",
    run: (ctx) => checkJudgmentDefault(ctx.liveDocPaths.map(ctx.relPath), (rel) => readFileText(path.join(ctx.root, rel))),
  },
  { id: "C11", name: "skill 清单一致性", domain: "external", run: (ctx) => checkSkillRoster(ctx.root) },
  {
    id: "C12",
    name: "规范索引表一致性",
    domain: "external",
    run: (ctx) => checkSpecIndex(ctx.root, ctx.spec.docs.map((doc) => doc.rel), SPEC_INDEX_REL),
  },
  { id: "C25", name: "矩阵与技能清单一致性", domain: "external", run: (ctx) => checkMatrix(ctx.root) },
];

module.exports = { contracts: CONTRACTS };
