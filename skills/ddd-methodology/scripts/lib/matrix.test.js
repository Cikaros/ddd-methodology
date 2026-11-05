/**
 * 目标：为注入矩阵与技能清单的一致性校验（lib/matrix.js）补纯函数单元测试，覆盖正常、边界与异常路径。
 * 范围：checkMatrix 在一致矩阵、仅常驻与语言技能被引用、以及引用不存在的技能与未被引用技能三种输入下的回传。
 * 运行：node --test skills/ddd-methodology/scripts/lib/matrix.test.js。
 * 不包含：命令行入口装配（见 matrix-check.js）、文件枚举之外的语义判断。
 */

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { checkMatrix } = require("./matrix.js");

// 建临时仓库夹具：写 skills/<名>/SKILL.md 与 assets/injection-matrix.json，回传根路径
function makeRepo(skills, matrix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "matrix-"));
  for (const name of skills) {
    fs.mkdirSync(path.join(root, "skills", name), { recursive: true });
    fs.writeFileSync(path.join(root, "skills", name, "SKILL.md"), `# ${name}\n`);
  }
  fs.mkdirSync(path.join(root, "skills", "ddd-methodology", "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, "skills", "ddd-methodology", "assets", "injection-matrix.json"), JSON.stringify(matrix));
  return root;
}

test("一致矩阵：约束、工具与语言维均合法即无缺陷", () => {
  const root = makeRepo(
    ["ddd-methodology", "governance-code", "lang-python"],
    { requirements: { constraint: ["governance-code"], language: [], tool: [] }, implement: { constraint: [], language: ["任务涉及语言"], tool: ["tool-bash"] } },
  );
  // tool-bash 未建技能（边界：工具维引用不存在的技能应报缺陷，故此处预置一份使其合法）
  fs.mkdirSync(path.join(root, "skills", "tool-bash"), { recursive: true });
  fs.writeFileSync(path.join(root, "skills", "tool-bash", "SKILL.md"), "# tool-bash\n");
  assert.deepStrictEqual(checkMatrix(root), []);
});

test("边界：仅常驻主技能与语言技能被引用，不被误报未引用", () => {
  const root = makeRepo(
    ["ddd-methodology", "lang-java"],
    { detail: { constraint: [], language: ["项目语言栈"], tool: [] } },
  );
  assert.deepStrictEqual(checkMatrix(root), []);
});

test("异常：引用不存在的技能、语言维取值非法与未被引用的技能均报缺陷", () => {
  const root = makeRepo(
    ["ddd-methodology", "governance-code", "orphan-skill"],
    { requirements: { constraint: ["ghost"], language: ["lang-python"], tool: [] } },
  );
  const found = checkMatrix(root);
  const items = found.map((d) => d.found);
  assert.ok(items.includes("ghost"), "应报引用不存在的技能");
  assert.ok(items.includes("lang-python"), "应报语言维取值非法");
  assert.ok(items.includes("未引用"), "应报未被引用的技能");
  assert.ok(found.every((d) => d.item === "C25"));
});
