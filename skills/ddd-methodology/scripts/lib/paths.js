/**
 * 目标：把度量与证据产物的落盘路径、变更记录排除名收敛为共享层单一常量，消除同一路径在多脚本并列书写导致的静默漂移。
 * 范围：产物相对路径四项——健康度量、绩效度量、债务登记簿、债务历史快照，以及变更记录文件名一项；
 *   另有产物落点解析——读取按「公开区优先、内部区回退」的回退链，写入在内部区目录存在时落内部区、否则落公开区，
 *   使本仓库自身（产物在 docs/internal/）与被开发项目（产物在 docs/）共用同一实现。
 * 不包含：目录遍历、文本读取、校验语义、命令行入口。不引入第三方依赖。
 * 单源语义：上列常量与落点解析在本模块定义一次，消费脚本只按名引用，实现内不再复写字面量。
 */

const fs = require("fs");
const path = require("path");

const HEALTH_REL = "docs/health.json";
const METRICS_REL = "docs/metrics.json";
const DEBT_BOOK_REL = "docs/debts.json";
const DEBT_HISTORY_REL = "docs/debt-history.json";
// 变更记录文件名：结构健康与跨文档引用的活文档扫描均按此名排除，避免其历史条目被当作当前文档校验
const CHANGELOG_NAME = "CHANGELOG.md";

// 相对路径到绝对路径：逐段拼接，避免把正斜杠相对路径交给平台相关的 path 解析
const resolveRel = (root, rel) => path.join(root, ...rel.split("/"));

// 同一产物的公开区与内部区两处候选：internal 段插在末段名前，公开区在前，读取回退链据此以公开区优先
function artifactCandidates(rel) {
  const parts = rel.split("/");
  const base = parts.pop();
  return [rel, [...parts, "internal", base].join("/")];
}

// 读取回退链的命中项：公开区在前、内部区在后，两处皆无回 null，调用方据此报「不适用」而非缺口
function artifactReadRel(root, rel) {
  for (const candidate of artifactCandidates(rel)) if (fs.existsSync(resolveRel(root, candidate))) return candidate;
  return null;
}

// 写入落点：内部区目录存在即写其中，否则写公开区；判据是目录存在性而非根路径字面量，使本仓库与被开发项目各得其所
function artifactWriteRel(root, rel) {
  const internal = artifactCandidates(rel)[1];
  const internalDir = resolveRel(root, internal.split("/").slice(0, -1).join("/"));
  return fs.existsSync(internalDir) && fs.statSync(internalDir).isDirectory() ? internal : rel;
}

const artifactReadPath = (root, rel) => {
  const found = artifactReadRel(root, rel);
  return found ? resolveRel(root, found) : null;
};
const artifactWritePath = (root, rel) => resolveRel(root, artifactWriteRel(root, rel));

module.exports = { HEALTH_REL, METRICS_REL, DEBT_BOOK_REL, DEBT_HISTORY_REL, CHANGELOG_NAME, artifactCandidates, artifactReadPath, artifactWritePath, artifactWriteRel };
