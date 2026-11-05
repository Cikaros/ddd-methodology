#!/usr/bin/env node
/**
 * 目标：把契约指纹与结构趋势的门禁判定收敛为单个 JSON 文档，作为 G4、G4.5、G5、G5-INT 与 G6 的 typed gate 证据源。
 * 范围：五项机械可判定事项——各 DESIGN.md 契约指纹齐备且与契约段实算值一致；存在设计文档树时其根路径已在
 *   ARCHITECTURE.md 声明（未声明即阻断，不得回退 docs/design 而放行）；docs/health.json 最新一条相对上一条
 *   问题类计数未增加（问题类计数的键集合以本脚本内的 TREND_BLOCKING_KEYS 常量为唯一权威，规范只作抽象描述并指向本脚本）；
 *   已记录指纹的 DESIGN 其「变更记录」节是否有数据行（无则仅告警不阻断）；「变更记录」最新一轮的变更类型与该轮相对上一轮的
 *   契约指纹变化相符（声明行为变更或重建却指纹未变、声明重构却指纹变化即阻断；不足两轮或类型不在已知之列时报无法判定并说明，不静默通过）。
 * 不包含：行为等价性、用例集合增减方向、变更类型声明与行为产物是否相符、结构度量是否真改善等需语义判断的事项，交由 ddd-tester 与 ddd-auditor。
 * 零 delta 拦截的对象是「变更记录」表最新一轮相对上一轮的类型与指纹，两轮的比对基准是表内自带的上一轮契约指纹。
 * 用法：node governance-check.js <项目根>
 * 输出形态：单个 JSON 文档，且仅此一个；字段 limitBytes 给出输出上限，供消费端自证口径。
 * 末行机读结论：`verdict` 字段，取值 ok 或 blocked
 * 退出码：0 通过，1 阻断。门禁地位：G5-INT 门槛证据，退出码非零即 blocked
 * 输出上限：12000 字节，按 UTF-8 字节计量；超限截断 reasons，并在 warnings 给出总数与已列数
 * 非目标项目：无设计文档树时零考察，verdict 为 ok，确保对本方法论仓库自身等场景零误伤；未声明根路径的阻断仅在
 *   设计文档树实际存在时生效，无树的项目不受影响。
 * 依赖：文本读取取 ./lib/text.js 的 readFileText，本脚本不再内联读取实现。
 * 规范依据：规范「质量门禁」节的 G5-INT 证据源行、「结构与注释的机械证据」节的脚本消费契约表，
 *   与「结构与契约的演进治理」节的指纹门槛条。
 */

const fs = require("fs");
const path = require("path");
// 读取失败回空串而非中断：DESIGN 读不到时仍走指纹校验并给出结构化结论，消费端不以栈信息判读
const { readFileText, num } = require("./lib/text.js");
const { DEFAULT_LIMIT_BYTES, capText } = require("./lib/truncate.js");
const { HEALTH_REL, artifactReadPath } = require("./lib/paths.js");
const { checkContractFingerprint, isWellFormedFingerprint } = require("./fingerprint");
const { absoluteDesignDir } = require("./design-root");
const { walk, DOC_TREE_SKIP_DIR_NAMES } = require("./lib/walk");

const root = process.argv[2] || process.cwd();

// 趋势阻断面：问题类计数键集合，本常量为唯一权威，规范只作抽象描述并指向本脚本。
// 超限类、死代码类与注释质量类属问题类计数，最新一条相对上一条上升即阻断。
const TREND_BLOCKING_KEYS = [
  "oversized", // 超限类：源码与基础能力超阈值文件数
  "oversizedBase", // 超限类：基础能力超 300 行
  "docOversized", // 超限类：文档超阈值
  "contractOversized", // 超限类：设计文档契约数超上限
  "commentedCode", // 死代码类：连续注释代码块
  "compatMarkers", // 死代码类：兼容层标记
  "orphans", // 死代码类：无引用文件
  "bannedComments", // 注释质量类：违禁模式
  "staleComments", // 注释质量类：过时引用
];
// 非阻断项：接近上限类属预警阈值、未构成问题，弱信号重复类需语义判定，二者不阻断，只在报告中列出
const TREND_NON_BLOCKING_KEYS = ["nearLimit", "docNearLimit", "contractNearLimit", "duplicates"];

// 「变更记录」节是否存在至少一条数据行（表头与分隔行不计）
function hasChangeRecordRow(text) {
  const m = text.match(/(?:^|\n)##\s*(?:[一二三四五六七八九十\d]+[、.．]?\s*)?变更记录[^\n]*\n?([\s\S]*?)(?=\n## |$)/);
  if (!m) return false;
  const rows = m[1].split("\n").filter((l) => /^\s*\|/.test(l));
  const nonSep = rows.filter((l) => !/^\s*\|[\s:|-]+\|?\s*$/.test(l));
  return nonSep.length > 1; // 去掉表头后仍有数据行
}

// 「变更记录」表列序固定为 轮次 | 变更类型 | 契约指纹 | 结构度量 | 依据，取自 templates.md 的 DESIGN 模板；
// 该表是变更类型与契约指纹的既有承载，本脚本复用其机读形态，不新造并行的状态文件。无该节时回 null，
// 由 hasChangeRecordRow 的告警承接，不在此重复报同一事。
function parseChangeRows(text) {
  const m = text.match(/(?:^|\n)##\s*(?:[一二三四五六七八九十\d]+[、.．]?\s*)?变更记录[^\n]*\n([\s\S]*?)(?=\n## |$)/);
  if (!m) return null;
  const rows = [];
  for (const line of m[1].split("\n")) {
    if (!/^\s*\|/.test(line)) continue;
    if (/^\s*\|[\s:|-]+\|?\s*$/.test(line)) continue; // 表头分隔行
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3 || /^轮次$/.test(cells[0])) continue;
    rows.push({ type: cells[1], fingerprint: cells[2] });
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

// 指纹列取值：优先取反引号内码点，退而取整格去空白，与 templates 的书写形态兼容
function changeFingerprint(cell) {
  const s = String(cell || "");
  const m = s.match(/`([^`]*)`/);
  return (m ? m[1] : s).trim();
}

// 零 delta 拦截：以「变更记录」最新一轮相对上一轮的变更类型与契约指纹变化为判据，
// 声明行为变更却指纹未变、或声明重构却指纹变化即报缺口；不足以判定时报无法判定，不静默通过。
function checkChangeTypeDelta(text) {
  const rows = parseChangeRows(text);
  if (rows === null) return {};
  if (rows.length < 2) return { undetermined: "「变更记录」不足两轮，无上一轮契约指纹可比，无法判定变更类型与指纹是否相符" };
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const kind = classifyChangeType(last.type);
  if (!kind) return { undetermined: `「变更记录」最新一轮的变更类型「${last.type}」不在已知之列（重构、行为变更、重建），无法判定` };
  const fpLast = changeFingerprint(last.fingerprint);
  const fpPrev = changeFingerprint(prev.fingerprint);
  if (!isWellFormedFingerprint(fpLast) || !isWellFormedFingerprint(fpPrev)) {
    return { undetermined: "「变更记录」最新一轮或上一轮的契约指纹缺失或不足八位十六进制，无法判定" };
  }
  if (kind === "behavior" && fpLast === fpPrev) {
    return { gap: `「变更记录」最新一轮声明「${last.type}」，但契约指纹与上一轮同为 ${fpLast}，属零 delta：声称有设计变更而指纹未变` };
  }
  if (kind === "refactor" && fpLast !== fpPrev) {
    return { gap: `「变更记录」最新一轮声明重构，但契约指纹由上一轮 ${fpPrev} 变为 ${fpLast}：重构不应改变指纹` };
  }
  return { checked: true };
}


function check() {
  const reasons = [];
  const warnings = [];
  const checked = { designs: 0, fingerprints: 0, thresholdFiles: 0, thresholdBaseFiles: 0, trend: "none" };

  const designRoot = absoluteDesignDir(root);
  const hasDesignDir = fs.existsSync(designRoot.dir);
  // 存在设计文档树却未声明根路径即阻断：回退 docs/design 会绕过「根路径须在 ARCHITECTURE 声明」的要求，机械门不得据此放行。
  if (hasDesignDir && !designRoot.declared) reasons.push("ARCHITECTURE.md 未声明设计文档树根路径，存在设计文档树却无法确认其权威根路径");
  // 无设计文档树时不判定：非 DDD 项目零考察，避免误伤。
  if (hasDesignDir) {
    // 设计树是待校验对象，须用不排除 docs/build 等命名的口径，否则 docs/design 下名为 build/dist 的子目录会被漏检
    const designFiles = walk(designRoot.dir, DOC_TREE_SKIP_DIR_NAMES).filter((f) => /DESIGN.*\.md$/i.test(path.basename(f)));
    checked.designs = designFiles.length;
    for (const f of designFiles) {
      const rel = path.relative(root, f).split(path.sep).join("/");
      const text = readFileText(f);
      const issue = checkContractFingerprint(text);
      if (issue) reasons.push(`${rel} ${issue}`);
      else checked.fingerprints++;
      if (!hasChangeRecordRow(text)) warnings.push(`${rel} 变更记录节无数据行，建议补记变更类型与依据`);
      const delta = checkChangeTypeDelta(text);
      if (delta.undetermined) warnings.push(`${rel} ${delta.undetermined}`);
      if (delta.gap) reasons.push(`${rel} ${delta.gap}`);
      if (delta.checked) checked.changeTypes = (checked.changeTypes || 0) + 1;
    }
  }

  const healthPath = artifactReadPath(root, HEALTH_REL);
  if (healthPath) {
    let history = [];
    try {
      const parsed = JSON.parse(readFileText(healthPath));
      history = Array.isArray(parsed.history) ? parsed.history : [];
    } catch (e) {
      warnings.push(`${HEALTH_REL} 无法解析，趋势未判`);
    }
    if (history.length >= 1) {
      checked.thresholdFiles = num(history[history.length - 1].oversized);
      checked.thresholdBaseFiles = num(history[history.length - 1].oversizedBase);
    }
    if (history.length < 2) {
      checked.trend = "insufficient";
    } else {
      const prev = history[history.length - 2];
      const last = history[history.length - 1];
      // 阻断面为问题类计数：任一键上升即阻断；非阻断项仅随报告列出
      const risen = [];
      for (const key of TREND_BLOCKING_KEYS) {
        const before = num(prev[key]);
        const after = num(last[key]);
        if (after > before) risen.push({ key, before, after });
      }
      checked.trendBlockingKeys = TREND_BLOCKING_KEYS;
      checked.trendNonBlockingKeys = TREND_NON_BLOCKING_KEYS;
      checked.trendNonBlocking = Object.fromEntries(TREND_NON_BLOCKING_KEYS.map((key) => [key, { prev: num(prev[key]), last: num(last[key]) }]));
      if (risen.length) {
        checked.trend = "up";
        checked.trendRisenKeys = risen.map((item) => item.key);
        reasons.push(`问题类计数上升（${HEALTH_REL} 最新一条相对上一条）：${risen.map((item) => `${item.key} 由 ${item.before} 升至 ${item.after}`).join("；")}`);
      } else {
        checked.trend = "ok";
        checked.trendRisenKeys = [];
      }
    }
  }

  return { checked, reasons, warnings };
}

const { checked, reasons, warnings } = check();
const verdict = reasons.length ? "blocked" : "ok";
// JSON 内的 limitBytes 与 emit 的收缩上限同源，避免消费端与脚本各持一套口径

// typed gate 要求单文档且不超上限；按 UTF-8 字节计量，避免消费端按字符或按字节解释时出现歧义。
// 截断说明不进循环：那会使 warnings 只增不减，收缩永不收敛。
function emit(payload, limitBytes) {
  const countNote = (total, shown) => `明细已截断：共 ${total} 项，已列 ${shown} 项`;
  const pack = (kept) =>
    JSON.stringify({
      verdict: payload.verdict,
      limitBytes,
      reasons: payload.reasons.slice(0, kept),
      warnings: kept < payload.reasons.length ? [`明细超 ${limitBytes} 字节上限，已截断`, countNote(payload.reasons.length, kept)] : payload.warnings,
      checked: payload.checked,
    });
  return capText({ total: payload.reasons.length, limit: limitBytes, build: pack });
}

process.stdout.write(emit({ verdict, reasons, warnings, checked }, DEFAULT_LIMIT_BYTES));
process.exit(verdict === "blocked" ? 1 : 0);
