#!/usr/bin/env node
/**
 * 目标：把「覆盖率是否达阈」外化为可复现的机械证据——读 Cobertura 兼容 XML，判定行覆盖率是否达阈，并对报告缺失、报告不可解析、覆盖率未达阈三态各给出结论，均不静默通过。
 * 范围：命令行入口——解析项目根、报告路径与阈值参数，调用 lib/coverage-parse.js 的纯函数判定，输出人读摘要与末行机读结论。
 * 不包含：覆盖率报告的产出（由各语言工具与配置基线承担）、门槛挂载（见主技能机械门禁节与 DESIGN-test-baseline.md 第五节）、语言工具识别与配置读取。
 * 用法：node coverage-check.js <项目根绝对路径> [--report <报告路径>] [--threshold <百分比>]；默认报告 <项目根>/coverage/cobertura.xml，默认阈值 80。
 * 输出形态：文本正文；末行机读结论 `RESULT: pass`（达标）或 `RESULT: gap`（缺失、不可解析或未达阈三态之一）。
 * 退出码：0 达标，1 三态之一，2 入参非法。只认 Cobertura 兼容 XML 一种入参形态，不依赖具体语言工具。
 */

const fs = require("node:fs");
const path = require("node:path");
const { evaluateCoverage, DEFAULT_THRESHOLD } = require("./lib/coverage-parse.js");

// 状态到人读标签：三态非达标态各有独立标签，使缺失、不可解析与未达阈在输出上可区分
const STATE_LABELS = {
  ok: "达标",
  below: "未达阈",
  missing: "报告缺失",
  unparsable: "报告不可解析",
};

// 入参解析：首个非选项为项目根，--report 给报告路径，--threshold 给百分比；未知选项与非法阈值回错误
function parseArgs(argv) {
  const options = { root: null, report: null, threshold: DEFAULT_THRESHOLD };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--report") { options.report = argv[++i] || null; continue; }
    if (arg === "--threshold") {
      const raw = argv[++i];
      const value = Number(raw);
      if (raw === undefined || !Number.isFinite(value)) return { error: `阈值须为数字：${raw === undefined ? "缺失" : raw}` };
      options.threshold = value;
      continue;
    }
    if (arg.startsWith("--")) return { error: `未知参数：${arg}` };
    if (!options.root) options.root = arg;
  }
  return options;
}

// 百分比格式化：截到两位小数，避免长尾小数淹没结论
function formatPercent(value) {
  return `${Math.round(value * 100) / 100}%`;
}

// 入口：判定并输出，返回进程退出码；报告缺失、不可解析与未达阈三者一律非零，不静默通过
function main(argv) {
  const options = parseArgs(argv);
  if (options.error) { process.stderr.write(`${options.error}\n`); return 2; }
  const { root } = options;
  if (!root) { process.stderr.write("用法：node coverage-check.js <项目根绝对路径> [--report <报告路径>] [--threshold <百分比>]\n"); return 2; }
  if (!path.isAbsolute(root)) { process.stderr.write(`项目根须为绝对路径：${root}\n`); return 2; }
  const reportPath = options.report ? path.resolve(root, options.report) : path.join(root, "coverage", "cobertura.xml");
  const exists = fs.existsSync(reportPath);
  let text = "";
  if (exists) { try { text = fs.readFileSync(reportPath, "utf8"); } catch (e) { text = ""; } }
  const result = evaluateCoverage({ exists, text, threshold: options.threshold });
  const lines = ["=== 覆盖率判定 ===", `报告：${reportPath}`, `阈值：${formatPercent(options.threshold)}`, `状态：${STATE_LABELS[result.state]}`];
  if (result.state === "ok" || result.state === "below") {
    const detail = result.covered === null ? "" : `（覆盖 ${result.covered}/${result.valid} 行）`;
    lines.push(`行覆盖率：${formatPercent(result.rate)}${detail}`);
  } else {
    lines.push(`原因：${result.reason}`);
  }
  lines.push(result.state === "ok" ? "RESULT: pass" : "RESULT: gap");
  process.stdout.write(`${lines.join("\n")}\n`);
  return result.state === "ok" ? 0 : 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
