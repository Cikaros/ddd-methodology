/**
 * DDD-Methodology 固定阶段编排脚本（可选加速档）
 *
 * 用法：根会话中调用
 *   subagent({ workflow: "<skill目录>/workflows/ddd-workflow.js", args: { root: "<项目根绝对路径>" } })
 * 必须通过 args.root 传入项目根绝对路径——workflow 脚本运行在沙箱中，
 * 没有 process 全局，唯一合法的数据通道就是冻结的 args。
 *
 * 前置条件：7 个 ddd-* 代理必须已安装（~/.pi/agent/agents/），否则运行时校验失败。
 *
 * 阶段流：代理1 需求采集 → 代理0 验收标准 → 代理2 架构师 → 代理3 分解设计
 *        → [代理4 实现 ∥ 代理5 测试规划]（均为产出类，无进程执行）
 *        → [G5 收口门] → 代理6 测试执行（单独串行，与代理4 永不同段）
 *        → C/D 级缺陷自动修复并重测（最多 maxFixRounds 轮，默认 2）
 *
 * 实现/测试硬分离：代理6 与代理4 永不同段；并行段仅为实现∥测试规划。
 *
 * 断点续跑：每完成一个阶段，通过派发 ddd-implementer 之外的方式不可行——沙箱无文件写能力，
 * 因此状态文件由各阶段代理在任务中负责写入/更新 <root>/docs/.ddd-state.json；
 * 本脚本启动时通过首个代理读取状态文件决定从哪个阶段续跑（args.resume 阶段键可选覆盖）。
 *
 * 缺陷路由策略：
 *   - C（实现级）：派发 ddd-implementer 修复 → 重测
 *   - D（测试级）：派发 ddd-test-planner 修计划 → 重测
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

// 阶段顺序（用于断点续跑判定）
const stageOrder = ["requirements", "acceptance", "architect", "decomposer", "implement-plan", "test-execute"];

/**
 * 读取断点状态：派发一个只读任务让 ddd-tester? 不合适——
 * 使用 ddd-implementer 前置只读任务不合规。改用：由代理1 在启动时读状态文件并汇报。
 * 简化方案：启动阶段 0 由 ddd-requirements 读取状态文件，若存在且 resume=true 则报告已完成阶段。
 */
async function readResumeState() {
  const r = await runs.run("ddd-resume-check", {
    label: "读取断点状态",
    agent: "ddd-requirements",
    task: `只读检查 ${stateFile}（断点状态文件）。若存在：读取 JSON，报告已完成阶段列表、缺陷摘要、最近已过门记录，然后停止（不写 REQUIREMENTS.md）；若不存在：报告"无状态文件，全新启动"。禁止修改任何文件。`,
  });
  return r; // 文本报告，由调用方（根会话）或本脚本关键字解析
}

// 从报告文本解析已完成阶段（兜底解析；规范上代理应输出结构化行 "DONE: <stage>"）
function parseDoneStages(reportText) {
  const text = String(reportText || "");
  const done = [];
  for (const m of text.matchAll(/DONE:\s*([a-z0-9-]+)/gi)) done.push(m[1]);
  return done;
}

// 从报告文本解析缺陷级别（兜底；规范上报告含机读行 "DEFECTS: {...JSON...}"）
function extractDefects(reportText) {
  const text = String(reportText || "");
  const found = { A: 0, B: 0, C: 0, D: 0, unresolved: false };
  // 优先机读段
  const mr = text.match(/DEFECTS:\s*(\{[\s\S]*?\})\s*(?:\n|$)/);
  if (mr) {
    try {
      const j = JSON.parse(mr[1]);
      if (j && typeof j === "object") {
        for (const k of ["A", "B", "C", "D"]) found[k] = Number(j[k]) || 0;
        found.unresolved = j.unresolved === true || found.A + found.B + found.C + found.D > 0;
        return found;
      }
    } catch (e) { /* 机读段损坏则兜底正则 */ }
  }
  const m = text.match(/判定级别\s*[:：]\s*([ABCD])/i);
  if (m) found[m[1].toUpperCase()]++;
  const all = text.match(/\b([ABCD])\s*(级|级缺陷|需求级|设计级|实现级|测试级)/g) || [];
  for (const item of all) found[item[0].toUpperCase()]++;
  found.unresolved = /未通过|未解决|失败|FAIL|defect/i.test(text);
  return found;
}

// 状态更新指令：注入到每个阶段任务的末尾，要求代理完成后写状态文件
function stateNote(stageKey) {
  return `\n\n【状态记录】完成后更新 ${stateFile}：追加/合并 JSON 字段 {"lastStage":"${stageKey}","status":"done"}，并保留已有字段（如 doneStages 数组追加 "${stageKey}"）。文件不存在则创建并初始化 {"doneStages":["${stageKey}"],"lastStage":"${stageKey}"}。`;
}

function defectAction(level) {
  if (level === "C") {
    return {
      key: "ddd-fix-c",
      label: "修复实现级缺陷",
      agent: "ddd-implementer",
      task: `在项目根 ${root} 修复实现级（C 级）缺陷：依据最新测试报告与缺陷路由单中列出的"代码与 DESIGN.md 不一致"条目，按就近设计文档逐条修复并自测。只修代码，不改设计。输出修复清单与自测结果。`,
    };
  }
  if (level === "D") {
    return {
      key: "ddd-fix-d",
      label: "修订测试计划",
      agent: "ddd-test-planner",
      task: `在项目根 ${root} 修订测试级（D 级）缺陷：依据最新缺陷路由单中"计划漏场景/断言错/覆盖缺口"条目，修订 docs/test/ 对应 TEST_PLAN.md 并补充覆盖映射表。只修计划，不改代码与设计。`,
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
    task: `读取 ${root}/ARCHITECTURE.md 与 ${root}/AC.md，产出 docs/design/ 目录同构设计文档树，分发模块级 AC。完成后附文档树清单。`,
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
    task: `基于 ${root}/AC.md 与 ${root}/docs/design/ 各 DESIGN.md 的模块级验收要点，产出 ${root}/docs/test/ 同构测试计划树（每用例含含超时的执行命令、风险级别、桩化说明、手动测试清单），附覆盖映射表（保证 trace-check 可通过）。`,
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
const doneStages = parseDoneStages(resumeReport);

// —— 前置串行阶段（断点续跑：已完成则跳过） ——
for (const s of stages) {
  if (doneStages.includes(s.key)) {
    continue;
  }
  await runs.run(s.runKey + "-" + s.key, {
    label: s.label,
    agent: s.agent,
    task: s.task + stateNote(s.key),
  });
}

// —— 并行段：实现与测试规划（均为产出类，无进程执行） ——
if (!doneStages.includes("implement-plan")) {
  await runs.all(parallelStages.map(p => ({
    key: p.key,
    label: p.label,
    agent: p.agent,
    task: p.task + stateNote("implement-plan"),
  })));
}

// —— G5-INT 集成收口门（与手工档标准一致） ——
// 并行实现多目录后，必须先做集成检查：构建通过 + 全量单测通过，才允许进入测试执行段
if (!doneStages.includes("g5-int")) {
  await runs.run("ddd-int-check", {
    label: "G5-INT 集成收口检查",
    agent: "ddd-implementer",
    task: `在项目根 ${root} 执行集成收口检查（G5-INT 门）：1) 全项目构建通过；2) 全量单元测试（仅自动用例，按 TEST_PLAN 执行命令）通过；3) 修复因多接缝合并产生的集成问题（仅实现级修改）。完成后更新 ${stateFile} 追加 "g5-int"。若发现设计级矛盾（集成暴露接口不匹配），停止并报告 B 级缺陷。`,
  });
}

// —— 测试执行（单独串行段） + C/D 缺陷自动修复轮次 ——
let round = 0;
let lastReport = null;
let escalated = null;

while (round <= maxFixRounds) {
  round += 1;
  lastReport = await runs.run(finalStage.runKey + "-r" + round, {
    label: `${finalStage.label}（第${round}轮）`,
    agent: finalStage.agent,
    task: finalStage.task(round),
  });

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
    await runs.run(f.key + "-r" + round, {
      label: f.label + `（第${round}轮）`,
      agent: f.agent,
      task: f.task,
    });
  } else if (fixes.length === 2) {
    await runs.all(fixes.map(f => ({
      key: f.key,
      label: f.label + `（第${round}轮）`,
      agent: f.agent,
      task: f.task,
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
