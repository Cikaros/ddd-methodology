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
 *
 * 注意：本脚本只负责固定阶段的自动推进。
 * 缺陷四级路由（A/B/C/D）需要根会话仲裁，不在本脚本内自动闭环——
 * 测试执行阶段（ddd-tester）的结果返回后，由根会话读取报告并决定后续路由。
 */

const root = args && args.root ? String(args.root) : null;
if (!root) {
  throw new Error("缺少 args.root：请通过 subagent({ workflow: ..., args: { root: \"<项目根绝对路径>\" } }) 传入项目根。");
}

// 每个阶段的派发任务模板；key/label/agent/task 符合 runs.run 的步骤契约
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

// 实现 ∥ 测试规划（并行段）
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
  task: `按 ${root}/docs/test/ 测试计划树执行测试，产出测试报告与缺陷路由单（四级定级：默认最低层，仅B级以上回设计层；2轮未解强制升级）。`,
};

// 串行前置阶段（runs.run 签名：key, params）
for (const s of stages) {
  await runs.run(s.key, { label: s.label, agent: s.agent, task: s.task });
}

// 并行段：实现与测试规划
await runs.all(parallelStages);

// 测试执行
const testResult = await runs.run(finalStage.key, {
  label: finalStage.label,
  agent: finalStage.agent,
  task: finalStage.task,
});

return {
  status: "workflow 完成（首轮）",
  note: "测试执行结果已返回，缺陷四级路由的后续修复轮次由根会话依据报告仲裁调度。",
  testResult,
};
