/**
 * 目标：把度量与证据产物的落盘路径、变更记录排除名收敛为共享层单一常量，消除同一路径在多脚本并列书写导致的静默漂移。
 * 范围：产物相对路径四项——健康度量、绩效度量、债务登记簿、债务历史快照，以及变更记录文件名一项；
 *   路径一律以仓库根为基准的相对路径，落盘与读取时由 resolveRel 解析为绝对路径。
 * 不包含：目录遍历、文本读取、校验语义、命令行入口。不引入第三方依赖。
 * 单源语义：上列常量在本模块定义一次，消费脚本只按名引用，实现内不再复写字面量。
 */

const path = require("path");

const HEALTH_REL = "docs/health.json";
const METRICS_REL = "docs/metrics.json";
const DEBT_BOOK_REL = "docs/debts.json";
const DEBT_HISTORY_REL = "docs/debt-history.json";
// 变更记录文件名：结构健康与跨文档引用的活文档扫描均按此名排除，避免其历史条目被当作当前文档校验
const CHANGELOG_NAME = "CHANGELOG.md";

// 相对路径到绝对路径：逐段拼接，避免把正斜杠相对路径交给平台相关的 path 解析
const resolveRel = (root, rel) => path.join(root, ...rel.split("/"));

module.exports = { HEALTH_REL, METRICS_REL, DEBT_BOOK_REL, DEBT_HISTORY_REL, CHANGELOG_NAME, resolveRel };
