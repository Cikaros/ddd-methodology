#!/usr/bin/env node
/**
 * 目标：把契约指纹与结构趋势的门禁判定收敛为单个 JSON 文档，作为 G4、G4.5、G5、G5-INT 与 G6 的 typed gate 证据源。
 * 范围：四项机械可判定事项——各 DESIGN.md 契约指纹齐备且与契约段实算值一致；存在设计文档树时其根路径已在
 *   ARCHITECTURE.md 声明（未声明即阻断，不得回退 docs/design 而放行）；docs/health.json 最新一条相对上一条
 *   问题类计数未增加（问题类计数的键集合以本脚本内的 TREND_BLOCKING_KEYS 常量为唯一权威，规范只作抽象描述并指向本脚本）；
 *   已记录指纹的 DESIGN 其「变更记录」节是否有数据行（无则仅告警不阻断）。
 * 不包含：行为等价性、用例集合增减方向、变更类型声明与产物是否相符等需语义判断的事项，交由 ddd-tester 与 ddd-auditor。
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
const { readFileText } = require("./lib/text.js");
const { HEALTH_REL, artifactReadPath } = require("./lib/paths.js");
const { checkContractFingerprint } = require("./fingerprint");
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

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

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
const GOVERNANCE_LIMIT_BYTES = 12000;

// typed gate 要求单文档且不超上限；按 UTF-8 字节计量，避免消费端按字符或按字节解释时出现歧义。
// 截断说明不进循环：那会使 warnings 只增不减，收缩永不收敛。
function emit(payload, limitBytes) {
  const TRUNCATED_NOTE = `明细超 ${limitBytes} 字节上限，已截断`;
  const countNote = (total, shown) => `明细已截断：共 ${total} 项，已列 ${shown} 项`;
  const size = (s) => Buffer.byteLength(s, "utf8");
  const pack = (kept) =>
    JSON.stringify({
      verdict: payload.verdict,
      limitBytes,
      reasons: payload.reasons.slice(0, kept),
      warnings: kept < payload.reasons.length ? [TRUNCATED_NOTE, countNote(payload.reasons.length, kept)] : payload.warnings,
      checked: payload.checked,
    });
  if (size(pack(payload.reasons.length)) <= limitBytes) return pack(payload.reasons.length);
  let lo = 0;
  let hi = payload.reasons.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (size(pack(mid)) <= limitBytes) lo = mid;
    else hi = mid - 1;
  }
  return pack(lo);
}

process.stdout.write(emit({ verdict, reasons, warnings, checked }, GOVERNANCE_LIMIT_BYTES));
process.exit(verdict === "blocked" ? 1 : 0);
