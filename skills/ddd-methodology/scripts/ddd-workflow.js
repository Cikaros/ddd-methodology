/**
 * DDD-Methodology A 主链编排脚本
 *
 * 目标：按主链节点序固定编排需求、架构、验收、分解设计、详细设计、接口评审、实现与测试规划、集成收口、
 *   测试执行与声明面审计，并在每个交叉检查节点的位置运行对应校验脚本，按失败路由把缺口退回责任方修正后重跑。
 * 范围：A 主链十七个主链节点的编排与阶段推进、断点续跑、C 与 D 两级缺陷的自动修复轮次、五个交叉检查节点的调用与失败路由。
 *   本脚本只做编排、不做机械校验：校验的实现与判定在扩展工具面 ddd_check_*（脚本落点与其路径由扩展经包根解析），本脚本只经工具调用并解析其回传的机读结论。
 *   工具名与调用时机以扩展注册描述为准，本脚本不复述路径，也不自拼脚本路径。
 * 不包含：B 快速修复与 C 自维护通道（B 见同目录 ddd-hotfix.js，C 由根会话直接实施）、各代理提示词、缺陷四级定级的判断实现。
 * 运行时例外：本文件受 pi workflow 沙箱约束，无 require 与 fs，只能单文件，故不适用规范「粒度与独立性」节的拆分要求；
 *   文件头声明「运行时例外」供 H-1 守卫放行，单一能力域为阶段编排，辅助函数内聚于本文件。
 *
 * 用法：根会话中调用
 *   subagent({ workflow: "<包根>/skills/ddd-methodology/scripts/ddd-workflow.js", args: { root: "<项目根绝对路径>" } })
 *   沙箱无 process 全局，唯一合法的数据通道是冻结的 args。
 *
 * 阶段键与状态 schema：两份编排脚本共用同一阶段键集与状态 schema，只按通道取各自键序。
 *   本脚本的 stageRegistry 持 A 通道键序，并在其后补齐 B、C 独有键，内容与 references/spec-govern.md 的键清单及本技能调度模型的阶段键表一致，
 *   由 skills/ddd-methodology/scripts/ref-check.js 的 C4 校验；状态 schema 五字段为 channel、doneStages、lastStage、status、freezeAnchor。
 *
 * 交叉检查：五个节点各以只读步骤调用扩展工具面 ddd_check_scope、ddd_check_design、ddd_check_file_design、ddd_check_code、ddd_check_consistency，
 *   读工具回传的机读状态 pass|gap；gap 即按声明责任退回前驱修正后重跑，两轮未修好升级用户。
 *
 * 断点续跑：状态文件由各阶段代理写入/更新；本脚本启动时由 scout 只读检查并按契约输出 DONE: <键> 机读行，已完成阶段自动跳过。
 *   channel 与本次通道不符即中断，防跨通道误续跑；文件损坏即中断交根会话，不得当作全新启动。
 *
 * 缺陷路由策略：
 *   - C（实现级）：派发 ddd-fixer 修复 → 重测
 *   - D（测试级）：派发 ddd-fixer 修计划 → 重测
 *   - C+D 混合：同时派发两类修复，再统一重测
 *   - A（需求级）/ B（设计级）：不在脚本内自动处理，立即中断返回，由根会话仲裁路由（A 须升级用户确认）
 *   - 同一问题累计修复轮次超过 maxFixRounds 仍失败 → 中断返回根会话升级用户
 *
 * 沙箱可用对象：runs.run、runs.all、runs.lanes、runs.steer、runs.status、runs.ref、emit、console、args。
 *   runs.parallel 与 runs.chain 不存在，属已废弃的旧顶层 API，误用即报 not a function，写此以免复踩。
 */

const root = args && args.root ? String(args.root) : null;
if (!root) {
  throw new Error("缺少 args.root：请通过 subagent({ workflow: ..., args: { root: \"<项目根绝对路径>\" } }) 传入项目根。");
}
const CHANNEL = "A";
const maxFixRounds = args && Number.isFinite(Number(args.maxFixRounds))
  ? Math.max(0, Number(args.maxFixRounds))
  : 2; // 方法论约定：轮回修复超过 2 轮强制升级用户
const stateFile = `${root}/docs/.ddd-state.json`;

// 阶段键全集：A 通道键序在前，B 与 C 独有键随后。两份编排脚本共用本键集，只按通道取各自键序；
// ref-check 的 C4 以本块 stageRegistry 为受控副本，与 references/spec-govern.md 的键清单双向比对。
const stageRegistry = [
  "requirements", "architect", "check-scope", "acceptance", "decomposer",
  "check-design", "detail-design", "check-file-design", "interface-review",
  "implement", "test-plan", "check-code", "g5-int", "test-execute",
  "check-consistency", "defect-fix", "audit", "probe", "self-design",
  "self-write", "doc-sync",
];

/**
 * 读取断点状态：由 scout 执行只读检查。
 * 契约：报告必须逐行输出机读行 "DONE: <stageKey>"（每个已完成阶段一行）与一行 "CHANNEL: <通道值>"，
 * 便于 parseDoneStages 与 parseChannel 可靠解析；JSON 损坏时输出 "STATE_CORRUPT" 并停止。
 */
async function readResumeState() {
  const r = await runStage("ddd-resume-check", {
    label: "读取断点状态",
    agent: "scout",
    task: `只读检查 ${stateFile}（断点状态文件，schema 五字段：channel 字符串 / doneStages 数组 / lastStage / status / freezeAnchor 对象）。
规则：
1. 若文件存在且 JSON 有效：对 doneStages 数组中每个阶段键，输出一行机读行 "DONE: <阶段键>"（格式严格为 DONE: 空格 阶段键，如 "DONE: architect"）；另输出一行 "CHANNEL: <channel 值>"；再报告 lastStage 与 status 字段值。然后停止，不写任何文件。
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
// 并行段自身的完成（implement 与 test-plan）由其后继写入者 g5-int 合并记录，使任一子任务未完成时整段不被记为已完成。
function stateNote(stageKey, alsoDone) {
  const keys = [stageKey].concat(alsoDone || []);
  const list = keys.map((k) => `"${k}"`).join(", ");
  return `\n\n【状态记录】完成后更新 ${stateFile}：追加/合并 JSON 字段 {"channel":"${CHANNEL}","lastStage":"${stageKey}","status":"done"}，doneStages 数组补齐 ${list}，freezeAnchor 保留已有值不变。文件不存在则据此初始化（channel 固定为 ${CHANNEL}，freezeAnchor 按设计文档树的冻结清单补齐）。`;
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

// 交叉检查编排：以只读步骤经扩展工具面调用对应交叉检查，读工具回传的机读结论。
// 结论为 pass 即过；为 gap 即按失败路由退回责任方修正后重跑；无机读行即格式缺陷中断；
// 退回修复累计超过 maxFixRounds 仍报 gap 即升级用户，与缺陷回路共用同一计数语义。
async function runCrossCheck(check) {
  let round = 0;
  for (;;) {
    round += 1;
    const r = await runStage(`ddd-${check.key}${round > 1 ? "-r" + round : ""}`, {
      label: `${check.label}（第${round}轮）`,
      agent: "scout",
      task: `只读运行交叉检查，不修改任何文件：
1. 调用扩展工具 \`${check.tool}\`，参数 root="${root}"。
2. 该工具回传的 status 字段即机读结论，取值为 pass 或 gap；缺口时工具退出码非零属预期（缺口即以非零退出），不得据此判为工具故障。
3. 逐行照抄工具回传的关键结论（问题清单）。
4. 末行输出机读结论，格式严格为 "RESULT: pass"（无缺口）或 "RESULT: gap"（有缺口），逐字照抄工具回传的 status，不得改写或自判。
5. 不修改任何文件。`,
    }, { stage: check.key, round });
    if (r && r.__failed) return { failed: r };
    const verdict = String(r || "").match(/RESULT:\s*(pass|gap)\b/i);
    if (!verdict) {
      return {
        failed: {
          __failed: true,
          status: "escalated",
          failedStage: check.key,
          reason: `交叉检查 ${check.key} 报告缺少 RESULT 机读行（格式缺陷）`,
          stateFile,
          report: r,
          hint: "重新启动 workflow：已完成阶段自动跳过，该检查节点会重跑。",
        },
      };
    }
    if (verdict[1].toLowerCase() === "pass") return { ok: true, report: r };
    if (round > maxFixRounds) {
      return {
        failed: {
          __failed: true,
          status: "escalated",
          failedStage: check.key,
          reason: `交叉检查 ${check.key} 经 ${round - 1} 轮退回修复仍报 gap，按两轮上限强制升级用户`,
          stateFile,
          report: r,
          hint: check.route,
        },
      };
    }
    // gap → 按失败路由退回责任方修正，随后检查节点重跑
    const fix = await runStage(`ddd-${check.key}-fix-r${round}`, {
      label: `${check.fixLabel}（${check.key} 退回第${round}轮）`,
      agent: check.fixAgent,
      task: `${check.fixTask}\n\n【退回缘由】交叉检查 ${check.key} 报 gap，问题清单与期望值如下；按失败路由修正后由检查节点重跑：\n${String(r).slice(0, 4000)}`,
    }, { stage: check.fixStage, round });
    if (fix && fix.__failed) return { failed: fix };
  }
}

// 五个交叉检查节点的失败路由定义，逐条对应 DESIGN-crosscheck.md 第五节；节点键即阶段键。
const crossChecks = {
  "check-scope": {
    key: "check-scope", tool: "ddd_check_scope",
    label: "交叉检查 check-scope（集合同一与顺序一致）",
    fixAgent: "ddd-architect", fixStage: "architect", fixLabel: "退回架构设计者修正",
    fixTask: `在项目根 ${root} 依 check-scope 的问题清单修正架构产物：结构树、包清单、语言栈、技能清单与目录规划五处须同集，状态文件字段名与阶段键须同集。只修正声明面，不改契约。`,
    route: "集合不同一或计数不符退回架构设计者；顺序与前置矛盾属设计级问题，退回产生顺序声明的节点。",
  },
  "check-design": {
    key: "check-design", tool: "ddd_check_design",
    label: "交叉检查 check-design（同构与契约表头）",
    fixAgent: "ddd-decomposer", fixStage: "decomposer", fixLabel: "退回设计分解者修正",
    fixTask: `在项目根 ${root} 依 check-design 的问题清单修正分解设计产物：契约表与 AC 覆盖、设计树与代码目录逐层同构、义务编号唯一、契约表列头完整。只修正声明面，不改契约。`,
    route: "集合不同一或计数不符退回设计分解者；引用不可解析退回引用方；落点不完备补消费方或删除该声明。",
  },
  "check-file-design": {
    key: "check-file-design", tool: "ddd_check_file_design",
    label: "交叉检查 check-file-design（文件级清单与被依赖闭合）",
    fixAgent: "ddd-detail-designer", fixStage: "detail-design", fixLabel: "退回详细设计者修正",
    fixTask: `在项目根 ${root} 依 check-file-design 的问题清单修正文件级设计产物：文件级清单与目录级契约一致、被依赖清单闭合、覆盖判据达标。只修正声明面，不改契约。`,
    route: "引用不可解析退回详细设计者补齐或删除引用；落点不完备补消费方或删除该声明。",
  },
  "check-code": {
    key: "check-code", tool: "ddd_check_code",
    label: "交叉检查 check-code（导出符号与用例覆盖）",
    fixAgent: "ddd-implementer", fixStage: "implement", fixLabel: "退回实现者修正",
    fixTask: `在项目根 ${root} 依 check-code 的问题清单修正实现与测试产物：导出符号与两级设计签名一致、用例与模块级 AC 覆盖、基础能力独立用例齐备。若问题属测试计划漏场景则转派 ddd-test-designer。只修正实现与测试，不改契约。`,
    route: "导出符号或签名不符退回实现者；用例覆盖缺口退回单元测试制定者。",
  },
  "check-consistency": {
    key: "check-consistency", tool: "ddd_check_consistency",
    label: "交叉检查 check-consistency（命名集合与落点完备）",
    fixAgent: "ddd-fixer", fixStage: "defect-fix", fixLabel: "退回相应节点修正",
    fixTask: `在项目根 ${root} 依 check-consistency 的问题清单修正声明面：全量命名集合与计数声明三处一致、声明落点完备、无悬空引用。引用不可解析即补齐或删除引用，落点不完备即补消费方或删除声明。语义部分不在本检查范围。`,
    route: "引用不可解析退回引用方；落点不完备补消费方或删除该声明。",
  },
};

// 串行段：前置串行阶段与其后的交叉检查节点，按 A 通道键序排布。
// 只读阶段不写状态（interface-review），其后的写入者以 stateNote 的 alsoDone 合并记录；
// 交叉检查节点由只读步骤承担，其完成由后继写入者合并记录。
const serialPlan = [
  {
    kind: "stage", key: "requirements", runKey: "ddd-requirements", label: "采集并确认需求",
    agent: "ddd-requirements",
    task: `在项目根 ${root} 执行需求采集：分析已有材料与用户输入，产出 REQUIREMENTS.md（含项目类型判定）。需求未对齐即停止并报告待确认问题清单。`,
  },
  {
    kind: "stage", key: "architect", runKey: "ddd-architect", label: "设计架构与目录规划",
    agent: "ddd-architect",
    task: `读取 ${root}/REQUIREMENTS.md 与 ${root}/AC.md，产出 ${root}/ARCHITECTURE.md（技术环境、目录规划、横切规范、基础能力清单、改造影响评估、设计文档树根路径声明；二次开发且缺文档时先现状分析），并产出 AGENTS.md 与 GLOSSARY.md 初版。`,
  },
  { kind: "check", ...crossChecks["check-scope"] },
  {
    kind: "stage", key: "acceptance", runKey: "ddd-acceptance", label: "制定验收标准",
    agent: "ddd-acceptance", alsoDone: ["check-scope"],
    task: `读取 ${root}/REQUIREMENTS.md，产出 ${root}/AC.md（Given/When/Then，双向可追溯，正常、边界、异常三类路径均有覆盖）。发现需求矛盾即停止并报告。`,
  },
  {
    kind: "stage", key: "decomposer", runKey: "ddd-decomposer", label: "分解设计产出文档树",
    agent: "ddd-decomposer",
    task: `读取 ${root}/ARCHITECTURE.md 与 ${root}/AC.md，产出 docs/design/ 目录同构设计文档树（含签名级接口契约与实现文件粒度预判），分发模块级 AC。完成后附文档树清单。`,
  },
  { kind: "check", ...crossChecks["check-design"] },
  {
    kind: "stage", key: "detail-design", runKey: "ddd-detail-designer", label: "详细设计产出文件级设计",
    agent: "ddd-detail-designer", alsoDone: ["check-design"],
    task: `读取 ${root}/ARCHITECTURE.md、${root}/docs/design/ 目录级设计树与冻结的签名级接口契约，按目录逐层产出文件级设计 DESIGN-源文件名.md（文件级清单、被依赖清单与实现义务条目及编号）。层内按文件并行，lane 与设计树同构。`,
  },
  { kind: "check", ...crossChecks["check-file-design"] },
  {
    kind: "stage", key: "interface-review", runKey: "ddd-interface-reviewer", label: "接口契约独立评审", readOnly: true,
    agent: "ddd-interface-reviewer",
    task: `只读评审 ${root}/docs/design/ 全部 DESIGN.md 的签名级接口契约：能力覆盖/模块间重复/缺口/依赖方向（对照 ARCHITECTURE.md 依赖约束）/契约质量。输出缺陷清单与结论。报告末尾必须含机读行 "VERDICT: pass|conditional|fail"（判据见你的提示词）。发现接口设计问题报告 B 级缺陷。`,
  },
];

// 并行段：实现与测试规划（均为产出类，无进程执行）。仅实现者写状态，记录其只读前驱。
const parallelStages = [
  {
    key: "implement",
    label: "就近加载实现代码",
    agent: "ddd-implementer",
    alsoDone: ["interface-review", "check-file-design"],
    task: `按 ${root}/docs/design/ 文档树就近加载设计与文件级设计，实现各目录代码与单元测试。发现设计"做不出来"即停止并报告设计级缺陷。多模块时按互斥目录分批完成。`,
  },
  {
    key: "test-plan",
    label: "制定测试计划树",
    agent: "ddd-test-designer",
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
const resumeChannel = parseChannel(resumeReport);
if (resumeChannel && resumeChannel !== CHANNEL) {
  throw new Error(
    `状态文件 channel 为 ${resumeChannel}，与本脚本通道 ${CHANNEL} 不符：中断续跑并交根会话，不得跨通道误续跑。`,
  );
}
// 消费 stageRegistry：过滤非法阶段键，防止损坏的状态文件把无关键当作已完成阶段跳过
const validDoneStages = doneStages.filter((k) => stageRegistry.includes(k));
if (validDoneStages.length !== doneStages.length) {
  throw new Error(
    "状态文件 doneStages 含非法阶段键：" +
      doneStages.filter((k) => !stageRegistry.includes(k)).join(", ") +
      "。合法键见 references/spec-govern.md 的键清单。",
  );
}
doneStages = validDoneStages;

// 本轮实际未执行的阶段及原因：断点已完成者与升级中断者都记入，供根会话分清「已做完」与「没做」
const skippedStages = [];

// —— 串行段（前置阶段与其后的交叉检查节点；断点续跑：已完成则跳过）——
for (const step of serialPlan) {
  if (doneStages.includes(step.key)) {
    skippedStages.push({ stage: step.key, reason: "断点记录该阶段已完成，本轮跳过" });
    continue;
  }
  if (step.kind === "check") {
    const res = await runCrossCheck(step);
    if (res.failed) return res.failed;
    continue;
  }
  const r = await runStage(step.runKey + "-" + step.key, {
    label: step.label,
    agent: step.agent,
    task: step.task + (step.readOnly ? "" : stateNote(step.key, step.alsoDone)),
  }, { stage: step.key });
  if (r && r.__failed) return r;

  // G4.5 门控：接口评审非 pass 结论（fail/conditional 或无机读行）→ 中断返回根会话复核
  if (step.key === "interface-review") {
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
// 段内不记录本段完成：仅实现者写其只读前驱 interface-review 与 check-file-design（writer 唯一），
// 本段自身（implement 与 test-plan）的完成由后继写入者 g5-int 合并记录，使任一子任务未完成时 doneStages 都不出现 implement，续跑必重跑整段。
if (!doneStages.includes("implement") || !doneStages.includes("test-plan")) {
  const parallelResults = await runs.all(parallelStages.map(p => ({
    key: p.key,
    label: p.label,
    agent: p.agent,
    task: p.key === "implement" ? p.task + stateNote(p.key, p.alsoDone) : p.task,
  })));
  // runs.all 收集失败而不抛错：任一子任务回执 ok 为 false 即整段未完成，直接返回结构化失败且不写状态
  const failedParallel = Array.isArray(parallelResults) ? parallelResults.find((r) => r && r.ok === false) : null;
  if (failedParallel) {
    return {
      __failed: true,
      status: "failed",
      failedStage: "implement",
      stateFile,
      error: "并行段子任务未成功完成：" + (failedParallel.error || "未知错误"),
      hint: "并行段未写入 doneStages，重新启动 workflow 将重跑整段（实现与测试规划）。",
    };
  }
} else {
  skippedStages.push({ stage: "implement", reason: "断点记录该阶段已完成，本轮跳过" });
  skippedStages.push({ stage: "test-plan", reason: "断点记录该阶段已完成，本轮跳过" });
}

// —— 交叉检查 check-code（实现与测试规划交出后）——
if (doneStages.includes("check-code")) {
  skippedStages.push({ stage: "check-code", reason: "断点记录该阶段已完成，本轮跳过" });
} else {
  const res = await runCrossCheck(crossChecks["check-code"]);
  if (res.failed) return res.failed;
}

// —— G5-INT 集成收口门（与手工档标准一致） ——
// 职责纯净分离：门禁只做构建与集成问题修复，禁止执行全量测试套件——
// 全量测试的唯一主体是 ddd-tester 首轮执行，其结果作为 G5-INT 的最终证据
if (!doneStages.includes("g5-int")) {
  const r = await runStage("ddd-int-check", {
    label: "G5-INT 集成收口检查",
    agent: "ddd-fixer",
    task: `在项目根 ${root} 执行集成收口检查（G5-INT 门）：1) 全项目构建通过；2) 检查各接缝自测报告齐备且 TEST_PLAN 对齐说明完整，声明测试就绪；3) 核对实现文件粒度与 DESIGN 预判一致，应拆未拆报告 C 级，同时核对各接缝实现者的约定遵循自检齐备；4) 修复因多接缝合并产生的集成问题，仅实现级修改。**禁止执行全量测试套件，全量测试由 ddd-tester 负责**。若发现设计级矛盾（集成暴露接口不匹配），停止并报告 B 级缺陷。` + stateNote("g5-int", ["implement", "test-plan", "check-code"]),
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
      detail: "A/B 级缺陷不适用自动修复，需根会话依据缺陷四级路由节仲裁路由；A级必须升级用户确认。",
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

// —— 交叉检查 check-consistency（测试执行交出后） ——
// 触发条件同审计：升级中断时跳过并注明原因
if (escalated) {
  skippedStages.push({ stage: "check-consistency", reason: `测试段以升级中断收尾（${escalated.reason}），一致性与落点检查留待根会话仲裁后单独派发` });
} else if (doneStages.includes("check-consistency")) {
  skippedStages.push({ stage: "check-consistency", reason: "断点记录该阶段已完成，本轮跳过" });
} else {
  const res = await runCrossCheck(crossChecks["check-consistency"]);
  if (res.failed) {
    if (res.failed.status === "escalated") escalated = { reason: res.failed.reason, detail: res.failed.reason, round };
    else return res.failed;
  }
}

// —— 声明面审计阶段（测试循环正常结束后） ——
// 触发条件：escalated 为空，即测试全绿或未通过项已定级且未超轮次；升级中断时跳过并注明原因
let auditReport = null;
if (escalated) {
  skippedStages.push({ stage: "audit", reason: `测试或一致性段以升级中断收尾（${escalated.reason}），声明面审计留待根会话仲裁后单独派发` });
} else if (doneStages.includes("audit")) {
  skippedStages.push({ stage: "audit", reason: "断点记录该阶段已完成，本轮跳过" });
} else {
  const auditRun = await runStage("ddd-audit", {
    label: "声明面审计",
    agent: "ddd-auditor",
    task: `在项目根 ${root} 执行声明面审计（G6 门禁）：核验变更记录当轮声称与实际产物是否相符，输出审计报告与修剪清单；报告标题下方给出建议归档名，格式为 G6-序号-版本，序号取 docs/audits/ 现存最大序号加一；只读，不落盘，审计报告的落盘由根会话执行。` + stateNote("audit", ["check-consistency"]),
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
  note: "escalated 非空时，根会话须依据缺陷四级路由节处理对应级别缺陷或升级用户；auditReport 非空时，审计报告的落盘由根会话执行；skippedStages 列出本轮未执行的阶段与原因；状态文件支持断点续跑。",
};
