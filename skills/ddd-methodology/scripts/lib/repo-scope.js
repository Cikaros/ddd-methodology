/**
 * 目标：把「本仓库是否为方法论自身」这一判定收敛为共享层唯一实现，使 trace-check 与 span-check 共用同一判据与同一套不适用表述，
 *   避免两处各写一份而随措辞或判据漂移。
 * 范围：方法论仓库标记的存在性判定，以及不适用结论的公共表述片段——结论尾行与原因前缀。
 * 不包含：各脚本自身的判定对象与门号，无判定对象的描述由调用方按自身语义给出。
 * 依据：规范「本仓库适用边界」节——本方法论仓库无应用侧产物，相关门无判定对象，报不适用而非缺口。
 */

const fs = require("fs");
const path = require("path");

// 方法论仓库自身的判据取文件存在性而非根路径字面量：根含该标记且无 REQUIREMENTS.md 者即方法论仓库自身
const METHODOLOGY_MARKER = ["skills", "ddd-methodology", "SKILL.md"];
const METHODOLOGY_MARKER_DESC = "根含 skills/ddd-methodology/SKILL.md 且无 REQUIREMENTS.md";
// 不适用结论的公共尾行：两脚本逐字一致，便于使用者辨认同一语义
const NOT_APPLICABLE_TAIL = ["", "结果：不适用（不产生缺口）", "RESULT: pass"];

function isMethodologyRepo(root) {
  return fs.existsSync(path.join(root, ...METHODOLOGY_MARKER)) && !fs.existsSync(path.join(root, "REQUIREMENTS.md"));
}

// 方法论仓库自身的不适用行：无判定对象的描述由调用方按自身语义给出，其余措辞统一
function methodologyReason(noTargetDesc) {
  return `[不适用] 本仓库为方法论自身：${METHODOLOGY_MARKER_DESC}，${noTargetDesc}，按规范「本仓库适用边界」节报不适用`;
}

module.exports = { NOT_APPLICABLE_TAIL, isMethodologyRepo, methodologyReason };
