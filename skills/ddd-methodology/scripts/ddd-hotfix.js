/**
 * DDD-Methodology B 快速修复编排脚本
 *
 * 目标：把「已定位缺陷的快速修复」固定编排为探查、缺陷修复、测试执行三段，交接为探查交出定位结论、
 *   修复段按定位结论与缺陷条目修复、测试段回测并在未过时把 C 与 D 两级缺陷退回修复段重跑。
 * 范围：B 快速修复通道三个阶段的编排与阶段推进、断点续跑、C 与 D 两级缺陷的自动修复轮次。
 *   本脚本只做编排、不做机械校验：校验的实现与判定在 skills/ddd-methodology/scripts 下各机械证据脚本，由根会话经工具执行。
 * 不包含：A 主链与 C 自维护通道（A 见同目录 ddd-workflow.js）、各代理提示词、缺陷四级定级的判断实现。
 * 运行时例外：本文件受 pi workflow 沙箱约束，无 require 与 fs，只能单文件，故不适用规范「粒度与独立性」节的拆分要求；
 *   文件头声明「运行时例外」供 H-1 守卫放行，单一能力域为阶段编排，辅助函数内聚于本文件。
 *
 * 用法：根会话中调用
 *   subagent({ workflow: "<包根>/skills/ddd-methodology/scripts/ddd-hotfix.js", args: { root: "<项目根绝对路径>" } })
 *   沙箱无 process 全局，唯一合法的数据通道是冻结的 args。
 *
 * 阶段键与状态 schema：与 ddd-workflow.js 共用同一阶段键集与状态 schema，只按通道取各自键序。
 *   本脚本的 stageRegistry 与 ddd-workflow.js 的 stageRegistry 逐键同集；状态 schema 五字段为 channel、doneStages、lastStage、status、freezeAnchor。
 *   B 通道键序为 probe、defect-fix、test-execute，三键互不混用。
 *
 * 断点续跑：状态文件由各阶段代理写入/更新；本脚本启动时由 scout 只读检查并按契约输出 DONE: <键> 机读行，已完成阶段自动跳过。
 *   channel 与本次通道不符即中断，防跨通道误续跑；文件损坏即中断交根会话，不得当作全新启动。
 *
 * 缺陷路由策略：
 *   - C（实现级）：派发 ddd-fixer 修复 → 重测
 *   - D（测试级）：派发 ddd-fixer 修计划 → 重测
 *   - A（需求级）/ B（设计级）：不在脚本内自动处理，立即中断返回；B 级须转主链分解设计节点，A 级须升级用户确认
 *   - 同一问题累计修复轮次超过 maxFixRounds 仍失败 → 中断返回根会话升级用户
 *
 * 沙箱可用对象：runs.run、runs.all、runs.lanes、runs.steer、runs.status、runs.ref、emit、console、args。
 *   runs.parallel 与 runs.chain 不存在，属已废弃的旧顶层 API，误用即报 not a function，写此以免复踩。
 */

const root = args && args.root ? String(args.root) : null;
if (!root) {
  throw new Error("缺少 args.root：请通过 subagent({ workflow: ..., args: { root: \"<项目根绝对路径>\" } }) 传入项目根。");
}
const CHANNEL = "B";
const maxFixRounds = args && Number.isFinite(Number(args.maxFixRounds))
  ? Math.max(0, Number(args.maxFixRounds))
  : 2; // 方法论约定：轮回修复超过 2 轮强制升级用户
const stateFile = `${root}/docs/.ddd-state.json`;

// 阶段键全集：与 ddd-workflow.js 的 stageRegistry 逐键同集，仅键序不同（本脚本不把它作 C4 受控副本，故不单独登记）。
const stageRegistry = [
  "requirements", "architect", "check-scope", "acceptance", "decomposer",
  "check-design", "detail-design", "check-file-design", "interface-review",
  "implement", "test-plan", "check-code", "g5-int", "test-execute",
  "check-consistency", "defect-fix", "audit", "probe", "self-design",
  "self-write", "doc-sync",
];
// 本脚本实际消费的 B 通道键序；三键均取自 stageRegistry
const B_STAGES = ["probe", "defect-fix", "test-execute"];

for (const key of B_STAGES) {
  if (!stageRegistry.includes(key)) throw new Error(`B 通道键 ${key} 不在共用阶段键集内，键集与键序不一致。`);
}

/**
 * 读取断点状态：由 scout 执行只读检查。
 * 契约：报告必须逐行输出机读行 "DONE: <stageKey>"（每个已完成阶段一行）与一行 "CHANNEL: <通道值>"；
 * JSON 损坏时输出 "STATE_CORRUPT" 并停止。
 */
async function readResumeState() {
  const r = await runStage("ddd-resume-check", {
    label: "读取断点状态",
    agent: "scout",
    task: `只读检查 ${stateFile}（断点状态文件，schema 五字段：channel 字符串 / doneStages 数组 / lastStage / status / freezeAnchor 对象）。
规则：
1. 若文件存在且 JSON 有效：对 doneStages 数组中每个阶段键，输出一行机读行 "DONE: <阶段键>"（格式严格为 DONE: 空格 阶段键，如 "DONE: defect-fix"）；另输出一行 "CHANNEL: <channel 值>"；再报告 lastStage 与 status 字段值。然后停止，不写任何文件。
2. 若文件存在但 JSON 损坏/不可解析：输出 "STATE_CORRUPT" 并停止，不得当全新启动处理。
3. 若文件不存在：输出 "NO_STATE_FILE"，报告全新启动。
禁止修改任何文件。`,
  });
  if (r && r.__failed) {
    throw new Error("断点检查阶段执行失败：" + (r.error || "未知错误") + "。" + (r.hint || ""));
  }
  return r;
}

// 从报告文本解析已完成阶段（依赖 readResumeState 契约输出的 "DONE: <stage>" 机读行）
function parseDoneStages(reportText) {
  const text = String(reportText || "");
  if (/STATE_CORRUPT/.test(text)) {
    throw new Error("断点状态文件损坏（STATE_CORRUPT）：请人工检查 " + stateFile + " 后决定删除重跑或手工修复。");
  }
  if (/NO_STATE_FILE/.test(text)) return [];
  const done = [];
  for (const m of text.matchAll(/DONE:\s*([a-z0-9-]+)/gi)) done.push(m[1]);
  return done;
}

// 从报告文本解析通道值（依赖 readResumeState 契约输出的 "CHANNEL: <值>" 机读行）；缺行回 null
function parseChannel(reportText) {
  const m = String(reportText || "").match(/CHANNEL:\s*([A-Za-z])/);
  return m ? m[1].toUpperCase() : null;
}

// 状态更新指令：注入到阶段任务末尾；channel 固定取本通道，freezeAnchor 保留已有值。
function stateNote(stageKey, alsoDone) {
  const keys = [stageKey].concat(alsoDone || []);
  const list = keys.map((k) => `"${k}"`).join(", ");
  return `\n\n【状态记录】完成后更新 ${stateFile}：追加/合并 JSON 字段 {"channel":"${CHANNEL}","lastStage":"${stageKey}","status":"done"}，doneStages 数组补齐 ${list}，freezeAnchor 保留已有值不变。文件不存在则据此初始化（channel 固定为 ${CHANNEL}，freezeAnchor 按设计文档树的冻结清单补齐）。`;
}

// 统一的阶段执行包装：失败时返回结构化结果而非裸抛，保留阶段名/轮次/状态文件路径供根会话断点接管。
async function runStage(key, params, meta) {
  try {
    return await runs.run(key, params);
  } catch (e) {
    return {
      __failed: true,
      status: "failed",
      failedStage: (meta && meta.stage) || key,
      round: (meta && meta.round) || null,
      stateFile,
      error: String((e && e.message) || e),
      hint: "根会话可依据 stateFile 的 doneStages 断点接管：修复问题后重新启动 workflow，已完成阶段将自动跳过。",
    };
  }
}

// 缺陷摘要：从测试报告的缺陷路由单区段按条目提取，取代按关键词过滤整篇报告行。
function defectSummaryFrom(reportText) {
  const text = String(reportText || "");
  const head = text.match(/^#{1,6}\s*[^\n]*缺陷路由[^\n]*$/m) || text.match(/^\*\*[^\n]*缺陷路由[^\n]*\*\*\s*$/m);
  if (!head) return text.slice(-1500);
  const body = text.slice(head.index + head[0].length);
  const boundary = body.match(/^#{1,6}\s+(?!缺陷)[^\n]*$/m);
  const section = (boundary ? body.slice(0, boundary.index) : body).trim();
  if (!section) return text.slice(-1500);
  let items = section.split(/\n(?=#{1,6}\s)/).map((s) => s.trim()).filter(Boolean);
  if (items.length <= 1) items = section.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const cap = 15;
  const kept = items.slice(0, cap);
  const note = items.length > cap ? `\n（已截断：共 ${items.length} 条，仅列前 ${cap} 条）` : "";
  return kept.join("\n\n") + note;
}

// 从报告文本解析缺陷级别。优先机读行 "DEFECTS: {...}"；机读行缺失或损坏即按格式缺陷中断，不猜测。
function extractDefects(reportText) {
  const text = String(reportText || "");
  const found = { A: 0, B: 0, C: 0, D: 0, unresolved: false };
  const mr = text.match(/DEFECTS:\s*(\{[\s\S]*?\})\s*(?:\n|$)/);
  if (!mr) {
    throw new Error("测试报告缺少机读行 DEFECTS:{...}：按格式缺陷中断，请重新派发 ddd-tester 产出合规报告（含机读行）。");
  }
  let j = null;
  try { j = JSON.parse(mr[1]); } catch (e) { j = null; }
  if (!j || typeof j !== "object") {
    throw new Error("测试报告机读行 DEFECTS JSON 损坏：按格式缺陷处理，请重新派发 ddd-tester 产出合规报告。");
  }
  for (const k of ["A", "B", "C", "D"]) found[k] = Number(j[k]) || 0;
  if (found.A + found.B + found.C + found.D > 0) { found.unresolved = true; return found; }
  found.unresolved = j.unresolved === true;
  return found;
}

// 演进上下文：从上轮修复输出中提取"已尝试方案"，从测试报告中提取缺陷条目，注入下轮任务防失忆打转
function buildFixCtx(round, reportText, fixText) {
  const defectSummary = defectSummaryFrom(reportText);
  const fixOut = String(fixText || "");
  const triedMatch = fixOut.match(/已尝试方案[：:]*([\s\S]{0,1200}?)(?=\n#{1,6} |$)/);
  const triedNote = triedMatch
    ? `上一轮已尝试且失败的方案（本轮禁止重复，必须换路径）：\n${triedMatch[1]}`
    : `上一轮未提供已尝试方案记录（首轮或上轮未按格式输出），请自行分析后选择实现路径，并在输出中包含"已尝试方案"节。`;
  return { round, defectSummary, triedNote };
}

// 修复段任务：首轮以探测定位结论为输入，其后各轮以缺陷路由单条目为输入。
function fixTaskFor(round, ctx, probeReport) {
  const input = round === 1
    ? `本轮依据探查段的定位结论修复：\n${String(probeReport || "（探查段未提供定位结论）").slice(-4000)}`
    : `本轮必须修复的缺陷条目：\n${ctx.defectSummary}`;
  return `在项目根 ${root} 执行快速修复（B 通道，缺陷修复段，第 ${ctx.round} 轮，剩余自动修复机会 ${maxFixRounds - ctx.round + 1} 次，超限将升级用户）。

${input}

${ctx.triedNote}

修复要求：
1. 按就近 DESIGN.md 逐条修复，只修代码不改设计；接口节将非空即属设计级，停止并报告 B 级缺陷转主链。
2. 禁止重复已尝试且失败的方案，必须换实现路径或根因分析方法。
3. 修复后仅自测所负责接缝的相关用例，禁止执行全量测试套件，全量重测由 ddd-tester 负责。
4. 输出必须包含两节：修复清单（条目→改动摘要）与已尝试方案（本轮尝试的路径及结果，供下一轮排除）。`;
}

// —— 断点检查 ——
const resumeReport = await readResumeState();
let doneStages = parseDoneStages(resumeReport);
const resumeChannel = parseChannel(resumeReport);
if (resumeChannel && resumeChannel !== CHANNEL) {
  throw new Error(
    `状态文件 channel 为 ${resumeChannel}，与本脚本通道 ${CHANNEL} 不符：中断续跑并交根会话，不得跨通道误续跑。`,
  );
}
const validDoneStages = doneStages.filter((k) => B_STAGES.includes(k));
if (validDoneStages.length !== doneStages.length) {
  throw new Error(
    "状态文件 doneStages 含非 B 通道阶段键：" +
      doneStages.filter((k) => !B_STAGES.includes(k)).join(", ") +
      "。B 通道键序见 references/spec-govern.md 的键清单。",
  );
}
doneStages = validDoneStages;

// 本轮实际未执行的阶段及原因：断点已完成者与升级中断者都记入，供根会话分清「已做完」与「没做」
const skippedStages = [];

// —— 探查段（入口判据命中通道 B，由外部探查者承接） ——
let probeReport = null;
if (doneStages.includes("probe")) {
  skippedStages.push({ stage: "probe", reason: "断点记录该阶段已完成，本轮跳过" });
} else {
  const r = await runStage("ddd-probe", {
    label: "探查缺陷定位",
    agent: "scout",
    task: `在项目根 ${root} 只读探查已报告的缺陷：结合症状与相关代码，给出根因定位结论、影响面与建议定级（D 测试级 / C 实现级 / B 设计级 / A 需求级）。外链不可达时标注待核验而非重试。不修改任何文件。`,
  }, { stage: "probe" });
  if (r && r.__failed) return r;
  probeReport = r;
}

// —— 缺陷修复与测试执行的循环（C/D 两级自动修复；两轮上限共用缺陷回路计数语义） ——
let round = 0;
let lastReport = null;
let lastFixOutput = null;
let escalated = null;

// 修复段先行：B 通道以 defect-fix 为入口，其后回测。
// 超限判定先于该轮修复派发：第 round 轮一旦超出 maxFixRounds 即不再派发修复而直接升级，
// 故实发修复轮数不超过 maxFixRounds（耗尽轮次时恰为 maxFixRounds），
// 各轮任务文本的「剩余自动修复机会」不低于 1，且超限文案与 maxFixRounds 同源，不会再各说各话。
while (true) {
  round += 1;

  if (round > maxFixRounds) {
    escalated = {
      reason: "修复轮次超限",
      detail: `同一问题累计 ${maxFixRounds} 轮自动修复仍未解决，按方法论约定强制升级用户。`,
      round,
    };
    break;
  }

  const fixCtx = buildFixCtx(round, lastReport, lastFixOutput);
  const fixRun = await runStage("ddd-defect-fix-r" + round, {
    label: `缺陷修复（第${round}轮）`,
    agent: "ddd-fixer",
    task: fixTaskFor(round, fixCtx, probeReport) + (round === 1 ? stateNote("defect-fix", ["probe"]) : stateNote("defect-fix")),
  }, { stage: "defect-fix", round });
  if (fixRun && fixRun.__failed) return fixRun;
  lastFixOutput = typeof fixRun === "string" ? fixRun : JSON.stringify(fixRun);

  lastReport = await runStage("ddd-test-execute-r" + round, {
    label: `执行测试并定级路由（第${round}轮）`,
    agent: "ddd-tester",
    task: `【快速修复通道——你与修复者不同段】按 ${root}/docs/test/ 测试计划树执行测试（第 ${round} 轮）：只照抄执行计划中"执行命令（含超时）"字段，禁止裸跑。产出测试报告与缺陷路由单，报告末尾必须含机读行 "DEFECTS: {\"A\":n,\"B\":n,\"C\":n,\"D\":n,\"unresolved\":bool}"（判定自检按 D→C→B→A 顺序，默认最低层）。` + stateNote("test-execute"),
  }, { stage: "test-execute", round });
  if (lastReport && lastReport.__failed) return lastReport;

  const defects = extractDefects(lastReport);

  // 全部通过：正常结束
  if (!defects.unresolved) break;

  // A/B 级：不在脚本内自动处理，立即中断交根会话（B 级须转主链分解设计节点）
  if (defects.A > 0 || defects.B > 0) {
    escalated = {
      reason: defects.A > 0 ? "A级缺陷（需求级）" : "B级缺陷（设计级）",
      detail: defects.A > 0
        ? "A 级缺陷须经用户确认后回需求采集节点，快速通道不适用，中断交根会话。"
        : "B 级缺陷的接口节定向 diff 将非空，须转主链分解设计节点并同步 AC，快速通道不适用，中断交根会话。",
      round,
    };
    break;
  }

  // 循环继续 → 下一轮修复与回测；若已无剩余轮次，下一轮由循环首部的超限判定升级
}

return {
  status: escalated ? "已中断，需根会话仲裁" : "workflow 完成",
  rounds: round,
  resumedFrom: doneStages,
  stateFile,
  escalated,
  probeReport,
  lastReport,
  skippedStages,
  note: "escalated 非空时，根会话须依据缺陷四级路由节处理对应级别缺陷或升级用户（B 级转主链，A 级升级用户）；skippedStages 列出本轮未执行的阶段与原因；状态文件支持断点续跑。",
};
