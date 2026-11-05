/**
 * 目标：把设计侧的可执行义务与任务树节点做核销差集、取值域、归属与冻结五面断言，作为义务核销链的机械判据实现。
 * 范围：设计侧条目抽取、模块节点文件与根索引解析、差集与状态断言、收口里程碑清零、相邻两轮快照冻结比对；不包含节点文件的写入、命令行入口。
 * 单一权威：条目来源与来源派生编号见规范「接口先行与冻结」节的义务核销条；表格与章节解析原语取自 lib/span-compare.js，本模块不另写一份。
 * 不适用出口：docs/board 目录不存在时报不适用，不计缺口，使未启用任务树的既有项目零影响。快照文件缺失时冻结断言报不适用而非漂移。
 */

const fs = require("fs");
const path = require("path");
const { readFileText } = require("./text.js");
const { readTable, sectionBody } = require("./span-compare.js");

const BOARD_DIR_REL = ["docs", "board"];
const BOARD_INDEX_REL = ["docs", "board", "BOARD.md"];
const SNAPSHOT_REL = ["docs", "board-history.json"];
const TYPE_VALUES = new Set(["里程碑", "模块", "义务", "执行"]);
const DEFINITE_VALUES = new Set(["待定", "已确定"]);
const STATE_VALUES = new Set(["未开始", "进行中", "已核销", "不适用", "已废弃"]);
const OPEN_STATES = new Set(["未开始", "进行中"]);
const CLOSED_STATES = new Set(["已核销", "不适用", "已废弃"]);

// 单元格取值：去反引号与强调标记，再去首尾空白
const cell = (value) => String(value || "").replace(/[`*]/g, "").trim();

// 设计侧条目抽取：编号由来源派生而非顺序分配，使来源稳定即编号稳定，插入新条目不影响既有编号
function extractObligations(designText) {
  const out = [];
  const contract = readTable(sectionBody(designText, "对外接口与约定") || "", /接口名/);
  if (contract) {
    const nameIdx = contract.headers.findIndex((h) => /接口名/.test(h));
    const consumerIdx = contract.headers.findIndex((h) => /消费方/.test(h));
    for (const row of contract.rows) {
      const name = cell(row[nameIdx]).replace(/\s/g, "");
      if (!name) continue;
      out.push({ id: `OB-IF-${name}`, coverage: consumerIdx >= 0 ? cell(row[consumerIdx]) : "" });
    }
  }
  if (/可观测性契约/.test(designText)) out.push({ id: "OB-OBS", coverage: "" });
  const files = readTable(sectionBody(designText, "实现文件粒度预判") || "", /实现文件/);
  if (files) {
    const fileIdx = files.headers.findIndex((h) => /实现文件/.test(h));
    for (const row of files.rows) {
      const file = cell(row[fileIdx]);
      if (!file) continue;
      out.push({ id: `OB-FILE-${file}`, coverage: file });
    }
  }
  const moduleAcs = readTable(sectionBody(designText, "模块级验收要点") || "", /模块级 AC/);
  if (moduleAcs) {
    const acIdx = moduleAcs.headers.findIndex((h) => /模块级 AC/.test(h));
    for (const row of moduleAcs.rows) {
      const ac = cell(row[acIdx]).replace(/\s/g, "");
      if (!ac) continue;
      out.push({ id: `OB-AC-${ac}`, coverage: "" });
    }
  }
  return out;
}

// 节点表解析：表头含「节点编号」的表格，逐行取八列
function readNodeTable(text) {
  const table = readTable(text, /节点编号/);
  if (!table) return null;
  const idx = (re) => table.headers.findIndex((h) => re.test(h));
  const iId = idx(/节点编号/);
  const iParent = idx(/父节点/);
  const iType = idx(/类型/);
  const iDef = idx(/确定度/);
  const iState = idx(/状态/);
  const iCov = idx(/覆盖范围/);
  const iEv = idx(/证据/);
  const iReg = idx(/登记/);
  return table.rows
    .map((row) => ({
      id: cell(row[iId]),
      parent: iParent >= 0 ? cell(row[iParent]) : "",
      type: cell(row[iType]),
      definite: cell(row[iDef]),
      state: cell(row[iState]),
      coverage: iCov >= 0 ? cell(row[iCov]) : "",
      evidence: iEv >= 0 ? cell(row[iEv]) : "",
      registry: iReg >= 0 ? cell(row[iReg]) : "",
    }))
    .filter((node) => node.id);
}

// 收口标记：根索引中形如 BOARD: {"milestone":"M-01","status":"closed"} 的机读行，逐行解析
function readClosedMilestones(boardText) {
  const closed = new Set();
  for (const m of String(boardText).matchAll(/BOARD:\s*(\{[^\n]*\})/g)) {
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed && parsed.status === "closed" && typeof parsed.milestone === "string") closed.add(parsed.milestone);
    } catch {
      // 机读行不可解析时交由模板声明约束，此处不阻断
    }
  }
  return closed;
}

// 快照：{ version, history: [{ at, round, nodes: { id: state } }] }，取末两条比对已核销节点的改写与删除
function readSnapshotRounds(root) {
  const text = readFileText(path.join(root, ...SNAPSHOT_REL));
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    const history = Array.isArray(data && data.history) ? data.history : null;
    return history && history.length ? history : null;
  } catch {
    return null;
  }
}

// 节点行合法性：取值域、确定度门槛、已核销的证据要求、未闭合项的归宿
function checkNode(node, nodesRel, problems) {
  if (!TYPE_VALUES.has(node.type)) problems.push(`${nodesRel} 节点 ${node.id} 类型取值非法：${node.type || "空"}`);
  if (!DEFINITE_VALUES.has(node.definite)) problems.push(`${nodesRel} 节点 ${node.id} 确定度取值非法：${node.definite || "空"}`);
  if (!STATE_VALUES.has(node.state)) problems.push(`${nodesRel} 节点 ${node.id} 状态取值非法：${node.state || "空"}`);
  if (node.state === "已核销" && (node.evidence === "" || node.evidence === "无")) {
    problems.push(`${nodesRel} 节点 ${node.id} 已核销但证据指针为空`);
  }
  if (node.state === "不适用" && node.registry === "") {
    problems.push(`${nodesRel} 节点 ${node.id} 不适用但未写理由`);
  }
  if (node.definite === "待定" && node.state !== "未开始") {
    problems.push(`${nodesRel} 节点 ${node.id} 待定却处于 ${node.state}，确定后方可实施`);
  }
  if (node.state === "已废弃" && node.registry === "") {
    problems.push(`${nodesRel} 节点 ${node.id} 已废弃但未写登记信息`);
  }
  if (OPEN_STATES.has(node.state)) {
    const hasDebt = /D-\d+/.test(node.registry);
    const hasOwner = /承接方|根会话|ddd-/.test(node.registry);
    if (!hasDebt && !hasOwner) problems.push(`${nodesRel} 节点 ${node.id} 处于 ${node.state} 且未登记债务或承接方`);
  }
}

function checkObligations(env) {
  const { root, designDir, designFiles, relPath } = env;
  const problems = [];
  const warnings = [];
  const boardDir = path.join(root, ...BOARD_DIR_REL);
  if (!fs.existsSync(boardDir)) {
    warnings.push(`任务树未启用：${BOARD_DIR_REL.join("/")} 不存在，义务核销断言不适用`);
    return { problems, warnings };
  }
  // 统一到相对项目根的 posix 形态再算模块目录：designDir 与传入文件路径的绝对与相对形态不保证一致
  const toRel = (target) => relPath(path.isAbsolute(target) ? target : path.join(root, target)).split(path.sep).join("/");
  const designRel = toRel(designDir);
  const nodesByModule = new Map();
  const closedMilestones = readClosedMilestones(readFileText(path.join(root, ...BOARD_INDEX_REL)));

  for (const file of designFiles) {
    const rel = toRel(file);
    const designText = readFileText(file);
    const moduleDirRel = path.posix.relative(designRel, path.posix.dirname(rel));
    const nodesRel = [BOARD_DIR_REL.join("/"), moduleDirRel, "NODES.md"].filter((part) => part && part !== ".").join("/");
    const expected = extractObligations(designText);
    if (expected.length === 0) continue;
    const nodesText = readFileText(path.join(root, ...nodesRel.split("/")));
    if (!nodesText) {
      problems.push(`${rel} 抽取出 ${expected.length} 条义务，但节点文件 ${nodesRel} 不存在`);
      continue;
    }
    const nodes = readNodeTable(nodesText) || [];
    if (nodes.length === 0) {
      problems.push(`${nodesRel} 未含可解析的节点表，表头须含「节点编号」`);
      continue;
    }
    // 编号唯一：同文件内不得重复，重复即无法定位核销对象
    const seen = new Set();
    for (const node of nodes) {
      if (seen.has(node.id)) problems.push(`${nodesRel} 节点编号重复：${node.id}`);
      seen.add(node.id);
    }
    const nodeIds = new Set(nodes.map((node) => node.id));
    for (const item of expected) {
      if (!nodeIds.has(item.id)) problems.push(`${rel} 的义务 ${item.id} 在 ${nodesRel} 中无对应节点`);
    }
    // 父节点存在性：父节点须为根、为同文件节点，或为根索引中的里程碑
    const parents = new Set(nodes.map((node) => node.parent).filter(Boolean));
    for (const parent of parents) {
      if (parent === "根" || parent === "无" || nodeIds.has(parent) || closedMilestones.has(parent)) continue;
      const inBoard = readFileText(path.join(root, ...BOARD_INDEX_REL))?.includes(parent);
      if (!inBoard) problems.push(`${nodesRel} 的父节点 ${parent} 在节点表与根索引中均不存在`);
    }
    // 覆盖范围可解析：义务节点的覆盖范围须能在就近 DESIGN 正文中找到，否则无法定位落地面
    for (const node of nodes) {
      if (node.type !== "义务" || node.coverage === "") continue;
      if (!designText.includes(node.coverage)) problems.push(`${nodesRel} 节点 ${node.id} 的覆盖范围「${node.coverage}」不在 ${rel} 正文中`);
    }
    for (const node of nodes) checkNode(node, nodesRel, problems);
    nodesByModule.set(nodesRel, nodes);
  }

  // 收口里程碑清零：被标 closed 的里程碑，其名下节点须全为闭合态
  if (closedMilestones.size > 0) {
    for (const [nodesRel, nodes] of nodesByModule) {
      for (const node of nodes) {
        if (!closedMilestones.has(node.parent)) continue;
        if (!CLOSED_STATES.has(node.state)) problems.push(`${nodesRel} 节点 ${node.id} 属于已收口里程碑 ${node.parent} 但处于 ${node.state}`);
      }
    }
  }

  // 快照冻结：已核销节点不得在相邻两轮间被改写或删除
  const rounds = readSnapshotRounds(root);
  if (!rounds) {
    warnings.push(`快照文件 ${SNAPSHOT_REL.join("/")} 缺失，冻结断言不适用`);
  } else if (rounds.length >= 2) {
    const prev = (rounds[rounds.length - 2] || {}).nodes || {};
    const last = (rounds[rounds.length - 1] || {}).nodes || {};
    for (const [id, state] of Object.entries(prev)) {
      if (state === "已核销" && last[id] !== "已核销") problems.push(`${SNAPSHOT_REL.join("/")} 已核销节点 ${id} 在相邻两轮间被改写或删除`);
    }
  }

  return { problems, warnings };
}

module.exports = { extractObligations, checkObligations };
