/**
 * DDD-Methodology 固定阶段编排脚本（可选加速档）
 *
 * 运行时例外：本文件受 pi workflow 沙箱约束，无 require 与 fs，只能单文件，故不适用规范「粒度与独立性」节的文件拆分要求；
 * 为保持在单一能力域内，此处只做流程编排与状态推进，缺陷定级、任务文本构造、状态注入等紧密相关的辅助函数内聚于本文件。
 *
 * 用法：根会话中调用
 *   subagent({ workflow: "<skill目录>/workflows/ddd-workflow.js", args: { root: "<项目根绝对路径>" } })
 * 必须通过 args.root 传入项目根绝对路径——workflow 脚本运行在沙箱中，
 * 没有 process 全局，唯一合法的数据通道就是冻结的 args。
 *
 * 沙箱可用对象：runs.run、runs.all、runs.lanes、runs.steer、runs.status、runs.ref、emit、console、args。
 *   runs.parallel 与 runs.chain 不存在，属已废弃的旧顶层 API，误用即报 not a function；本轮改造中已因此踩坑，
 *   成本以分钟计，写此以免复踩。
 *
 * 前置条件：本脚本用到的 ddd-* 代理须已安装于 ~/.pi/agent/agents/，未安装将导致派发失败，脚本不自建存在性校验；安装状态可用 install.sh --check 或 install.bat --check 自检。
 *
 * 阶段键清单的权威源为 `references/spec-govern.md`「状态文件」节，本脚本的 stageRegistry 须与其一致，由 `scripts/ref-check.js` 的 C4 校验；
 * 阶段流的时序另由 `references/spec-role.md`「角色与交接」节的交接链定义。
 *
 * 实现/测试硬分离：ddd-tester 与 ddd-implementer 永不同段；并行段仅为实现与测试规划。
 *
 * 断点续跑：状态文件由各阶段代理在任务中负责写入/更新 <root>/docs/.ddd-state.json（schema 见规范「状态文件」节）；
 * 本脚本启动时由 scout 只读检查状态文件并按契约输出 DONE: <stageKey> 机读行，已完成阶段自动跳过。
 *
 * 缺陷路由策略：
 *   - C（实现级）：派发 ddd-fixer 修复 → 重测
 *   - D（测试级）：派发 ddd-fixer 修计划 → 重测
 *   - C+D 混合：同时派发两类修复，再统一重测
 *   - A（需求级）/ B（设计级）：不在脚本内自动处理，立即中断返回，
 *     由根会话依据规范「缺陷四级路由」节仲裁路由（A 须升级用户确认）
 *   - 同一问题累计修复轮次超过 maxFixRounds 仍失败 → 中断返回根会话升级用户
 */

const root = args && args.root ? String(args.root) : null;
if (!root) {
  throw new Error("缺少 args.root：请通过 subagent({ workflow: ..., args: { root: \"<项目根绝对路径>\" } }) 传入项目根。");
}
const maxFixRounds = args && Number.isFinite(Number(args.maxFixRounds))
  ? Math.max(0, Number(args.maxFixRounds))
  : 2; // 方法论约定：轮回修复超过 2 轮强制升级用户
const stateFile = `${root}/docs/.ddd-state.json`;

// 阶段注册表：键清单必须与规范「状态文件」节的阶段注册表一致，数组顺序与阶段流一致；
// 串行段/接口评审/G5-INT/首轮测试执行/声明面审计均用 stateNote 写入对应键。
const stageRegistry = [
  "requirements", "acceptance", "architect", "decomposer",
  "interface-review", "implement-plan", "g5-int", "test-execute", "audit",
];

/**
 * 读取断点状态：由 scout 执行只读检查。
 * 契约：报告必须逐行输出机读行 "DONE: <stageKey>"（每个已完成阶段一行），
 * 便于 parseDoneStages 可靠解析；JSON 损坏时输出 "STATE_CORRUPT" 并停止。
 */
async function readResumeState() {
  const r = await runStage("ddd-resume-check", {
    label: "读取断点状态",
    agent: "scout",
    task: `只读检查 ${stateFile}（断点状态文件，字段 schema：doneStages 数组 / lastStage / status）。
规则：
1. 若文件存在且 JSON 有效：对 doneStages 数组中每个阶段键，输出一行机读行 "DONE: <阶段键>"（格式严格为 DONE: 空格 阶段键，如 "DONE: architect"）；并报告 lastStage 与 status 字段值、缺陷摘要。然后停止，不写任何文件。
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

// 从报告文本解析缺陷级别。
// 优先机读行 "DEFECTS: {...}"；机读行存在但解析失败、或计数全 0 但散文给出明确的未解决/未通过声明 → 视为格式缺陷，抛错交根会话，不猜测。
function extractDefects(reportText) {
  const text = String(reportText || "");
  const found = { A: 0, B: 0, C: 0, D: 0, unresolved: false };
  const mr = text.match(/DEFECTS:\s*(\{[\s\S]*?\})\s*(?:\n|$)/);
  if (mr) {
    let j = null;
    try { j = JSON.parse(mr[1]); } catch (e) { j = null; }
    if (!j || typeof j !== "object") {
      throw new Error("测试报告机读行 DEFECTS JSON 损坏：按格式缺陷处理，请重新派发 ddd-tester 产出合规报告。");
    }
    for (const k of ["A", "B", "C", "D"]) found[k] = Number(j[k]) || 0;
    const sum = found.A + found.B + found.C + found.D;
    if (sum > 0) { found.unresolved = true; return found; }
    // 计数全 0：机读行为准，散文仅用于捕获明确矛盾——仅当散文出现明确的未解决/未通过声明（且未被否定/清零）
    // 或带非零计数的失败声明时才判矛盾。合规的零缺陷表述（「本轮无阻塞缺陷」「测试未见失败」「失败项：0」）
    // 语义即无缺陷，不匹配本模式，不触发中断。
    const prose = text.replace(/DEFECTS:\s*\{[\s\S]*?\}\s*(?:\n|$)/g, "");
    const unresolvedClaim =
      /未解决|未通过/.test(prose) &&
      !/(?:无|未见|未见有|不存在|未发现|未有)\s*(?:任何\s*)?(?:未解决|未通过)|(?:未解决|未通过)(?:项|缺陷|用例|问题)?\s*(?:[:：=为是])?\s*(?:0|零|无)|回归未通过项已清零/.test(prose);
    const explicitFailCount = /[1-9]\d*\s*(?:项|个|条|处)\s*失败|失败\s*[:：]\s*[1-9]\d*|\bFAIL(?:ED)?\b\s*[:：]\s*[1-9]\d*/.test(prose);
    if (unresolvedClaim || explicitFailCount) {
      throw new Error("测试报告机读计数全 0 但正文声明存在未解决/未通过项，二者矛盾：按格式缺陷中断，请人工核对报告。");
    }
    found.unresolved = j.unresolved === true;
    return found;
  }
  // 无机读行：不猜测，按格式缺陷中断
  throw new Error("测试报告缺少机读行 DEFECTS:{...}：按格式缺陷中断，请重新派发 ddd-tester 产出合规报告（含机读行）。");
}

// 状态更新指令：注入到阶段任务末尾。
// 并行段竞写防护：并行段内仅实现者写状态（writer 唯一），测试规划者不写；
// 并行段自身的完成（implement-plan）由其后继写入者 g5-int 合并记录，使任一子任务未完成时整段不被记为已完成。
function stateNote(stageKey, alsoDone) {
  const keys = [stageKey].concat(alsoDone || []);
  const list = keys.map((k) => `"${k}"`).join(", ");
  return `\n\n【状态记录】完成后更新 ${stateFile}：追加/合并 JSON 字段 {"lastStage":"${stageKey}","status":"done"}，doneStages 数组补齐 ${list}，并保留已有字段。文件不存在则据此初始化。`;
}

// 统一的阶段执行包装：失败时返回结构化结果而非裸抛，保留阶段名/轮次/状态文件路径供根会话断点接管。
// 监管接入：每个子任务注入 control.needsAttentionAfterMs，同一任务停滞超过阈值即发出 needs_attention 控制事件，
// 由根会话侧感知并可 steer/interrupt 干预，避免子代理在同一指令上重复执行等待。
const STALL_TIMEOUT_MS = args && Number.isFinite(Number(args.stallTimeoutMs))
  ? Math.max(30000, Number(args.stallTimeoutMs))
  : 300000; // 默认 5 分钟无活动即上报需要关注

function stallControl() {
  return {
    needsAttentionAfterMs: STALL_TIMEOUT_MS,
    notifyOn: ["needs_attention"],
  };
}

async function runStage(key, params, meta) {
  try {
    return await runs.run(key, { ...params, control: stallControl() });
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
// 先切条目再按上限截断，截断时显式标注，避免含「失败」的合规行被带入或真缺陷条目被前十五条截掉。
function defectSummaryFrom(reportText) {
  const text = String(reportText || "");
  // 定位缺陷路由单区段：标题行或加粗行含「缺陷路由」
  const head = text.match(/^#{1,6}\s*[^\n]*缺陷路由[^\n]*$/m) || text.match(/^\*\*[^\n]*缺陷路由[^\n]*\*\*\s*$/m);
  if (!head) return text.slice(-1500);
  const body = text.slice(head.index + head[0].length);
  // 区段止于下一节标题（不含「缺陷」的标题行）；缺陷条目自身的标题不构成边界
  const boundary = body.match(/^#{1,6}\s+(?!缺陷)[^\n]*$/m);
  const section = (boundary ? body.slice(0, boundary.index) : body).trim();
  if (!section) return text.slice(-1500);
  // 条目：模板中每条以「# 缺陷 {ID}」标题开启，按标题行切分；无标题时退化为空行分块
  let items = section.split(/\n(?=#{1,6}\s)/).map((s) => s.trim()).filter(Boolean);
  if (items.length <= 1) items = section.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const cap = 15; // 保持原关键词过滤阶段的条目上限
  const kept = items.slice(0, cap);
  const note = items.length > cap ? `\n（已截断：共 ${items.length} 条，仅列前 ${cap} 条）` : "";
  return kept.join("\n\n") + note;
}

// 演进上下文：从上轮修复输出中提取"已尝试方案"，从测试报告中提取缺陷条目，注入下轮任务防失忆打转
function buildFixCtx(round, reportText, fixText) {
  const text = String(reportText || "");
  // 缺陷条目：从缺陷路由单区段按条目提取，不再按关键词过滤整篇报告行
  const defectSummary = defectSummaryFrom(text);
  // 已尝试方案：来自上轮修复者的输出 fixText，而非测试报告
  const fixOut = String(fixText || "");
  const triedMatch = fixOut.match(/已尝试方案[：:]*([\s\S]{0,1200}?)(?=\n#{1,6} |$)/);
  const triedNote = triedMatch
    ? `上一轮已尝试且失败的方案（本轮禁止重复，必须换路径）：\n${triedMatch[1]}`
    : `上一轮未提供已尝试方案记录（首轮或上轮未按格式输出），请自行分析后选择实现路径，并在输出中包含"已尝试方案"节。`;
  return { round, defectSummary, triedNote };
}

function defectAction(level) {
  if (level === "C") {
    return {
      key: "ddd-fix-c",
      label: "修复实现级缺陷",
      agent: "ddd-fixer",
      task: (ctx) => `在项目根 ${root} 修复实现级（C 级）缺陷。当前第 ${ctx.round} 轮，剩余自动修复机会 ${maxFixRounds - ctx.round + 1} 次，超限将升级用户。

本轮必须修复的缺陷条目：
${ctx.defectSummary}

${ctx.triedNote}

修复要求：
1. 按就近 DESIGN.md 逐条修复上述条目，只修代码不改设计。
2. 禁止重复已尝试且失败的方案，必须换实现路径或根因分析方法。
3. 修复后仅自测所负责接缝的相关用例，禁止执行全量测试套件，全量重测由 ddd-tester 在下一轮负责。
4. 输出必须包含两节：修复清单（条目→改动摘要）与已尝试方案（本轮尝试的路径及结果，供下一轮排除）。`,
    };
  }
  if (level === "D") {
    return {
      key: "ddd-fix-d",
      label: "修订测试计划",
      agent: "ddd-fixer",
      task: (ctx) => `在项目根 ${root} 修订测试级（D 级）缺陷。当前第 ${ctx.round} 轮，剩余自动修复机会 ${maxFixRounds - ctx.round + 1} 次。

本轮必须修订的缺陷条目：
${ctx.defectSummary}

${ctx.triedNote}

修订要求：
1. 依据缺陷路由单中"计划漏场景/断言错/覆盖缺口"条目，修订 docs/test/ 对应 TEST_PLAN.md 并补充覆盖映射表。
2. 禁止重复已尝试且无效的修订。
3. 只修计划，不改代码与设计。输出修订清单与已尝试方案。`,
    };
  }
  // A/B 由调用方在本函数之前拦截，不经此处
  throw new Error("defectAction 仅接受 C 或 D 级，收到：" + level);
}

const stages = [
  {
    key: "requirements",
    runKey: "ddd-requirements",
    label: "采集并确认需求",
    agent: "ddd-requirements",
    task: `在项目根 ${root} 执行需求采集：分析已有材料与用户输入，产出 REQUIREMENTS.md（含项目类型判定）。需求未对齐即停止并报告待确认问题清单。`,
  },
  {
    key: "acceptance",
    runKey: "ddd-acceptance",
    label: "制定验收标准",
    agent: "ddd-acceptance",
    task: `读取 ${root}/REQUIREMENTS.md，产出 ${root}/AC.md（Given/When/Then，双向可追溯）。发现需求矛盾即停止并报告。`,
  },
  {
    key: "architect",
    runKey: "ddd-architect",
    label: "设计架构与目录规划",
    agent: "ddd-architect",
    task: `读取 ${root}/REQUIREMENTS.md 与 ${root}/AC.md，产出 ${root}/ARCHITECTURE.md（技术环境、目录规划、横切规范；二次开发且缺文档时先现状分析）。`,
  },
  {
    key: "decomposer",
    runKey: "ddd-decomposer",
    label: "分解设计产出文档树",
    agent: "ddd-decomposer",
    task: `读取 ${root}/ARCHITECTURE.md 与 ${root}/AC.md，产出 docs/design/ 目录同构设计文档树（含签名级接口契约），分发模块级 AC。完成后附文档树清单。完成后运行 node ~/.pi/agent/skills/ddd-methodology/scripts/trace-check.js <项目根>，将输出附入完成报告，作为 G4 证据。`,
  },
  {
    key: "interface-review",
    runKey: "ddd-interface-reviewer",
    label: "接口契约独立评审",
    agent: "ddd-interface-reviewer",
    task: `只读评审 ${root}/docs/design/ 全部 DESIGN.md 的签名级接口契约：能力覆盖/模块间重复/缺口/依赖方向（对照 ARCHITECTURE.md 依赖约束）/契约质量。输出缺陷清单与结论。报告末尾必须含机读行 "VERDICT: pass|conditional|fail"（判据见你的提示词）。发现接口设计问题报告 B 级缺陷。`,
  },
];

const parallelStages = [
  {
    key: "implement-plan",
    label: "就近加载实现代码",
    agent: "ddd-implementer",
    task: `按 ${root}/docs/design/ 文档树就近加载设计文档，实现各目录代码与单元测试。发现设计"做不出来"即停止并报告设计级缺陷。多模块时按互斥目录分批完成。`,
  },
  {
    key: "test-plan",
    label: "制定测试计划树",
    agent: "ddd-test-planner",
    task: `基于 ${root}/AC.md 与 ${root}/docs/design/ 各 DESIGN.md 的模块级验收要点及**已冻结的签名级接口契约**，产出 ${root}/docs/test/ 同构测试计划树（每用例含含超时的执行命令、风险级别、桩化说明、手动测试清单；可基于冻结接口直接产出契约测试），附覆盖映射表（保证 trace-check 可通过）。`,
  },
];

const finalStage = {
  key: "test-execute",
  runKey: "ddd-test-execute",
  label: "执行测试并定级路由",
  agent: "ddd-tester",
  task: (round) =>
    `【实现并行段已全部完成并过 G5 收口门——你与实现者不同段】按 ${root}/docs/test/ 测试计划树执行测试（第 ${round} 轮）：只照抄执行计划中"执行命令（含超时）"字段，禁止裸跑。产出测试报告与缺陷路由单，报告末尾必须含机读行 "DEFECTS: {\"A\":n,\"B\":n,\"C\":n,\"D\":n,\"unresolved\":bool}"（判定自检按 D→C→B→A 顺序，默认最低层）。`,
};

// —— 断点检查 ——
const resumeReport = await readResumeState();
let doneStages = parseDoneStages(resumeReport);
// 消费 stageRegistry：过滤非法阶段键，防止损坏的状态文件把无关键当作已完成阶段跳过
const validDoneStages = doneStages.filter((k) => stageRegistry.includes(k));
if (validDoneStages.length !== doneStages.length) {
  throw new Error(
    "状态文件 doneStages 含非法阶段键：" +
      doneStages.filter((k) => !stageRegistry.includes(k)).join(", ") +
      "。合法键见规范「状态文件」节的阶段注册表。",
  );
}
doneStages = validDoneStages;

// —— 前置串行阶段（断点续跑：已完成则跳过） ——
// stateNote 仅注入有写工具的阶段（interface-reviewer 只读，不写状态）
const READONLY_STAGES = ["interface-review"];
// 本轮实际未执行的阶段及原因：断点已完成者与升级中断者都记入，供根会话分清「已做完」与「没做」
const skippedStages = [];
for (const s of stages) {
  if (doneStages.includes(s.key)) {
    skippedStages.push({ stage: s.key, reason: "断点记录该阶段已完成，本轮跳过" });
    continue;
  }
  const r = await runStage(s.runKey + "-" + s.key, {
    label: s.label,
    agent: s.agent,
    task: s.task + (READONLY_STAGES.includes(s.key) ? "" : stateNote(s.key)),
  }, { stage: s.key });
  if (r && r.__failed) return r;

  // G4.5 门控：接口评审非 pass 结论（fail/conditional 或无机读行）→ 中断返回根会话复核
  if (s.key === "interface-review") {
    const verdict = String(r || "").match(/VERDICT:\s*(pass|conditional|fail)\b/i);
    if (!verdict || verdict[1].toLowerCase() !== "pass") {
      return {
        __failed: true,
        status: "escalated",
        failedStage: "interface-review",
        reason: verdict ? `接口评审结论为 ${verdict[1]}，需根会话复核（有条件通过须确认必须修复项已处理）` : "接口评审报告缺少 VERDICT 机读行（格式缺陷）",
        stateFile,
        report: r,
        hint: "根会话复核评审报告：pass 才冻结接口进入实现；conditional 需确认必须修复项已由 ddd-decomposer 修复后可重跑（断点跳过已完成的串行阶段）；fail 由 ddd-decomposer 修复后重跑。",
      };
    }
  }
}

// —— 并行段：实现与测试规划（均为产出类，无进程执行） ——
// 段内不记录本段完成：仅实现者写其只读前驱 interface-review（writer 唯一），本段自身（implement-plan）的完成由后继写入者 g5-int 合并记录。
// 这样 implement-plan 与 test-plan 中任一未成功完成时，doneStages 都不会出现 implement-plan，续跑必重跑整段，避免 test-plan 被永久跳过。
if (!doneStages.includes("implement-plan")) {
  const parallelResults = await runs.all(parallelStages.map(p => ({
    key: p.key,
    label: p.label,
    agent: p.agent,
    task: p.key === "implement-plan" ? p.task + stateNote("interface-review") : p.task,
  })));
  // runs.all 收集失败而不抛错：任一子任务回执 ok 为 false 即整段未完成，直接返回结构化失败且不写状态
  const failedParallel = Array.isArray(parallelResults) ? parallelResults.find((r) => r && r.ok === false) : null;
  if (failedParallel) {
    return {
      __failed: true,
      status: "failed",
      failedStage: "implement-plan",
      stateFile,
      error: "并行段子任务未成功完成：" + (failedParallel.error || "未知错误"),
      hint: "并行段未写入 doneStages，重新启动 workflow 将重跑整段（实现与测试规划）。",
    };
  }
} else {
  skippedStages.push({ stage: "implement-plan", reason: "断点记录该阶段已完成，本轮跳过" });
}

// —— G5-INT 集成收口门（与手工档标准一致） ——
// 职责纯净分离：门禁只做构建与集成问题修复，禁止执行全量测试套件——
// 全量测试的唯一主体是 ddd-tester 首轮执行，其结果作为 G5-INT 的最终证据
if (!doneStages.includes("g5-int")) {
  const r = await runStage("ddd-int-check", {
    label: "G5-INT 集成收口检查",
    agent: "ddd-fixer",
    task: `在项目根 ${root} 执行集成收口检查（G5-INT 门）：1) 全项目构建通过；2) 检查各接缝自测报告齐备且 TEST_PLAN 对齐说明完整，声明测试就绪；3) 运行 node ~/.pi/agent/skills/ddd-methodology/scripts/code-health.js <项目根> 并将输出附入门禁记录，作为 G5-INT 证据；4) 运行 node ~/.pi/agent/skills/ddd-methodology/scripts/trace-check.js <项目根> 并将输出附入门禁记录，作为 G5 证据；运行 node ~/.pi/agent/skills/ddd-methodology/scripts/governance-check.js <项目根> 并将输出附入门禁记录，作为 G5-INT 证据，governance-check 的退出码非零即视为阻断；5) 核对实现文件粒度与 DESIGN 预判一致，应拆未拆报告 C 级，同时核对各接缝实现者的约定遵循自检齐备；6) 修复因多接缝合并产生的集成问题，仅实现级修改。**禁止执行全量测试套件，全量测试由 ddd-tester 负责**。若发现设计级矛盾（集成暴露接口不匹配），停止并报告 B 级缺陷。` + stateNote("g5-int", ["implement-plan"]),
  }, { stage: "g5-int" });
  if (r && r.__failed) return r;
} else {
  skippedStages.push({ stage: "g5-int", reason: "断点记录该阶段已完成，本轮跳过" });
}

// —— 测试执行（单独串行段） + C/D 缺陷自动修复轮次 ——
let round = 0;
let lastReport = null;
let lastFixOutput = null;
let escalated = null;

while (round <= maxFixRounds) {
  round += 1;
  lastReport = await runStage(finalStage.runKey + "-r" + round, {
    label: `${finalStage.label}（第${round}轮）`,
    agent: finalStage.agent,
    task: finalStage.task(round) + (round === 1 ? stateNote("test-execute") : ""),
  }, { stage: finalStage.key, round });
  if (lastReport && lastReport.__failed) return lastReport;

  const defects = extractDefects(lastReport);

  // 全部通过：正常结束
  if (!defects.unresolved) {
    break;
  }

  // A/B 级：不在脚本内自动处理，立即中断交根会话
  if (defects.A > 0 || defects.B > 0) {
    escalated = {
      reason: defects.A > 0 ? "A级缺陷（需求级）" : "B级缺陷（设计级）",
      detail: "A/B 级缺陷不适用自动修复，需根会话依据规范「缺陷四级路由」节仲裁路由；A级必须升级用户确认。",
      round,
    };
    break;
  }

  // 轮次超限：强制升级用户
  if (round > maxFixRounds) {
    escalated = {
      reason: "修复轮次超限",
      detail: `同一问题累计 ${round - 1} 轮自动修复仍未解决，按方法论约定强制升级用户。`,
      round,
    };
    break;
  }

  // C/D 缺陷修复：混合时同时派发两类修复，再统一重测
  const fixes = [];
  if (defects.C > 0) fixes.push(defectAction("C"));
  if (defects.D > 0) fixes.push(defectAction("D"));
  if (fixes.length === 1) {
    const f = fixes[0];
    const r = await runStage(f.key + "-r" + round, {
      label: f.label + `（第${round}轮）`,
      agent: f.agent,
      task: f.task(buildFixCtx(round, lastReport, lastFixOutput)),
    }, { stage: f.key, round });
    if (r && r.__failed) return r;
    lastFixOutput = typeof r === "string" ? r : JSON.stringify(r);
  } else if (fixes.length === 2) {
    const fixResults = await runs.all(fixes.map(f => ({
      key: f.key,
      label: f.label + `（第${round}轮）`,
      agent: f.agent,
      task: f.task(buildFixCtx(round, lastReport, lastFixOutput)),
    })));
    // 并行 C/D 混合修复：两路输出都要留存（与单修复分支同样保存），否则下一轮 buildFixCtx 的「已尝试方案」为空，反重复机制在混合场景失效
    lastFixOutput = (Array.isArray(fixResults) ? fixResults : [])
      .map((r) => (typeof r === "string" ? r : JSON.stringify(r)))
      .join("\n\n");
  }
  // 循环继续 → 重测
}

// —— 声明面审计阶段（测试循环正常结束后） ——
// 触发条件：escalated 为空，即测试全绿或未通过项已定级且未超轮次；升级中断时跳过并注明原因
let auditReport = null;
if (escalated) {
  skippedStages.push({ stage: "audit", reason: `测试段以升级中断收尾（${escalated.reason}），声明面审计留待根会话仲裁后单独派发` });
} else if (doneStages.includes("audit")) {
  skippedStages.push({ stage: "audit", reason: "断点记录该阶段已完成，本轮跳过" });
} else {
  const auditRun = await runStage("ddd-audit", {
    label: "声明面审计",
    agent: "ddd-auditor",
    task: `在项目根 ${root} 执行声明面审计（G6 门禁）：核验变更记录当轮声称与实际产物是否相符，输出审计报告与修剪清单；报告标题下方给出建议归档名，格式为 G6-序号-版本，序号取 docs/audits/ 现存最大序号加一；只读，不落盘，审计报告的落盘由根会话执行。` + stateNote("audit"),
  }, { stage: "audit" });
  if (auditRun && auditRun.__failed) return auditRun;
  auditReport = auditRun;
}

return {
  status: escalated ? "已中断，需根会话仲裁" : "workflow 完成",
  rounds: round,
  resumedFrom: doneStages,
  stateFile,
  escalated,
  lastReport,
  auditReport,
  skippedStages,
  note: "escalated 非空时，根会话须依据规范「缺陷四级路由」节处理对应级别缺陷或升级用户；auditReport 非空时，审计报告的落盘由根会话执行；skippedStages 列出本轮未执行的阶段与原因；状态文件支持断点续跑。",
};
