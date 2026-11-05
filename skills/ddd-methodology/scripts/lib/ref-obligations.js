/**
 * 目标：把义务核销的三组取值域在规范、模板与抽取器常量三处的一致性外化为机械判据。
 * 范围：C20 义务取值域一致性——类型、确定度与状态三组取值三方互比，规范「接口先行与冻结」节的义务核销条为源。
 * 不包含：条目抽取与核销断言（见 obligations.js）、命令行入口。不引入第三方依赖。
 */

const path = require("path");
const { readFileText, drift } = require("./text.js");

const SPEC_REL = "skills/ddd-methodology/references/spec-design.md";
const TEMPLATE_REL = "skills/ddd-methodology/references/templates-gates.md";
const IMPL_REL = "skills/ddd-methodology/scripts/lib/obligations.js";
// 规范与模板的同一句形态：类型取 A、B 四值；确定度取 C、D 两值；状态取 E、F 五值
const PROSE_RE = /类型取([^；。]+)；确定度取([^；。]+)；状态取([^；。]+)/;

const splitValues = (text) =>
  String(text)
    .replace(/[零一二两三四五六七八九十百\d]+值/g, "")
    .split("、")
    .map((item) => item.replace(/[`*\s]/g, "").trim())
    .filter(Boolean);

function readProseValues(text) {
  const m = String(text).match(PROSE_RE);
  if (!m) return null;
  return { type: splitValues(m[1]), definite: splitValues(m[2]), state: splitValues(m[3]) };
}

function readSetLiteral(text, name) {
  const m = String(text).match(new RegExp(`const\\s+${name}\\s*=\\s*new\\s+Set\\(\\[([\\s\\S]*?)\\]\\)`));
  return m ? [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]) : null;
}

const sorted = (list) => [...list].sort().join("、");

function createObligationChecks(env) {
  const { root } = env;

  function checkObligationValues() {
    const spec = readProseValues(readFileText(path.join(root, ...SPEC_REL.split("/"))));
    const tmpl = readProseValues(readFileText(path.join(root, ...TEMPLATE_REL.split("/"))));
    const implText = readFileText(path.join(root, ...IMPL_REL.split("/")));
    const impl = {
      type: readSetLiteral(implText, "TYPE_VALUES"),
      definite: readSetLiteral(implText, "DEFINITE_VALUES"),
      state: readSetLiteral(implText, "STATE_VALUES"),
    };
    if (!spec || !tmpl || !impl.type || !impl.definite || !impl.state) {
      return [drift("C20", SPEC_REL, 0, "规范义务核销条、任务树模板与抽取器常量三处须均可解析出取值域", "三处均可解析", "解析不全")];
    }
    const found = [];
    const pairs = [
      ["类型与模板", spec.type, tmpl.type],
      ["确定度与模板", spec.definite, tmpl.definite],
      ["状态与模板", spec.state, tmpl.state],
      ["类型与抽取器", spec.type, impl.type],
      ["确定度与抽取器", spec.definite, impl.definite],
      ["状态与抽取器", spec.state, impl.state],
    ];
    for (const [label, source, copy] of pairs) {
      if (sorted(source) !== sorted(copy)) {
        found.push(drift("C20", SPEC_REL, 0, `${label}取值域须与规范义务核销条同集`, `与规范一致：${sorted(source)}`, sorted(copy)));
      }
    }
    return found;
  }

  return { checkObligationValues };
}

module.exports = { createObligationChecks };
