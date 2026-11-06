/**
 * 目标：把 ref-check 中阶段键这一域的读取与比对外置为单一模块。
 * 范围：C4 阶段键一致性——以主技能调度模型节的通道表为权威源，双向比对节点全集节按通道聚集的节点键，
 *   并校验 guard 单键属于该集合、规范状态文件节以固定句把 doneStages 键集合绑定到该表；
 *   编排脚本的 stageRegistry 属「编排脚本重建」范围，只作非漂移备注，不计入判定。
 * 不包含：引用形态（见 ref-refs.js）、常量集合（见 ref-constants.js）、冻结短语（见 ref-phrases.js）、规范读取面（见 spec-doc.js）、命令行入口。不引入第三方依赖。
 */

const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./text.js");
const { sectionInText } = require("./spec-doc.js");

// 阶段键权威源：主技能第一节调度模型的通道表；节点全集按通道聚集，状态文件 schema 落在规范状态文件节
const MAIN_SKILL_REL = ["skills", "ddd-methodology", "SKILL.md"];
const STATE_SCHEMA_REL = ["skills", "ddd-methodology", "references", "spec-govern.md"];
const CHANNELS = ["A", "B", "C"];
// 节点键形态：英文 kebab-case，用以从节点表行中取键并跳过表头与分隔行
const NODE_KEY_RE = /^[a-z][a-z0-9-]*$/;
const sorted = (list) => [...list].sort().join("、");

// 表行拆格：竖线分隔，去反引号与首尾空白；表头与分隔行由调用方的键形态判据跳过
function tableRows(section) {
  const rows = [];
  for (const row of withLineNumbers(section.body)) {
    const line = row.line.trim();
    if (!line.startsWith("|")) continue;
    rows.push(line.split("|").slice(1, -1).map((cell) => cell.replace(/`/g, "").trim()));
  }
  return rows;
}

function createStageChecks(env) {
  // guardRel 与 workflowRel 由 ref-check 注入，路径只在调用方定义一次
  const { root, relPath, guardRel, workflowRel } = env;

  function mainSkillSection(title) {
    return sectionInText(readFileText(path.join(root, ...MAIN_SKILL_REL)), title);
  }
  // 权威阶段键：主技能通道表的阶段键列，按通道回传；表行首格形如「A 主链」
  function readAuthorityStageKeys() {
    const section = mainSkillSection("调度模型");
    if (!section) return null;
    const channels = {};
    for (const cells of tableRows(section)) {
      const m = cells[0] && cells[0].match(/^([ABC])\b/);
      if (!m) continue;
      const keys = (cells[cells.length - 1] || "").split("、").map((s) => s.trim()).filter(Boolean);
      if (keys.length) channels[m[1]] = keys;
    }
    return Object.keys(channels).length ? channels : null;
  }
  // 节点全集：主技能节点表按通道聚集节点键，通道列为「A」「A 与 B」等，含通道字母即计入
  function readChannelNodes() {
    const section = mainSkillSection("节点全集");
    if (!section) return null;
    const channels = { A: [], B: [], C: [] };
    for (const cells of tableRows(section)) {
      const key = cells[0];
      const channel = cells[1] || "";
      if (!NODE_KEY_RE.test(key)) continue;
      for (const ch of CHANNELS) if (channel.includes(ch)) channels[ch].push(key);
    }
    return channels;
  }
  // guard 单键：G5_INT_STAGE 的值须属于权威阶段键集合
  function readGuardKey() {
    const m = readFileText(path.join(root, ...guardRel)).match(/G5_INT_STAGE\s*=\s*"([^"]+)"/);
    return m ? m[1] : null;
  }
  // 状态文件 schema：规范状态文件节须含 doneStages 固定句，且该句绑定到主技能的阶段键表
  function readStateSchemaBinding() {
    const rel = STATE_SCHEMA_REL.join("/");
    const section = sectionInText(readFileText(path.join(root, ...STATE_SCHEMA_REL)), "状态文件");
    if (!section) return { ok: false, rel, reason: "状态文件节未找到" };
    const lines = section.body.split("\n").filter((l) => /doneStages/.test(l));
    if (!lines.length) return { ok: false, rel, reason: "doneStages 固定句未找到" };
    const ok = lines.some((l) => /SKILL\.md/.test(l) && /阶段键/.test(l));
    return { ok, rel, reason: "doneStages 固定句未绑定主技能阶段键表" };
  }
  // 编排脚本阶段注册表：仅作非漂移备注，属「编排脚本重建」范围，不参与本项判定
  function workflowRegistryDiff(authorityKeys) {
    const block = readFileText(path.join(root, ...workflowRel)).match(/const\s+stageRegistry\s*=\s*\[[\s\S]*?\]/);
    if (!block) return null;
    const registry = [...block[0].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    return registry.filter((key) => !authorityKeys.has(key));
  }
  function checkStageKeys() {
    const found = [];
    const channels = readAuthorityStageKeys();
    if (!channels) {
      found.push(drift("C4", MAIN_SKILL_REL.join("/"), 0, "主技能调度模型节须以通道表列出 A/B/C 三通道的阶段键", "三通道阶段键可解析", "未解析到"));
      return found;
    }
    const nodes = readChannelNodes();
    if (!nodes) {
      found.push(drift("C4", MAIN_SKILL_REL.join("/"), 0, "主技能节点全集节须按通道列出节点键供比对", "节点全集可解析", "未解析到"));
    } else {
      for (const ch of CHANNELS) {
        const keys = channels[ch] || [];
        if (sorted(keys) !== sorted(nodes[ch])) found.push(drift("C4", MAIN_SKILL_REL.join("/"), 0, `${ch} 通道的阶段键集合须与节点全集该通道的节点键集合同集`, `阶段键：${sorted(keys)}`, `节点键：${sorted(nodes[ch])}`));
      }
    }
    const authorityKeys = new Set(Object.values(channels).flat());
    const guardKey = readGuardKey();
    if (!guardKey) found.push(drift("C4", guardRel.join("/"), 0, "guard 单键须可解析且属于权威阶段键集合", "G5_INT_STAGE 常量", "未解析到"));
    else if (!authorityKeys.has(guardKey)) found.push(drift("C4", guardRel.join("/"), 0, "guard 单键须属于权威阶段键集合", `guard 键属于 ${[...authorityKeys].join("/")}`, guardKey));
    const schema = readStateSchemaBinding();
    if (!schema.ok) found.push(drift("C4", schema.rel, 0, "规范状态文件节须以固定句把 doneStages 键集合绑定到主技能阶段键表", "含 doneStages 且绑定主技能阶段键表", schema.reason));
    const legacy = workflowRegistryDiff(authorityKeys);
    if (legacy && legacy.length) process.stdout.write(`[C4 备注] 编排脚本 stageRegistry 含非权威阶段键 ${legacy.join("、")}，属「编排脚本重建」范围，不计入本项漂移\n`);
    return found;
  }

  return { checkStageKeys };
}

// 注册表契约：id、简名与所属域随本模块声明；run 只转接本模块工厂的对应判据，装配处不掌握判据内容
module.exports = {
  contracts: [{ id: "C4", name: "阶段键一致性", domain: "stages", run: (ctx) => createStageChecks(ctx).checkStageKeys() }],
};
