#!/usr/bin/env node
/**
 * 矩阵与技能清单一致性校验（独立入口）。
 *
 * 目标：把注入矩阵与技能清单的一致外化为可单独复核的机械证据，作为 DESIGN-extensions.md 第七节一致性条款的承载脚本。
 * 范围：三项断言——矩阵约束列与工具列引用的技能名存在于 skills/ 下；语言列取值属两个取值语义且语言技能集被语义覆盖；
 *   未被任何节点以任何方式引用的技能报缺陷。断言实现落在 ./lib/matrix.js，本入口只作装配与输出。
 * 不包含：矩阵注入执行、技能正文语义。不引入第三方依赖。
 * 用法：node matrix-check.js <仓库根>；缺省取当前工作目录。
 * 输出形态：文本正文；末行机读结论 `RESULT: pass`（无缺陷）或 `RESULT: gap`（存在缺陷）。
 * 退出码：0 通过或不适用，1 存在缺陷。
 * 依据：DESIGN-extensions.md 第七节；DESIGN-structure.md 第四、七节。
 */

const fs = require("fs");
const path = require("path");
const { capLines } = require("./lib/truncate.js");
const { checkMatrix, MATRIX_REL } = require("./lib/matrix.js");
const { NOT_APPLICABLE_TAIL } = require("./lib/repo-scope.js");

const root = path.resolve(process.argv[2] || process.cwd());
const head = ["=== 矩阵与技能清单一致性校验 ===", `仓库根：${root}`];

// 不适用：矩阵不存在（非本方法论仓库）时报不适用而非缺口，退出码零
if (!fs.existsSync(path.join(root, ...MATRIX_REL.split("/")))) {
  const lines = head.concat([`[不适用] 注入矩阵不存在：${MATRIX_REL}，一致性校验无判定对象`, ...NOT_APPLICABLE_TAIL]);
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(0);
}

const findings = checkMatrix(root);
const details = findings.map((d) => `  ✗ [${d.item}] ${d.file} :: ${d.criterion}；期望 ${d.expect}${d.found ? `；实际 ${d.found}` : ""}`);
const tail = findings.length ? ["", `结果：存在 ${findings.length} 项缺陷`, "RESULT: gap"] : ["", "结果：通过，矩阵与技能清单一致", "RESULT: pass"];

const build = (keep) => {
  const out = head.concat(details.slice(0, keep));
  if (keep < details.length) out.push(`明细已截断：共 ${details.length} 项，已列 ${keep} 项`);
  return out.concat(tail);
};
process.stdout.write(capLines({ total: details.length, build }).join("\n") + "\n");
process.exit(findings.length ? 1 : 0);
