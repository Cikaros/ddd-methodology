#!/usr/bin/env node
/**
 * 目标：把契约指纹与结构趋势的门禁判定收敛为单个 JSON 文档，作为 G4、G4.5、G5、G5-INT 与 G6 的 typed gate 证据源。
 * 范围：三项机械可判定事项——各 DESIGN.md 契约指纹齐备且与契约段实算值一致；docs/health.json 最新一条
 *   相对上一条超阈值文件数未增加；已记录指纹的 DESIGN 其「变更记录」节是否有数据行（无则仅告警不阻断）。
 * 不包含：行为等价性、用例集合增减方向、变更类型声明与产物是否相符等需语义判断的事项，交由 ddd-tester 与 ddd-auditor。
 * 用法：node governance-check.js <项目根>
 * 输出形态：单个 JSON 文档，且仅此一个；字段 limitBytes 给出输出上限，供消费端自证口径。
 * 末行机读结论：`verdict` 字段，取值 ok 或 blocked
 * 退出码：0 通过，1 阻断。门禁地位：G5-INT 门槛证据，退出码非零即 blocked
 * 输出上限：12000 字节，按 UTF-8 字节计量；超限截断 reasons，并在 warnings 给出总数与已列数
 * 非目标项目：无 docs/design 目录时零考察，verdict 为 ok，确保对本方法论仓库自身等场景零误伤。
 * 规范依据：规范「质量门禁」节的 G5-INT 证据源行、「结构与注释的机械证据」节的脚本消费契约表，
 *   与「结构与契约的演进治理」节的指纹门槛条。
 */

const fs = require("fs");
const path = require("path");
const { checkContractFingerprint } = require("./fingerprint");
const { absoluteDesignDir } = require("./design-root");

const root = process.argv[2] || process.cwd();

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

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
  // 无设计树时不告警：非 DDD 项目零考察，避免噪音。
  if (hasDesignDir && !designRoot.declared) warnings.push("ARCHITECTURE.md 未声明设计树根路径，已回退 docs/design");
  if (hasDesignDir) {
    const designFiles = walk(designRoot.dir).filter((f) => /DESIGN.*\.md$/i.test(path.basename(f)));
    checked.designs = designFiles.length;
    for (const f of designFiles) {
      const rel = path.relative(root, f).split(path.sep).join("/");
      const text = read(f);
      const issue = checkContractFingerprint(text);
      if (issue) reasons.push(`${rel} ${issue}`);
      else checked.fingerprints++;
      if (!hasChangeRecordRow(text)) warnings.push(`${rel} 变更记录节无数据行，建议补记变更类型与依据`);
    }
  }

  const healthPath = path.join(root, "docs", "health.json");
  if (fs.existsSync(healthPath)) {
    let history = [];
    try {
      const parsed = JSON.parse(read(healthPath));
      history = Array.isArray(parsed.history) ? parsed.history : [];
    } catch (e) {
      warnings.push("docs/health.json 无法解析，趋势未判");
    }
    if (history.length >= 1) {
      checked.thresholdFiles = num(history[history.length - 1].oversized);
      checked.thresholdBaseFiles = num(history[history.length - 1].oversizedBase);
    }
    if (history.length < 2) {
      checked.trend = "insufficient";
    } else {
      const prev = num(history[history.length - 2].oversized);
      const last = num(history[history.length - 1].oversized);
      const prevBase = num(history[history.length - 2].oversizedBase);
      const lastBase = num(history[history.length - 1].oversizedBase);
      if (last > prev || lastBase > prevBase) {
        checked.trend = "up";
        reasons.push(`超阈值文件数由 ${prev} 升至 ${last}，其中基础能力超 300 行由 ${prevBase} 升至 ${lastBase}（docs/health.json 最新一条相对上一条）`);
      } else {
        checked.trend = "ok";
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
