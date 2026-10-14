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
 *        → [代理4 实现 ∥ 代理5 测试规划] → 代理6 测试执行
 *        → C/D 级缺陷自动修复并重测（最多 maxFixRounds 轮，默认 2）
 *
 * 缺陷路由策略：
 *   - C（实现级）：派发 ddd-implementer 修复 → 重测
 *   - D（测试级）：派发 ddd-test-planner 修计划 → 重测
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

// 从缺陷路由单/测试报告中解析未解决缺陷的级别；报告格式遵循 references/templates.md
function extractDefects(reportText) {
  const text = String(reportText || "");
  const found = { A: 0, B: 0, C: 0, D: 0, unresolved: false };
  const m = text.match(/判定级别\s*[:：]\s*([ABCD])/i);
  if (m) found[m[1].toUpperCase()]++;
  const all = text.match(/\b([ABCD])\s*(级|级缺陷|需求级|设计级|实现级|测试级)/g) || [];
  for (const item of all) {
    const lv = item[0].toUpperCase();
    found[lv]++;
  }
  found.unresolved = /未通过|未解决|失败|FAIL|defect/i.test(text);
  return found;
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
    key: "ddd-requirements",
    label: "采集并确认需求",
    agent: "ddd-requirements",
    task: `在项目根 ${root} 执行需求采集：分析已有材料与用户输入，产出 REQUIREMENTS.md（含项目类型判定）。需求未对齐即停止并报告待确认问题清单。`,
  },
  {
    key: "ddd-acceptance",
    label: "制定验收标准",
    agent: "ddd-acceptance",
    task: `读取 ${root}/REQUIREMENTS.md，产出 ${root}/AC.md（Given/When/Then，双向可追溯）。发现需求矛盾即停止并报告。`,
  },
  {
    key: "ddd-architect",
    label: "设计架构与目录规划",
    agent: "ddd-architect",
    task: `读取 ${root}/REQUIREMENTS.md 与 ${root}/AC.md，产出 ${root}/ARCHITECTURE.md（技术环境、目录规划、横切规范；二次开发且缺文档时先现状分析）。`,
  },
  {
    key: "ddd-decomposer",
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
    task: `基于 ${root}/AC.md 与 ${root}/docs/design/ 各 DESIGN.md 的模块级验收要点，产出 ${root}/docs/test/ 同构测试计划树，附覆盖映射表。`,
  },
];

const finalStage = {
  key: "ddd-test-execute",
  label: "执行测试并定级路由",
  agent: "ddd-tester",
  task: (round) =>
    `按 ${root}/docs/test/ 测试计划树执行测试（第 ${round} 轮），产出测试报告与缺陷路由单。每个缺陷必须给出"判定级别"字段（A/B/C/D，判定自检按 D→C→B→A 顺序，默认最低层）。`,
};

// —— 前置串行阶段 ——
for (const s of stages) {
  await runs.run(s.key, { label: s.label, agent: s.agent, task: s.task });
}

// —— 并行段：实现与测试规划 ——
await runs.all(parallelStages);

// —— 测试执行 + C/D 缺陷自动修复轮次 ——
let round = 0;
let lastReport = null;
let escalated = null; // 需要根会话仲裁的中断信息

while (round <= maxFixRounds) {
  round += 1;
  const r = finalStage;
  lastReport = await runs.run(r.key + "-r" + round, {
    label: `${r.label}（第${round}轮）`,
    agent: r.agent,
    task: r.task(round),
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

  // C/D 级：按最高严重级别（C 优先于 D）派发一次修复
  const level = defects.C > 0 ? "C" : "D";
  const fix = defectAction(level);
  await runs.run(fix.key + "-r" + round, {
    label: fix.label + `（第${round}轮）`,
    agent: fix.agent,
    task: fix.task,
  });
  // 循环继续 → 重测
}

return {
  status: escalated ? "已中断，需根会话仲裁" : "workflow 完成",
  rounds: round,
  escalated,
  lastReport,
  note: "escalated 非空时，根会话须依据 defect-routing.md 处理对应级别缺陷或升级用户。",
};
