/**
 * 目标：把接口冻结锚点的读写、目录级「对外接口与约定」节的区间截取与范围限定 diff 收敛为单一实现，
 *   使 governance-check 与 trace-check 共用同一套定位与判定口径，不各写一份正则而漂移。
 * 范围：节区间截取（extractContractSection / normalizeSection）、冻结清单的读写与校验（readFreeze / writeFreeze / validateFreezeRecord）、
 *   与冻结锚点相比的接口节 diff（diffInterfaceSection），以及「diff 非空即行为变更、变更类型声明不符即判缺口」的判定（interfaceFreezeFindings）。
 * 不包含：契约内容的语义校验、AC 文本是否真同步的语义判定（机械侧以「变更记录」的变更类型声明为代理）、结构趋势与用例集合方向判定。
 * 设计依据：DESIGN-designtree.md 第四节（冻结锚点与变更判定五步）与 DESIGN-decisions.md 的 D20、D53。
 * 单源语义：目录级「对外接口与约定」与文件级「对外接口清单」是两节，本正则只认前者；口径只在此定义，调用方不得另写一份。
 * 退化路径：被开发项目非 git 仓库时本版不实现快照比对，报无法判定而非缺口；引用不存在与「该引用下无此文件」分开报，不混为一谈。
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { readFileText } = require("./text.js");

// 目录级契约节的区间头：标题允许带序号前缀，取自标题起至下一同级标题前，使文档内非接口段落的改动不进入比对
const CONTRACT_SECTION_RE = /(##\s*(?:[一二三四五六七八九十\d]+[、.．]?\s*)?对外接口与约定[^\n]*)([\s\S]*?)(?=\n## |$)/;
const FREEZE_NAME = "FREEZE.json";

// 冻结锚点是冻结时刻的 git commit 引用；短 sha 与完整 sha 均接受，非十六进制者判不可用
function isWellFormedAnchor(value) {
  return typeof value === "string" && /^[0-9a-fA-F]{4,40}$/.test(value);
}

// 目录级契约节：回传标题与正文，两节定位只此一处
function extractContractSection(text) {
  const m = String(text || "").match(CONTRACT_SECTION_RE);
  return m ? { title: m[1], body: m[2] } : null;
}

// 节内容规范化：逐行去首尾空白后以换行连接，去尾部空行；缺节回 null，与「节存在但为空」区分
function normalizeSection(text) {
  const section = extractContractSection(text);
  if (!section) return null;
  const lines = `${section.title}\n${section.body}`.split("\n").map((line) => line.trim());
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

// 冻结清单落点：清单随设计树根存放，根路径变更时随之迁移
function freezeRel(designRootRel) {
  const norm = String(designRootRel || "").replace(/\\/g, "/").replace(/\/+$/, "");
  return `${norm}/${FREEZE_NAME}`;
}

function freezeAbsPath(root, designRootRel) {
  return path.join(root, ...freezeRel(designRootRel).split("/"));
}

// 清单结构校验：字段齐备且取值为可解析形态，不合法回问题描述，合法回 null
function validateFreezeRecord(record) {
  if (!record || typeof record !== "object") return "冻结清单不是对象";
  if (!isWellFormedAnchor(record.anchor)) return "冻结清单缺 anchor 或 anchor 不是 commit 引用";
  if (typeof record.at !== "string" || !record.at.trim()) return "冻结清单缺 at 时间戳";
  if (typeof record.scope !== "string" || !record.scope.trim()) return "冻结清单缺 scope";
  return null;
}

// 读取：清单不存在、不可解析或字段不合法时 record 回 null 并把原因带到 issue，调用方据此报无法判定而非缺口
function readFreeze(root, designRootRel) {
  const rel = freezeRel(designRootRel);
  const abs = freezeAbsPath(root, designRootRel);
  if (!fs.existsSync(abs)) return { rel, path: abs, record: null, issue: "未找到冻结清单" };
  let parsed;
  try {
    parsed = JSON.parse(readFileText(abs));
  } catch (e) {
    return { rel, path: abs, record: null, issue: "冻结清单不可解析" };
  }
  const invalid = validateFreezeRecord(parsed);
  return { rel, path: abs, record: invalid ? null : parsed, issue: invalid || null };
}

// 写入：接口冻结节点把当前 commit 记为锚点，目录按需创建，回传写入相对路径
function writeFreeze(root, designRootRel, record) {
  const abs = freezeAbsPath(root, designRootRel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return freezeRel(designRootRel);
}

function runGit(root, args) {
  return spawnSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

function isGitRepo(root) {
  const res = runGit(root, ["rev-parse", "--is-inside-work-tree"]);
  return res.status === 0 && String(res.stdout).trim() === "true";
}

// 取锚点版本下某一文件的正文：引用不存在与「该文件在该引用下不存在」分开报，使调用方给不同措辞
function gitShowAt(root, ref, repoRel) {
  const exists = runGit(root, ["cat-file", "-e", `${ref}^{commit}`]);
  if (exists.status !== 0) return { ok: false, reason: "invalid-anchor" };
  const res = runGit(root, ["show", `${ref}:${repoRel}`]);
  if (res.status !== 0) return { ok: false, reason: "no-baseline" };
  return { ok: true, content: String(res.stdout) };
}

// 当前 HEAD 的 commit 引用：供接口冻结节点写入清单
function headCommit(root) {
  const res = runGit(root, ["rev-parse", "HEAD"]);
  return res.status === 0 ? String(res.stdout).trim() : null;
}

// 接口节 diff：只比对「对外接口与约定」节区间，非接口段落的改动不进入判定
function diffInterfaceSection(root, repoRel, currentText, anchor) {
  if (!isGitRepo(root)) return { status: "not-git", detail: "被开发项目非 git 仓库，快照退化路径本版未实现" };
  if (!isWellFormedAnchor(anchor)) return { status: "invalid-anchor", detail: "冻结锚点缺失或不是 commit 引用" };
  const base = gitShowAt(root, anchor, repoRel);
  if (!base.ok) {
    return base.reason === "invalid-anchor"
      ? { status: "invalid-anchor", detail: `冻结锚点 ${anchor} 不是本仓库的 commit` }
      : { status: "no-baseline", detail: `冻结锚点下无 ${repoRel}，无基线可比` };
  }
  const now = normalizeSection(currentText);
  const before = normalizeSection(base.content);
  if (now === before) return { status: "unchanged", detail: "" };
  return { status: "changed", detail: `接口节自 ${anchor.slice(0, 12)} 起有改动` };
}

// 「变更记录」表列序固定为 轮次 | 变更类型 | 冻结锚点 | 结构度量 | 依据，取自 templates.md 的 DESIGN 模板；
// 该表是变更类型与冻结锚点的既有承载，本模块复用其机读形态，不新造并行的状态文件
function parseChangeRows(text) {
  const m = String(text || "").match(/(?:^|\n)##\s*(?:[一二三四五六七八九十\d]+[、.．]?\s*)?变更记录[^\n]*\n([\s\S]*?)(?=\n## |$)/);
  if (!m) return null;
  const rows = [];
  for (const line of m[1].split("\n")) {
    if (!/^\s*\|/.test(line)) continue;
    if (/^\s*\|[\s:|-]+\|?\s*$/.test(line)) continue; // 表头分隔行
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3 || /^轮次$/.test(cells[0])) continue;
    rows.push({ type: cells[1], anchor: cells[2] });
  }
  return rows;
}

// 变更类型归类：重建属行为变更的特例（见「变更类型」条），故与行为变更同判；一格并列两类时归为已知之外
function classifyChangeType(raw) {
  const type = String(raw || "");
  const behavior = /行为变更|重建/.test(type);
  const refactor = /重构/.test(type);
  if (behavior && refactor) return null;
  if (behavior) return "behavior";
  if (refactor) return "refactor";
  return null;
}

// 冻结锚点逐条判定：以接口节 diff 与「变更记录」最新一轮的变更类型声明为判据。
// 声明行为变更或重建即视为已走 AC 同步流程，声明重构却 diff 非空、或 diff 非空却未声明，均判缺口（未同步 AC）。
function interfaceFreezeFindings({ root, designRootRel, designFiles, relPath }) {
  const problems = [];
  const warnings = [];
  const checked = { anchors: 0, unchanged: 0, changed: 0, undetermined: 0 };
  const manifest = readFreeze(root, designRootRel);
  if (manifest.issue) warnings.push(`${manifest.rel} 冻结清单不可用（${manifest.issue}），接口节 diff 回退到「变更记录」锚点列`);
  else checked.anchors++;

  for (const file of designFiles) {
    const rel = relPath(file).split(path.sep).join("/");
    const text = readFileText(file);
    const rows = parseChangeRows(text);
    const latest = rows && rows.length ? rows[rows.length - 1] : null;
    const declared = latest ? classifyChangeType(latest.type) : null;
    const anchor = manifest.record && manifest.record.anchor ? manifest.record.anchor
      : (latest && isWellFormedAnchor(latest.anchor) ? latest.anchor : null);
    const diff = diffInterfaceSection(root, rel, text, anchor);
    const declarationNote = latest
      ? `「变更记录」最新一轮声明「${latest.type}」`
      : "「变更记录」无数据行，未声明变更类型";

    if (diff.status === "not-git" || diff.status === "invalid-anchor" || diff.status === "no-baseline") {
      checked.undetermined++;
      warnings.push(`${rel} 无法判定接口节 diff：${diff.detail}`);
      continue;
    }
    if (diff.status === "unchanged") {
      checked.unchanged++;
      if (declared === "behavior") problems.push(`${rel} ${declarationNote}，但接口节自冻结锚点起无改动，属零 delta：声称行为变更而接口未变`);
      continue;
    }
    checked.changed++;
    if (declared === "behavior") continue; // 声明行为变更或重建即视为已同步 AC
    if (declared === "refactor") problems.push(`${rel} ${declarationNote}，但接口节自冻结锚点起有改动：重构不应改变接口`);
    else problems.push(`${rel} 接口节自冻结锚点起有改动，${declarationNote}，行为变更须声明行为变更或重建并同步受影响 AC`);
  }
  return { problems, warnings, checked };
}

module.exports = {
  CONTRACT_SECTION_RE,
  extractContractSection,
  normalizeSection,
  validateFreezeRecord,
  readFreeze,
  writeFreeze,
  headCommit,
  isGitRepo,
  diffInterfaceSection,
  parseChangeRows,
  classifyChangeType,
  interfaceFreezeFindings,
};
