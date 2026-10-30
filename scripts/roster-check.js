/**
 * 目标：把仓库清单类校验（代理清单、skill 清单）收敛为可单独复核的库文件，控制单脚本的行数规模。
 * 范围：代理清单校验与 skill 清单校验两项——文件系统枚举、声明文件解析、集合双向比对与漂移项产出。
 * 不包含：文件遍历之外的语义判断（代理定义正文、skill 正文等）、其他校验项、命令行入口。
 * 声明文件集合：代理清单为 skill/ddd-methodology/SKILL.md、skill/ddd-methodology/references/spec-role.md、README.md、
 *   scripts/install.sh、scripts/install.bat、scripts/uninstall.sh、scripts/uninstall.bat、workflows/ddd-workflow.js，
 *   另加 profiles/models.json 的配比档位；skill 清单为前述安装脚本、卸载脚本与 README.md。
 * 代理名载体：规范与仓库说明用通用 ddd- 前缀 token 扫描，注释行不参与；workflow 的 key、runKey、stateNote 参数
 *   与状态键是运行标识而非代理名，故只取 agent 字段的字符串字面量；配比档位取各档 roles 的键集合，按档与
 *   agents/ 集合比对，缺角色与幽灵角色均报漂移。
 * skill 名载体：安装脚本取变量名含 skill 的清单赋值与 skill 路径引用；README 取结构树围栏内的 skill/<名>/ 目录项。
 * 代理名排除集：与代理名同形的 skill 目录名由 enumerateSkillDirs 动态取得，与 C11 共用同一枚举，
 *   不得硬编码 skill 名；skill 目录的枚举定义以含 SKILL.md 为准，两处共用以免各自遍历漂移。
 * 调用形态：checkAgentRoster(root)、checkSkillRoster(root)；root 为仓库根；两者回传漂移项数组，
 *   字段与 ref-check 现有漂移项一致，含 item、file、line、criterion、expect、found。
 * 调用方：scripts/ref-check.js 的 C5 与 C11 校验项。
 * 依赖：文本读取、行号与漂移项构造取 ./lib/text.js 的 readFileText、withLineNumbers、drift，本模块不再内联重复实现。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./lib/text.js");

// 声明代理集合的入口：规范入口、仓库说明与安装脚本；卸载脚本持有同名清单副本，一并校验以免悄悄漂移。
// 规范角色表与沙箱 workflow 无生成通道，只能内联，故同样列入受控声明面
const WORKFLOW_REL = "workflows/ddd-workflow.js";
const AGENT_DECLARATION_FILES = [["skill", "ddd-methodology", "SKILL.md"], ["skill", "ddd-methodology", "references", "spec-role.md"], ["README.md"], ["scripts", "install.sh"], ["scripts", "install.bat"], ["scripts", "uninstall.sh"], ["scripts", "uninstall.bat"], WORKFLOW_REL.split("/")];
const MODELS_REL = ["profiles", "models.json"];
// skill 清单的声明文件：安装脚本与卸载脚本、仓库说明；实际目录集合由 skill/*/SKILL.md 枚举
const SKILL_DECLARATION_FILES = [["scripts", "install.sh"], ["scripts", "install.bat"], ["scripts", "uninstall.sh"], ["scripts", "uninstall.bat"], ["README.md"]];
const SKILL_NAME = /^ddd-[a-z][a-z0-9-]*$/; // skill 目录名形态，与安装脚本清单取值一致

// skill 目录集合的唯一枚举入口：C5 的代理名排除集与 C11 的实际集合共用，避免两处各自遍历 skill 目录
function enumerateSkillDirs(root) {
  try {
    return fs.readdirSync(path.join(root, "skill"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, "skill", entry.name, "SKILL.md")))
      .map((entry) => entry.name);
  } catch (e) { return []; }
}

// 脚本的声明载体是清单赋值行与字段字面量，注释行不是；注释里“ddd- 前缀”类描述词会被裸 token 扫描误当声明
function isCommentLine(rel, line) {
  const name = rel[rel.length - 1];
  const trimmed = line.trim();
  if (name.endsWith(".sh")) return trimmed.startsWith("#");
  if (name.endsWith(".bat")) return /^(?:rem\b|::)/i.test(trimmed);
  if (name.endsWith(".js")) return /^(?:\/\/|\/\*|\*)/.test(trimmed);
  return false;
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
    for (const m of row.line.matchAll(/(?<![\w./-])ddd-[a-z][a-z0-9-]*(?![\w./-])/g)) add(m[0], row.no);
  }
  return declared;
}

// 档位对象内 roles 块的键与行号：块内无嵌套，取 "roles": { 之后到首个闭括号行之间的键行
function collectProfileRoles(lines, startIndex) {
  const roles = new Map();
  let i = startIndex;
  for (; i < lines.length; i++) if (/^\s*"roles"\s*:\s*\{/.test(lines[i])) break;
  for (i += 1; i < lines.length; i++) {
    if (/^\s*\}/.test(lines[i])) break;
    const m = lines[i].match(/^\s*"([^"]+)"\s*:/);
    if (m) roles.set(m[1], i + 1);
  }
  return roles;
}

// 配比面：profiles/models.json 每档的 roles 键集合须等于 agents/ 集合，缺角色与幽灵角色都是漂移
function checkModelProfiles(root, roster) {
  const rel = MODELS_REL.join("/");
  const text = readFileText(path.join(root, ...MODELS_REL));
  if (!text) return [drift("C5", rel, 0, "配比文件须存在且可读", "profiles/models.json 可读")];
  let doc = null;
  try { doc = JSON.parse(text); } catch (e) { return [drift("C5", rel, 0, "配比文件须可解析", "合法 JSON", String(e.message))]; }
  const profiles = (doc && doc.profiles) || {};
  const lines = text.split("\n");
  const found = [];
  for (const [name, profile] of Object.entries(profiles)) {
    const head = lines.findIndex((line) => new RegExp(`^\\s*"${name}"\\s*:\\s*\\{`).test(line));
    const roles = collectProfileRoles(lines, head < 0 ? lines.length : head + 1);
    const declared = new Set(Object.keys((profile && profile.roles) || {}));
    const criterion = `配比档 ${name} 的角色集合须等于 agents/ 目录集合`;
    for (const agent of roster) {
      if (!declared.has(agent)) found.push(drift("C5", rel, head + 1, criterion, `该档含角色 ${agent}`, agent));
    }
    for (const agent of declared) {
      if (!roster.includes(agent)) found.push(drift("C5", rel, roles.get(agent) || 0, criterion, "该角色须对应 agents/ 下的定义", agent));
    }
  }
  return found;
}

// C5 代理清单一致性：agents/ddd-*.md 的文件集合与入口文档、安装脚本声明的代理集合一致
function checkAgentRoster(root) {
  let roster = [];
  try { roster = fs.readdirSync(path.join(root, "agents")).filter((name) => /^ddd-.*\.md$/.test(name)).map((name) => name.replace(/\.md$/, "")); } catch (e) { roster = []; }
  if (!roster.length) return [drift("C5", "agents/", 0, "代理定义目录须含 ddd-*.md", "至少一份代理定义")];
  const declared = new Map();
  const nonAgentTokens = new Set(enumerateSkillDirs(root)); // ddd- 前缀但非代理名：与代理名同形的 skill 目录名
  const found = [];
  for (const rel of AGENT_DECLARATION_FILES) {
    const fileRel = rel.join("/");
    // 声明文件缺失或不可读时不得静默当作 0 声明，否则删文件不会产生任何漂移；与 checkModelProfiles 对配比文件的处理一致
    if (!readFileText(path.join(root, ...rel))) {
      found.push(drift("C5", fileRel, 0, "声明文件须存在且可读", `${fileRel} 可读`));
      continue;
    }
    for (const [token, at] of collectDeclaredAgents(root, rel, nonAgentTokens)) {
      if (!declared.has(token)) declared.set(token, at);
    }
  }
  for (const [token, at] of declared) {
    if (!roster.includes(token)) found.push(drift("C5", at.file, at.line, "声明的代理名须对应 agents/ 下的代理定义", `agents/${token}.md 存在`, token));
  }
  for (const name of roster) {
    if (!declared.has(name)) found.push(drift("C5", AGENT_DECLARATION_FILES.map((r) => r.join("/")).join("、"), 0, "每个代理定义须被入口文档或安装脚本声明", `${name} 被声明`, name));
  }
  return found.concat(checkModelProfiles(root, roster));
}

// 单个声明文件的 skill 名集合：安装脚本取清单赋值与路径引用，README 取结构树围栏内的目录项
function collectDeclaredSkills(root, rel) {
  const text = readFileText(path.join(root, ...rel));
  const names = new Map();
  const add = (name, no) => { if (SKILL_NAME.test(name) && !names.has(name)) names.set(name, no); };
  if (rel[rel.length - 1] === "README.md") {
    let fenced = false;
    for (const row of withLineNumbers(text)) {
      if (/^\s*```/.test(row.line)) { fenced = !fenced; continue; }
      if (!fenced) continue;
      for (const m of row.line.matchAll(/skill\/([A-Za-z0-9._-]+)\//g)) add(m[1], row.no);
    }
  } else {
    // 清单赋值：变量名含 skill 的 shell/bat 单行赋值，取值为目录名数组或空格分隔名；路径引用：skill[s]/<名>
    for (const m of text.matchAll(/^[ \t]*(?:set\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?[ \t]*=[ \t]*\(?([^)\r\n"]*)/gm)) {
      if (!/skill/i.test(m[1])) continue;
      const no = text.slice(0, m.index).split("\n").length;
      for (const token of m[2].split(/\s+/)) add(token.trim(), no);
    }
    for (const row of withLineNumbers(text)) {
      for (const m of row.line.matchAll(/skills?[\\/]([A-Za-z0-9._-]+)/g)) add(m[1], row.no);
    }
  }
  return { file: rel.join("/"), names };
}

// C11 skill 清单一致性：skill/*/SKILL.md 的实际目录集合，与各声明文件的 skill 名集合双向一致
function checkSkillRoster(root) {
  const actual = enumerateSkillDirs(root);
  if (!actual.length) return [drift("C11", "skill/", 0, "skill 目录须含 SKILL.md", "至少一个 skill 目录")];
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
      if (!actual.includes(name)) found.push(drift("C11", source.file, no, "声明的 skill 名须对应 skill/ 下的目录", `skill/${name}/SKILL.md 存在`, name));
    }
  }
  return found;
}

module.exports = { checkAgentRoster, checkSkillRoster };
