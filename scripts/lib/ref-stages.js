/**
 * 目标：把 ref-check 中阶段键这一域的读取与比对外置为单一模块，使 C4 与 --fix 生成共用同一解析。
 * 范围：C4 阶段键三方一致性（spec 键清单、workflow 阶段注册表、guard 单键）、阶段注册表文本渲染、三处副本的读取入口。
 * 不包含：引用形态（见 ref-refs.js）、常量集合（见 ref-constants.js）、冻结短语（见 ref-phrases.js）、规范读取面（见 spec-doc.js）、命令行入口。不引入第三方依赖。
 */

const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./text.js");

function createStageChecks(env) {
  // workflowRel 与 guardRel 由 ref-check 注入，路径只在调用方定义一次
  const { root, relPath, spec, workflowRel, guardRel } = env;

  function extractSpecStageKeys() {
    const section = spec.findSection("状态文件");
    if (!section) return null;
    if (section.ambiguous) return { ambiguous: section.hits };
    for (const row of withLineNumbers(section.body)) {
      if (!/doneStages/.test(row.line)) continue;
      const m = row.line.match(/[:：]\s*(`?[a-z][a-z0-9-]*`?(?:\s*、\s*`?[a-z][a-z0-9-]*`?)+)/);
      if (m) return { keys: m[1].split("、").map((s) => s.replace(/[`\s]/g, "")), line: section.line + row.no, rel: section.rel };
    }
    return null;
  }
  // 三处副本的唯一读取入口：C4 与 --fix 共用，不得另立解析
  function readStageKeySources() {
    const workflowPath = path.join(root, ...workflowRel);
    const workflowText = readFileText(workflowPath);
    const stageRegistryBlock = workflowText.match(/const\s+stageRegistry\s*=\s*\[[\s\S]*?\]/);
    const stageSpec = extractSpecStageKeys();
    const guard = readFileText(path.join(root, ...guardRel)).match(/G5_INT_STAGE\s*=\s*"([^"]+)"/);
    return {
      workflowPath, workflowText, stageRegistryBlock,
      registryKeys: stageRegistryBlock ? [...stageRegistryBlock[0].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [],
      registryLine: stageRegistryBlock ? workflowText.slice(0, stageRegistryBlock.index).split("\n").length : 0,
      specKeys: stageSpec && !stageSpec.ambiguous ? stageSpec.keys : null, specLine: stageSpec && !stageSpec.ambiguous ? stageSpec.line : 0,
      specRel: stageSpec && !stageSpec.ambiguous ? stageSpec.rel : spec.firstRel(), specAmbiguous: stageSpec && stageSpec.ambiguous ? stageSpec.ambiguous : null,
      guardKey: guard ? guard[1] : null,
    };
  }
  // 三方比对的唯一实现：spec 为源，workflow 与 guard 为受控副本，任一缺失或多出即报漂移
  function compareStageKeys(src) {
    if (!src.specKeys) return [drift("C4", src.specRel, 0, "规范状态文件节须以固定句列出 doneStages 键集合", "spec 键清单", "未解析到")];
    if (!src.registryKeys.length) return [drift("C4", relPath(src.workflowPath), 0, "stageRegistry 须为字符串数组字面量", "可解析的阶段键列表", "未解析到数组")];
    const found = [];
    for (const key of src.specKeys) {
      if (!src.registryKeys.includes(key)) found.push(drift("C4", relPath(src.workflowPath), src.registryLine, "三方键集合须一致", `registry 含键「${key}」`));
    }
    for (const key of src.registryKeys) {
      if (!src.specKeys.includes(key)) found.push(drift("C4", src.specRel, src.specLine, "三方键集合须一致", `spec 键清单含键「${key}」`));
    }
    if (!src.guardKey) found.push(drift("C4", guardRel.join("/"), 0, "guard 单键须可解析且属于 spec 键清单", "G5_INT_STAGE 常量", "未解析到"));
    else if (!src.specKeys.includes(src.guardKey)) found.push(drift("C4", guardRel.join("/"), 0, "guard 单键须属于 spec 键清单", `guard 键属于 ${src.specKeys.join("/")}`, src.guardKey));
    return found;
  }
  function checkStageKeys() {
    if (!spec.docs.length) return spec.missing("C4", "规范状态文件节须给出 doneStages 键集合");
    const src = readStageKeySources();
    if (src.specAmbiguous) return [spec.sectionDrift("C4", "状态文件", src.specAmbiguous)];
    return compareStageKeys(src);
  }
  // 生成 workflow 阶段注册表块：与期望集合逐项且顺序一致；同一输入必得同一文本，保证 --fix 幂等
  function renderStageRegistry(keys) {
    const lines = [];
    let line = "";
    for (const key of keys) {
      const token = `"${key}"`;
      const joined = line ? `${line}, ${token}` : token;
      if (line && joined.length > 74) { lines.push(`  ${line},`); line = token; }
      else line = joined;
    }
    if (line) lines.push(`  ${line},`);
    return `const stageRegistry = [\n${lines.join("\n")}\n]`;
  }

  return { checkStageKeys, readStageKeySources, renderStageRegistry };
}

module.exports = { createStageChecks };
