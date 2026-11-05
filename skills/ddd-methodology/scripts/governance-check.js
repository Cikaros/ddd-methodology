#!/usr/bin/env node
/**
 * 目标：把接口冻结与结构趋势的门禁判定收敛为单个 JSON 文档，作为 G4、G4.5、G5、G5-INT 与 G6 的 typed gate 证据源。
 * 范围：四项机械可判定事项——存在设计文档树时其根路径已在 ARCHITECTURE.md 声明（未声明即阻断，不得回退 docs/design 而放行）；
 *   docs/health.json 最新一条相对上一条问题类计数未增加（问题类计数的键集合以本脚本内的 TREND_BLOCKING_KEYS 常量为唯一权威，规范只作抽象描述并指向本脚本）；
 *   已记录冻结锚点的 DESIGN 其「变更记录」节是否有数据行（无则仅告警不阻断）；每份 DESIGN 的接口节相对冻结锚点的 diff 与
 *   「变更记录」最新一轮声明的变更类型相符（diff 非空即行为变更，须声明行为变更或重建并同步 AC；声明重构却 diff 非空、或 diff 非空却未声明即阻断，即受影响 AC 未同步）。
 * 不包含：行为等价性、用例集合增减方向、编译产物是否等价等需语义判断的事项，交由 ddd-tester 与 ddd-auditor；AC 文本是否真同步属语义判定，机械侧以变更类型声明为代理。
 * 接口节定位与 diff 的口径唯一在 ./lib/freeze.js，本脚本只消费其结论，不另写一份比对逻辑。
 * 用法：node governance-check.js <项目根>；加 --freeze 时把当前 commit 记为冻结锚点写入设计树根下的冻结清单，供接口冻结节点使用，默认只读不落盘。
 * 输出形态：只读时输出单个 JSON 文档，且仅此一个；字段 limitBytes 给出输出上限，供消费端自证口径。
 * 末行机读结论：`verdict` 字段，取值 ok 或 blocked
 * 退出码：0 通过，1 阻断。门禁地位：G5-INT 门槛证据，退出码非零即 blocked
 * 输出上限：12000 字节，按 UTF-8 字节计量；超限截断 reasons，并在 warnings 给出总数与已列数
 * 非目标项目：无设计文档树时零考察，输出 `applicable:false` 与 `notApplicable` 说明，verdict 为 ok，确保对本方法论仓库自身等场景零误伤；未声明根路径的阻断仅在
 *   设计文档树实际存在时生效，无树的项目不受影响。
 * 依赖：文本读取取 ./lib/text.js 的 readFileText，本脚本不再内联读取实现；冻结锚点与接口节 diff 取 ./lib/freeze.js。
 * 规范依据：规范「质量门禁」节的 G5-INT 证据源行、「结构与注释的机械证据」节的脚本消费契约表，
 *   与「结构与契约的演进治理」节的冻结锚点条。
 */

const fs = require("fs");
const path = require("path");
// 读取失败回空串而非中断：DESIGN 读不到时仍走接口冻结校验并给出结构化结论，消费端不以栈信息判读
const { readFileText, num } = require("./lib/text.js");
const { DEFAULT_LIMIT_BYTES, capText } = require("./lib/truncate.js");
const { HEALTH_REL, artifactReadPath } = require("./lib/paths.js");
const { interfaceFreezeFindings, headCommit, writeFreeze } = require("./lib/freeze");
const { absoluteDesignDir } = require("./design-root");
const { walk, DOC_TREE_SKIP_DIR_NAMES } = require("./lib/walk");

const argv = process.argv.slice(2);
const root = path.resolve(argv.find((a) => !a.startsWith("--")) || process.cwd());

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

// 设计树根的仓库相对路径：冻结清单随根存放，路径按 posix 归一，避免平台分隔符渗入清单 scope
function designRootRel(designRoot) {
  return path.relative(root, designRoot.dir).split(path.sep).join("/");
}

// 「变更记录」节是否存在至少一条数据行（表头与分隔行不计）
function hasChangeRecordRow(text) {
  const m = text.match(/(?:^|\n)##\s*(?:[一二三四五六七八九十\d]+[、.．]?\s*)?变更记录[^\n]*\n?([\s\S]*?)(?=\n## |$)/);
  if (!m) return false;
  const rows = m[1].split("\n").filter((l) => /^\s*\|/.test(l));
  const nonSep = rows.filter((l) => !/^\s*\|[\s:|-]+\|?\s*$/.test(l));
  return nonSep.length > 1; // 去掉表头后仍有数据行
}

function check() {
  const reasons = [];
  const warnings = [];
  const checked = { designs: 0, interfaceFreeze: { anchors: 0, unchanged: 0, changed: 0, undetermined: 0 }, thresholdFiles: 0, thresholdBaseFiles: 0, trend: "none" };

  const designRoot = absoluteDesignDir(root);
  const hasDesignDir = fs.existsSync(designRoot.dir);
  // 无设计文档树时接口冻结与变更判定无判定对象，报不适用而非零对象判过：applicable 明示这一点，verdict 仍为 ok、退出码零
  const applicable = hasDesignDir;
  const notApplicable = hasDesignDir ? null : "无设计文档树，接口冻结与变更判定无判定对象";
  // 存在设计文档树却未声明根路径即阻断：回退 docs/design 会绕过「根路径须在 ARCHITECTURE 声明」的要求，机械门不得据此放行。
  if (hasDesignDir && !designRoot.declared) reasons.push("ARCHITECTURE.md 未声明设计文档树根路径，存在设计文档树却无法确认其权威根路径");
  // 无设计文档树时不判定：非 DDD 项目零考察，避免误伤。
  if (hasDesignDir) {
    // 设计树是待校验对象，须用不排除 docs/build 等命名的口径，否则 docs/design 下名为 build/dist 的子目录会被漏检
    const designFiles = walk(designRoot.dir, DOC_TREE_SKIP_DIR_NAMES).filter((f) => /DESIGN.*\.md$/i.test(path.basename(f)));
    checked.designs = designFiles.length;
    for (const f of designFiles) {
      const rel = path.relative(root, f).split(path.sep).join("/");
      if (!hasChangeRecordRow(readFileText(f))) warnings.push(`${rel} 变更记录节无数据行，建议补记变更类型与依据`);
    }
    const freeze = interfaceFreezeFindings({ root, designRootRel: designRootRel(designRoot), designFiles, relPath: (f) => path.relative(root, f) });
    checked.interfaceFreeze = freeze.checked;
    reasons.push(...freeze.problems);
    warnings.push(...freeze.warnings);
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

  return { checked, reasons, warnings, applicable, notApplicable };
}

// 接口冻结写入：把当前 commit 记为锚点，scope 取设计树根的仓库相对路径，使清单随根迁移
if (argv.includes("--freeze")) {
  const designDir = designRootRel(absoluteDesignDir(root));
  const anchor = headCommit(root);
  if (!anchor) {
    process.stdout.write("冻结失败：本仓库不是 git 仓库或尚无 HEAD 提交，无法记锚点\n");
    process.exit(1);
  }
  const rel = writeFreeze(root, designDir, { anchor, at: new Date().toISOString(), scope: designDir });
  process.stdout.write(`冻结清单已写入 ${rel}：anchor=${anchor}\n`);
  process.exit(0);
}

const { checked, reasons, warnings, applicable, notApplicable } = check();
const verdict = reasons.length ? "blocked" : "ok";
// JSON 内的 limitBytes 与 emit 的收缩上限同源，避免消费端与脚本各持一套口径

// typed gate 要求单文档且不超上限；按 UTF-8 字节计量，避免消费端按字符或按字节解释时出现歧义。
// 截断说明不进循环：那会使 warnings 只增不减，收缩永不收敛。
function emit(payload, limitBytes) {
  const countNote = (total, shown) => `明细已截断：共 ${total} 项，已列 ${shown} 项`;
  const pack = (kept) =>
    JSON.stringify({
      verdict: payload.verdict,
      applicable: payload.applicable,
      ...(payload.notApplicable ? { notApplicable: payload.notApplicable } : {}),
      limitBytes,
      reasons: payload.reasons.slice(0, kept),
      warnings: kept < payload.reasons.length ? [`明细超 ${limitBytes} 字节上限，已截断`, countNote(payload.reasons.length, kept)] : payload.warnings,
      checked: payload.checked,
    });
  return capText({ total: payload.reasons.length, limit: limitBytes, build: pack });
}

process.stdout.write(emit({ verdict, reasons, warnings, checked, applicable, notApplicable }, DEFAULT_LIMIT_BYTES));
process.exit(verdict === "blocked" ? 1 : 0);
