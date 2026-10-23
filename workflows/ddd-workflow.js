/**
 * DDD-Methodology 固定阶段编排脚本（可选加速档）
 *
 * 用法：根会话中调用
 *   subagent({ workflow: "<skill目录>/workflows/ddd-workflow.js", args: { root: "<项目根绝对路径>" } })
 * 必须通过 args.root 传入项目根绝对路径——workflow 脚本运行在沙箱中，
 * 没有 process 全局，唯一合法的数据通道就是冻结的 args。
 *
 * 前置条件：12 个 ddd-* 代理必须已安装（~/.pi/agent/agents/），否则运行时校验失败。
 *
 * 阶段流：代理1 需求采集 → 代理0 验收标准 → 代理2 架构师 → 代理3 分解设计（含签名级接口契约）
 *        → 接口契约独立评审（G4.5，ddd-interface-reviewer）
 *        → [代理4 实现 ∥ 代理5 测试规划]（均为产出类，无进程执行）
 *        → [G5-INT 集成收口门] → 代理6 测试执行（单独串行，与代理4 永不同段）
 *        → C/D 级缺陷自动修复并重测（最多 maxFixRounds 轮，默认 2）
 *
 * 实现/测试硬分离：代理6 与代理4 永不同段；并行段仅为实现∥测试规划。
 *
 * 断点续跑：状态文件由各阶段代理在任务中负责写入/更新 <root>/docs/.ddd-state.json（schema 见 references/process-details.md）；
 * 本脚本启动时由 ddd-requirements 只读检查状态文件并按契约输出 DONE: <stageKey> 机读行，已完成阶段自动跳过。
 *
 * 缺陷路由策略：
 * *   - C（实现级）：派发 ddd-fixer 修复 → 重测
 * *   - D（测试级）：派发 ddd-fixer 修计划 → 重测
 *   - C+D 混合：同时派发两类修复，再统一重测
 *   - A（需求级）/ B（设计级）：不在脚本内自动处理，立即中断返回，
 *     由根会话依据 references/defect-routing.md 仲裁路由（A 须升级用户确认）
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

// 阶段注册表：键清单必须与 references/process-details.md 主题H 的阶段注册表一致；
// 串行段/接口评审/G5-INT/首轮测试执行均用 stateNote 写入对应键。
const stageRegistry = [
  "requirements", "acceptance", "architect", "decomposer",
  "interface-review", "implement-plan", "g5-int", "test-execute",
];

/**
 * 读取断点状态：由代理1 执行只读检查。
 * 契约：报告必须逐行输出机读行 "DONE: <stageKey>"（每个已完成阶段一行），
 * 便于 parseDoneStages 可靠解析；JSON 损坏时输出 "STATE_CORRUPT" 并停止。
 */
async function readResumeState() {
  const r = await runStage("ddd-resume-check", {
    label: "读取断点状态",
    agent: "ddd-requirements",
    task: `只读检查 ${stateFile}（断点状态文件，字段 schema：doneStages 数组 / lastStage / status）。
规则：
1. 若文件存在且 JSON 有效：对 doneStages 数组中每个阶段键，输出一行机读行 "DONE: <阶段键>"（格式严格为 DONE: 空格 阶段键，如 "DONE: architect"）；并报告 lastStage 与 status 字段值、缺陷摘要。然后停止，不写 REQUIREMENTS.md。
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
// 优先机读行 "DEFECTS: {...}"；机读行存在但解析失败、或计数全 0 但散文含失败语义词 → 视为格式缺陷，抛错交根会话，不猜测。
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
    // 计数全 0：核对散文（先剔除机读行），若明确存在失败语义词则机读与散文矛盾 → 中断
    const prose = text.replace(/DEFECTS:\s*\{[\s\S]*?\}\s*(?:\n|$)/g, "");
    const hasFailWord = /(未通过|未解决|存在失败|有失败|修复未果|FAIL(ED)?\b|defect\b)/i.test(prose);
    const negated = /(失败项|失败)\s*[:：]?\s*(无|0|零)\s*(项|个)?|\b(0|zero|no)\s+(failed|defects?)\b|FAILED\s*[:：]\s*0|回归未通过项已清零|无失败/i.test(prose);
    if (hasFailWord && !negated) {
      throw new Error("测试报告机读计数全 0 但正文存在失败表述，二者矛盾：按格式缺陷中断，请人工核对报告。");
    }
    found.unresolved = j.unresolved === true;
    return found;
  }
  // 无机读行：不猜测，按格式缺陷中断
  throw new Error("测试报告缺少机读行 DEFECTS:{...}：按格式缺陷中断，请重新派发 ddd-tester 产出合规报告（含机读行）。",
  );
}

// 状态更新指令：注入到阶段任务末尾。
// 并行段竞写防护：仅实现者写状态（writer 唯一），测试规划者不写。
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

// 演进上下文：从上轮修复输出中提取"已尝试方案"，从测试报告中提取缺陷条目，注入下轮任务防失忆打转
function buildFixCtx(round, reportText, fixText) {
  const text = String(reportText || "");
  // 缺陷条目：优先取路由单缺陷清单行，备选整个报告尾部
  const defectLines = text.split(/\n/).filter(l => /缺陷|BUG-|BUGPLAN|路由|失败/.test(l)).slice(0, 15).join("\n");
  const defectSummary = defectLines || text.slice(-1500);
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
  return null; // A/B 不自动处理
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
    task: `读取 ${root}/ARCHITECTURE.md 与 ${root}/AC.md，产出 docs/design/ 目录同构设计文档树（含签名级接口契约），分发模块级 AC。完成后附文档树清单。`,
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
    key: "ddd-implement",
    label: "就近加载实现代码",
    agent: "ddd-implementer",
    task: `按 ${root}/docs/design/ 文档树就近加载设计文档，实现各目录代码与单元测试。发现设计"做不出来"即停止并报告设计级缺陷。多模块时按互斥目录分批完成。`,
  },
  {
    key: "ddd-test-plan",
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
      "。合法键见 references/process-details.md 主题H。",
  );
}
doneStages = validDoneStages;

// —— 前置串行阶段（断点续跑：已完成则跳过） ——
// stateNote 仅注入有写工具的阶段（interface-reviewer 只读，不写状态）
const READONLY_STAGES = ["interface-review"];
for (const s of stages) {
  if (doneStages.includes(s.key)) {
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
        hint: "根会话复核评审报告：pass 才冻结接口进入实现；conditional 需确认必须修复项已由代理3 修复后可重跑（断点跳过已完成的串行阶段）；fail 由代理3 修复后重跑。",
      };
    }
  }
}

// —— 并行段：实现与测试规划（均为产出类，无进程执行） ——
// 竞写防护：仅实现者写状态文件（writer 唯一），测试规划者不写状态。
if (!doneStages.includes("implement-plan")) {
  await runs.all(parallelStages.map(p => ({
    key: p.key,
    label: p.label,
    agent: p.agent,
    task: p.key === "ddd-implement" ? p.task + stateNote("implement-plan", ["interface-review"]) : p.task,
  })));
}

// —— G5-INT 集成收口门（与手工档标准一致） ——
// 职责纯净分离：门禁只做构建与集成问题修复，禁止执行全量测试套件——
// 全量测试的唯一主体是 ddd-tester 首轮执行，其结果作为 G5-INT 的最终证据
if (!doneStages.includes("g5-int")) {
  const r = await runStage("ddd-int-check", {
    label: "G5-INT 集成收口检查",
    agent: "ddd-fixer",
    task: `在项目根 ${root} 执行集成收口检查（G5-INT 门）：1) 全项目构建通过；2) 检查各接缝自测报告齐备且 TEST_PLAN 对齐说明完整，声明测试就绪；3) 核对实现文件粒度与 DESIGN 预判一致，应拆未拆报告 C 级；4) 修复因多接缝合并产生的集成问题，仅实现级修改。**禁止执行全量测试套件，全量测试由 ddd-tester 负责**。若发现设计级矛盾（集成暴露接口不匹配），停止并报告 B 级缺陷。` + stateNote("g5-int"),
  }, { stage: "g5-int" });
  if (r && r.__failed) return r;
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
      detail: "A/B 级缺陷不适用自动修复，需根会话依据 references/defect-routing.md 仲裁路由；A级必须升级用户确认。",
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
    await runs.all(fixes.map(f => ({
      key: f.key,
      label: f.label + `（第${round}轮）`,
      agent: f.agent,
      task: f.task(buildFixCtx(round, lastReport, lastFixOutput)),
    })));
  }
  // 循环继续 → 重测
}

return {
  status: escalated ? "已中断，需根会话仲裁" : "workflow 完成",
  rounds: round,
  resumedFrom: doneStages,
  stateFile,
  escalated,
  lastReport,
  note: "escalated 非空时，根会话须依据 defect-routing.md 处理对应级别缺陷或升级用户；状态文件支持断点续跑。",
};
