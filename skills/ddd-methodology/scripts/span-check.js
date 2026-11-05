#!/usr/bin/env node
/**
 * 目标：把 DESIGN 契约表的签名列与代码侧导出符号的一致性外化为可复现的机械证据，清偿签名级符合性的机械校验盲区。
 * 范围：逐份 DESIGN 的「对外接口与约定」契约表，逐行推导语言、提取代码侧签名、三态比对。
 * 三态语义：一致、不一致、无法判定；仅前两态进机械门槛，不一致计入缺口并置退出码 1，无法判定只入报告不影响退出码。
 * 不适用语义：本仓库为方法论自身、或确无设计文档或契约行时报「不适用」并说明缺什么，退出码 0，绝不零对象报通过；判定与口径见 lib/repo-scope.js，与 trace-check 同一实现。
 * 排除列：契约表的「错误语义」与「时序依赖与副作用」两列不参与比对——语法层只能部分推断 `throws`、`Result<T,E>`、`(T, error)`，
 *   不等价，不排除则判据本身不可满足。
 * 解析器：按需从 `~/.pi/agent/ddd-parser/` 供给（见 lib/span-parser.js），缺失时报「无法判定：解析器未安装」并给出安装指引，不静默通过。
 * 用法：node span-check.js <项目根>
 * 输出形态：文本正文；末行机读结论 `RESULT: pass`（无不一致）或 `RESULT: drift`（存在不一致）。
 * 退出码：0 无不一致或不适用，1 存在不一致。输出上限：12000 字节，按 UTF-8 计量；超限截断明细，末行结论保留。
 */

const path = require("path");
const { readFileText } = require("./lib/text.js");
const { capLines } = require("./lib/truncate.js");
const { walk, DOC_TREE_SKIP_DIR_NAMES } = require("./lib/walk.js");
const { absoluteDesignDir } = require("./design-root.js");
const { installGuidance } = require("./lib/span-parser.js");
const { readContractTable, compareRow } = require("./lib/span-compare.js");
const { isMethodologyRepo, methodologyReason, NOT_APPLICABLE_TAIL } = require("./lib/repo-scope.js");

const root = path.resolve(process.argv[2] || process.cwd());

// 不适用出口：对象不存在与对象不合格是两件事，零对象不得报通过；尾部与 trace-check 逐字一致
function emitNotApplicable(detail) {
  const lines = ["=== 签名级符合性校验 ===", `仓库根：${root}`, detail, ...NOT_APPLICABLE_TAIL];
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(0);
}

async function main() {
  // 情形一：方法论仓库自身，判据与 trace-check 共用同一实现
  if (isMethodologyRepo(root)) return emitNotApplicable(methodologyReason("签名级符合性无判定对象"));

  // 设计文档清单：设计树根路径解析复用 design-root 的唯一实现；设计树是待校验对象，故用不排除 docs/build 命名的遍历口径
  const designRoot = absoluteDesignDir(root);
  const designFiles = walk(designRoot.dir, DOC_TREE_SKIP_DIR_NAMES).filter((file) => /DESIGN.*\.md$/i.test(path.basename(file)));
  // 情形二：非方法论仓库但确实无设计文档
  if (!designFiles.length) return emitNotApplicable(`[不适用] 未发现设计文档：设计树 ${designRoot.dir} 下无 DESIGN 文档，签名级符合性无判定对象`);

  // 契约行收集：逐份 DESIGN 读「对外接口与约定」表，缺表者不产生行
  const rows = [];
  for (const file of designFiles) {
    const table = readContractTable(readFileText(file));
    if (!table) continue;
    const rel = path.relative(root, file).split(path.sep).join("/");
    for (const row of table) rows.push({ rel, ...row });
  }
  // 情形三：有设计文档但确实无契约行
  if (!rows.length) return emitNotApplicable(`[不适用] 未发现契约行：${designFiles.length} 份设计文档的「对外接口与约定」节均无契约表，签名级符合性无判定对象`);

  const results = [];
  for (const row of rows) results.push({ row, ...(await compareRow(root, row)) });

  const consistent = results.filter((item) => item.state === "一致");
  const inconsistent = results.filter((item) => item.state === "不一致");
  const undecided = results.filter((item) => item.state === "无法判定");
  const parserMissing = undecided.some((item) => /解析器未安装/.test(item.reason || ""));

  // 输出组装：明细可截断，头部固定行、末行结论与截断计数行保留
  const entries = [];
  const fixed = (line) => entries.push({ droppable: false, text: line });
  const detail = (line) => entries.push({ droppable: true, text: line });

  fixed("=== 签名级符合性校验 ===");
  fixed(`仓库根：${root}`);
  fixed(`设计文档：${designFiles.length} 份；契约行：${rows.length} 行`);
  for (const item of consistent) detail(`  [一致] ${item.row.rel} :: ${item.row.interfaceName || "（无接口名）"} ${item.detail || ""}`.trimEnd());
  for (const item of inconsistent) detail(`  [不一致] ${item.row.rel} :: ${item.row.interfaceName || "（无接口名）"} —— ${item.reason}`);
  for (const item of undecided) detail(`  [无法判定] ${item.row.rel} :: ${item.row.interfaceName || "（无接口名）"} —— ${item.reason}`);
  if (parserMissing) for (const line of installGuidance().split("\n")) fixed(`  ${line}`);
  fixed("");
  fixed(`结果：一致 ${consistent.length}，不一致 ${inconsistent.length}，无法判定 ${undecided.length}`);
  fixed(inconsistent.length ? "RESULT: drift" : "RESULT: pass");

  // 超限时自尾部回撤明细，末行结论与结果行不受影响
  function render() {
    const droppable = entries.map((entry, index) => (entry.droppable ? index : -1)).filter((index) => index >= 0);
    const build = (keep) => {
      const dropped = new Set(droppable.slice(keep));
      const lines = [];
      let noted = false;
      entries.forEach((entry, index) => {
        if (!dropped.has(index)) { lines.push(entry.text); return; }
        if (!noted) { lines.push(`明细已截断：共 ${droppable.length} 项，已列 ${keep} 项`); noted = true; }
      });
      return lines;
    };
    return capLines({ total: droppable.length, build });
  }

  process.stdout.write(render().join("\n") + "\n");
  process.exit(inconsistent.length ? 1 : 0);
}

main();
