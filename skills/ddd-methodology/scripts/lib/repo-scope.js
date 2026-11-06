/**
 * 目标：把「本仓库是否为方法论自身」与「目标项目是否已进入设计阶段」两类不适用判定收敛为共享层唯一实现，
 *   使 trace-check、span-check 与五个交叉检查脚本共用同一判据与同一套不适用表述，避免各处各写一份而随措辞或判据漂移。
 * 范围：方法论仓库标记的存在性判定；设计阶段判定的一条——设计树根（ARCHITECTURE.md 声明优先，缺省 docs/design）是否存在；
 *   不适用结论的公共表述片段——结论尾行与原因前缀。
 * 不包含：各脚本自身的判定对象与门号，无判定对象的描述由调用方按自身语义给出；设计树内的产物完备性判定——
 *   有设计树而缺产物（无 DESIGN 文档、无 AC.md、契约表列头不全、义务编号重复）仍由各脚本报缺口，不在本模块放宽。
 * 依据：规范「本仓库适用边界」节与 DESIGN-governance.md 第七节——无设计文档树、无看板或本仓库自身时报不适用而非缺口，
 *   退出码零，不零对象报通过。
 */

const fs = require("fs");
const path = require("path");
const { absoluteDesignDir } = require("../design-root.js");

// 方法论仓库自身的判据取文件存在性而非根路径字面量：根含该标记且无 REQUIREMENTS.md 者即方法论仓库自身
const METHODOLOGY_MARKER = ["skills", "ddd-methodology", "SKILL.md"];
const METHODOLOGY_MARKER_DESC = "根含 skills/ddd-methodology/SKILL.md 且无 REQUIREMENTS.md";
// 不适用结论的公共尾行：各脚本逐字一致，便于使用者辨认同一语义
const NOT_APPLICABLE_TAIL = ["", "结果：不适用（不产生缺口）", "RESULT: pass"];

// 进入设计阶段的判定对象：缺省设计树根取自规范「本仓库适用边界」节
const DESIGN_TREE_DEFAULT = "docs/design";
const SCOPE_NOTE = "按规范「本仓库适用边界」节报不适用";

function isMethodologyRepo(root) {
  return fs.existsSync(path.join(root, ...METHODOLOGY_MARKER)) && !fs.existsSync(path.join(root, "REQUIREMENTS.md"));
}

// 方法论仓库自身的不适用行：无判定对象的描述由调用方按自身语义给出，其余措辞统一
function methodologyReason(noTargetDesc) {
  return `[不适用] 本仓库为方法论自身：${METHODOLOGY_MARKER_DESC}，${noTargetDesc}，${SCOPE_NOTE}`;
}

// 设计阶段判据只有一条：设计树根与缺省路径皆不存在即无判定对象。
// 只判设计树根是否存在，不进设计树内产物完备性，故有设计树而缺产物时仍由调用方报缺口
function designStageReason(root, noTargetDesc) {
  const design = absoluteDesignDir(root);
  if (!fs.existsSync(design.dir) && !fs.existsSync(path.join(root, DESIGN_TREE_DEFAULT))) {
    return `[不适用] 目标项目尚未进入设计阶段：ARCHITECTURE.md 声明的设计树根与缺省 ${DESIGN_TREE_DEFAULT} 均不存在，${noTargetDesc}，${SCOPE_NOTE}`;
  }
  return null;
}

// 不适用判定的唯一入口：方法论仓库自身或目标项目尚未进入设计阶段时回不适用原因，否则回 null 表示须进入逐项判定
function notApplicableReason(root, noTargetDesc) {
  return isMethodologyRepo(root) ? methodologyReason(noTargetDesc) : designStageReason(root, noTargetDesc);
}

module.exports = { NOT_APPLICABLE_TAIL, isMethodologyRepo, methodologyReason, notApplicableReason };
