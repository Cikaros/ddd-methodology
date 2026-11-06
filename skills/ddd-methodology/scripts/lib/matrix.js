/**
 * 目标：把注入矩阵与技能清单的一致性外化为可复现的机械校验，使矩阵引用的技能名、语言维取值与技能集合三处一致，
 *   并报出未被任何节点以任何方式引用的技能，承载 DESIGN-extensions.md 第七节的一致性条款。
 * 范围：三项断言——其一，矩阵约束列与工具列出现的技能名须存在于 skills/ 下；
 *   其二，语言列按两取值语义（「项目语言栈」与「任务涉及语言」）解析后比对，取值须属该两语义，不落具体技能名，且语言技能集被语义覆盖；
 *   其三，未被任何节点以任何方式引用（约束、工具、语言或常驻主技能）的技能报缺陷。
 * 不包含：矩阵的注入执行（见 extensions/ddd-resources.ts）、技能正文语义。不引入第三方依赖。
 * 单一来源：技能集合以 skills/<名>/SKILL.md 的真实枚举为准，矩阵以 assets/injection-matrix.json 为准，本模块不另立副本。
 * 调用方：skills/ddd-methodology/scripts/matrix-check.js（独立入口）与 skills/ddd-methodology/scripts/ref-check.js 的 C25 校验项。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./text.js");

const MATRIX_REL = "skills/ddd-methodology/assets/injection-matrix.json";
// 语言维的两个取值语义：语言列只写这两者，具体语言技能由运行期解析，不逐名列于矩阵
const LANGUAGE_TOKENS = new Set(["项目语言栈", "任务涉及语言"]);
// 常驻技能：主技能全节点常驻，纵不出现在任何一列也不属未引用
const RESIDENT_SKILL = "ddd-methodology";

// 技能集合枚举：skills/<名>/SKILL.md 的实际目录集合
function enumerateSkills(root) {
  try {
    return fs.readdirSync(path.join(root, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, "skills", entry.name, "SKILL.md")))
      .map((entry) => entry.name);
  } catch (e) { return []; }
}

// 矩阵一致性校验：回传 ref-check 形态的漂移项数组；矩阵或技能集缺失时回单个结构性漂移
function checkMatrix(root) {
  const found = [];
  const text = readFileText(path.join(root, ...MATRIX_REL.split("/")));
  if (!text) return [drift("C25", MATRIX_REL, 0, "注入矩阵须存在且可读", `${MATRIX_REL} 可读`, "未找到")];
  let matrix;
  try { matrix = JSON.parse(text); } catch (e) { return [drift("C25", MATRIX_REL, 0, "注入矩阵须为合法 JSON", "合法 JSON", e.message)]; }
  const skills = enumerateSkills(root);
  if (!skills.length) return [drift("C25", "skills/", 0, "技能目录须含 SKILL.md", "至少一个技能目录", "零个")];
  const skillSet = new Set(skills);
  const langSkills = skills.filter((name) => name.startsWith("lang-"));
  const referenced = new Set([RESIDENT_SKILL]);
  let languageUsed = false;

  for (const [node, cols] of Object.entries(matrix)) {
    for (const dim of ["constraint", "tool"]) {
      const values = Array.isArray(cols[dim]) ? cols[dim] : [];
      for (const name of values) {
        referenced.add(name);
        if (!skillSet.has(name)) found.push(drift("C25", MATRIX_REL, 0, `节点 ${node} 的${dim === "tool" ? "工具" : "约束"}维引用的技能须存在于 skills/ 下`, `技能 ${name} 存在于 skills/`, name));
      }
    }
    for (const value of Array.isArray(cols.language) ? cols.language : []) {
      if (!LANGUAGE_TOKENS.has(value)) found.push(drift("C25", MATRIX_REL, 0, `节点 ${node} 的语言维取值须属两个取值语义`, "项目语言栈 或 任务涉及语言", value));
      languageUsed = true;
    }
  }
  // 语言技能集由两个语义在运行期解析，故任取到语言维即覆盖全部 lang- 技能
  if (languageUsed) for (const name of langSkills) referenced.add(name);

  for (const name of skills) {
    if (referenced.has(name)) continue;
    found.push(drift("C25", "skills/", 0, "未被任何节点以任何方式引用的技能须报缺陷", `${name} 被某节点引用`, "未引用"));
  }
  return found;
}

module.exports = { checkMatrix, MATRIX_REL };
