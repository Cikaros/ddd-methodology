/**
 * 目标：把仓库清单类校验（代理清单、skill 清单）收敛为可单独复核的库文件，控制单脚本的行数规模。
 * 范围：代理清单校验与 skill 清单校验两项——文件系统枚举、声明文件解析、集合双向比对与漂移项产出。
 * 不包含：文件遍历之外的语义判断（代理定义正文、skill 正文等）、其他校验项、命令行入口。
 * 代理集合：十个固定代理取自 agents/ddd-*.md，两份项目级模板取自 skills/ddd-methodology/assets/agent-templates/ddd-*.md，
 *   两者并集为合法代理名集合；已删除项（ddd-arbiter、ddd-rebuild、ddd-refactor 与更名前的 ddd-test-planner）列入移除集，
 *   出现在任何声明位置即报漂移，使删改不静默留幽灵条目。依据：DESIGN-agents.md 第二、三节与 DESIGN.md 删除项。
 *   声明载体为 skills/ddd-methodology/references/spec-role.md、STRUCTURE.md 与 skills/ddd-methodology/scripts/ddd-workflow.js 的 agent 字段。
 *   原 profiles/models.json 配比面已随模型配比改声明删除（见 DESIGN-decisions.md D07、D38），不再作为受控声明载体。
 * skill 集合：skills/<名>/SKILL.md 的实际目录集合，与 STRUCTURE.md 结构树内 skills/<名>/ 目录项双向比对；
 *   skill 名前缀五分（ddd-、governance-、spec-、lang-、tool-），见 DESIGN-structure.md 第四节命名规则。
 * 代理名排除集：与代理名同形的 skill 目录名由 enumerateSkillDirs 动态取得，与 C11 共用同一枚举，不得硬编码 skill 名。
 * 调用形态：checkAgentRoster(root)、checkSkillRoster(root)；root 为仓库根；两者回传漂移项数组，
 *   字段与 ref-check 现有漂移项一致，含 item、file、line、criterion、expect、found。
 * 调用方：skills/ddd-methodology/scripts/ref-check.js 的 C5 与 C11 校验项。
 * 依赖：文本读取、行号与漂移项构造取 ./lib/text.js 的 readFileText、withLineNumbers、drift，本模块不再内联重复实现。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./lib/text.js");

// 声明代理集合的入口：规范入口、结构与安装内容明细文档与沙箱 workflow；规范角色表与 workflow 无生成通道，只能内联，故列入受控声明面
const WORKFLOW_REL = "skills/ddd-methodology/scripts/ddd-workflow.js";
// 固定代理与项目级模板目录：两处并集为合法代理名集合，二者仅落点不同（前者随包，后者初始化后归项目）
const FIXED_AGENT_DIR = ["agents"];
const TEMPLATE_AGENT_DIR = ["skills", "ddd-methodology", "assets", "agent-templates"];
const AGENT_DECLARATION_FILES = [["skills", "ddd-methodology", "references", "spec-role.md"], ["STRUCTURE.md"], WORKFLOW_REL.split("/")];
// 已删除代理：ddd-arbiter 与 ddd-rebuild、ddd-refactor 已删，ddd-test-planner 已更名为 ddd-test-designer；声明中出现即漂移
const REMOVED_AGENTS = new Set(["ddd-arbiter", "ddd-rebuild", "ddd-refactor", "ddd-test-planner"]);
// skill 清单的声明文件：仓库结构与安装内容明细文档；实际目录集合由 skills/<名>/SKILL.md 枚举
const SKILL_DECLARATION_FILES = [["STRUCTURE.md"]];
// skill 名合法性：只要求为目录名形态，不限定前缀，使已删 skill（如 ddd-rebuild）在声明面残留时能被报出而不得静默
const SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// skill 目录集合的唯一枚举入口：C5 的代理名排除集与 C11 的实际集合共用，避免两处各自遍历 skill 目录
function enumerateSkillDirs(root) {
  try {
    return fs.readdirSync(path.join(root, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, "skills", entry.name, "SKILL.md")))
      .map((entry) => entry.name);
  } catch (e) { return []; }
}

// 目录内 ddd-*.md 的代理名集合：去 .md 后缀，按目录分派；目录缺失回空数组
function agentNamesIn(root, dir) {
  try {
    return fs.readdirSync(path.join(root, ...dir))
      .filter((name) => /^ddd-.*\.md$/.test(name))
      .map((name) => name.replace(/\.md$/, ""));
  } catch (e) { return []; }
}

// 受控声明面收敛后只剩规范文档与沙箱 workflow，注释判定只需覆盖 workflow 的 js 形态
function isCommentLine(rel, line) {
  if (!rel[rel.length - 1].endsWith(".js")) return false;
  return /^(?:\/\/|\/\*|\*)/.test(line.trim());
}

// 声明提取按载体分派：workflow 里与代理名同形的运行标识最多，通用扫描会把它们当声明
function collectDeclaredAgents(root, rel, nonAgentTokens) {
  const file = rel.join("/");
  const declared = new Map();
  const add = (token, no) => { if (!nonAgentTokens.has(token) && !declared.has(token)) declared.set(token, { file, line: no }); };
  const text = readFileText(path.join(root, ...rel));
  for (const row of withLineNumbers(text)) {
    if (isCommentLine(rel, row.line)) continue;
    if (file === WORKFLOW_REL) {
      // 只认 agent 字段的字符串字面量：runStage 的 key、defectAction 的 key、runKey 与状态键都不是代理名
      for (const m of row.line.matchAll(/^\s*agent:\s*"(ddd-[a-z][a-z0-9-]*)"/g)) add(m[1], row.no);
      continue;
    }
    // 树内代理条目形如 ddd-某名.md：裸 token 扫描把句点当作词内字符，故 .md 后缀并入匹配后再剥去，落回代理名
    for (const m of row.line.matchAll(/(?<![\w./-])(ddd-[a-z][a-z0-9-]*)(?:\.md)?(?![\w./-])/g)) add(m[1], row.no);
  }
  return declared;
}

// C5 代理清单一致性：agents/ 与 agent-templates/ 的并集为合法代理名，与各声明载体的声明集合双向一致；
// 已删除项出现在声明中即漂移
function checkAgentRoster(root) {
  const fixed = agentNamesIn(root, FIXED_AGENT_DIR);
  const templates = agentNamesIn(root, TEMPLATE_AGENT_DIR);
  if (!fixed.length) return [drift("C5", "agents/", 0, "代理定义目录须含 ddd-*.md", "至少一份固定代理定义")];
  const valid = new Set([...fixed, ...templates]);
  const declared = new Map();
  const nonAgentTokens = new Set(enumerateSkillDirs(root)); // ddd- 前缀但非代理名：与代理名同形的 skill 目录名
  const found = [];
  for (const rel of AGENT_DECLARATION_FILES) {
    const fileRel = rel.join("/");
    // 声明文件缺失或不可读时不得静默当作 0 声明，否则删文件不会产生任何漂移
    if (!readFileText(path.join(root, ...rel))) {
      found.push(drift("C5", fileRel, 0, "声明文件须存在且可读", `${fileRel} 可读`));
      continue;
    }
    for (const [token, at] of collectDeclaredAgents(root, rel, nonAgentTokens)) {
      if (!declared.has(token)) declared.set(token, at);
    }
  }
  for (const [token, at] of declared) {
    if (REMOVED_AGENTS.has(token)) { found.push(drift("C5", at.file, at.line, "已删除的代理名不得再出现于声明面", `移除 ${token}`, token)); continue; }
    if (!valid.has(token)) found.push(drift("C5", at.file, at.line, "声明的代理名须对应 agents/ 或 agent-templates/ 下的定义", `agents/${token}.md 或 agent-templates/${token}.md 存在`, token));
  }
  for (const name of valid) {
    if (!declared.has(name)) found.push(drift("C5", AGENT_DECLARATION_FILES.map((r) => r.join("/")).join("、"), 0, "每个代理定义须被入口文档或 workflow 声明", `${name} 被声明`, name));
  }
  return found;
}

// 单个声明文件的 skill 名集合：结构与安装内容明细文档取结构树围栏内的 skills/<名>/ 目录项
function collectDeclaredSkills(root, rel) {
  const text = readFileText(path.join(root, ...rel));
  const names = new Map();
  const add = (name, no) => { if (SKILL_NAME.test(name) && !names.has(name)) names.set(name, no); };
  let fenced = false;
  for (const row of withLineNumbers(text)) {
    if (/^\s*```/.test(row.line)) { fenced = !fenced; continue; }
    if (!fenced) continue;
    // 结构树的目录项形如 skills/<名>/，singular 形态 skill/ 一并兼容，避免旧写法静默失配
    for (const m of row.line.matchAll(/skills?\/([A-Za-z0-9._-]+)\//g)) add(m[1], row.no);
  }
  return { file: rel.join("/"), names };
}

// C11 skill 清单一致性：skills/*/SKILL.md 的实际目录集合，与各声明文件的 skill 名集合双向一致
function checkSkillRoster(root) {
  const actual = enumerateSkillDirs(root);
  if (!actual.length) return [drift("C11", "skills/", 0, "skill 目录须含 SKILL.md", "至少一个 skill 目录")];
  const sources = SKILL_DECLARATION_FILES.map((rel) => collectDeclaredSkills(root, rel));
  const found = [];
  for (const name of actual) {
    for (const source of sources) {
      if (source.names.has(name)) continue;
      found.push(drift("C11", source.file, 0, "每个 skill 目录须在该声明文件中列出", `声明含 ${name}`, name));
    }
  }
  for (const source of sources) {
    for (const [name, no] of source.names) {
      if (!actual.includes(name)) found.push(drift("C11", source.file, no, "声明的 skill 名须对应 skills/ 下的目录", `skills/${name}/SKILL.md 存在`, name));
    }
  }
  return found;
}

module.exports = { checkAgentRoster, checkSkillRoster };
