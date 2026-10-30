/**
 * 目标：把仓库清单类校验（代理清单、skill 清单）收敛为可单独复核的库文件，控制单脚本的行数规模。
 * 范围：代理清单校验与 skill 清单校验两项——文件系统枚举、声明文件解析、集合双向比对与漂移项产出。
 * 不包含：文件遍历之外的语义判断（代理定义正文、skill 正文等）、其他校验项、命令行入口。
 * 声明文件集合：代理清单为 skill/ddd-methodology/SKILL.md、README.md、scripts/install.sh、scripts/install.bat、
 *   scripts/uninstall.sh、scripts/uninstall.bat；skill 清单同上六个文件，卸载脚本各自持有同名清单副本，须一并受校验。
 * 声明载体：安装脚本取变量名含 skill 的清单赋值与 skill 路径引用；README 取结构树围栏内的 skill/<名>/ 目录项。
 * 代理名排除集：与代理名同形的 skill 目录名由 enumerateSkillDirs 动态取得，与 C11 共用同一枚举，
 *   不得硬编码 skill 名；skill 目录的枚举定义以含 SKILL.md 为准，两处共用以免各自遍历漂移。
 * 调用形态：checkAgentRoster(root)、checkSkillRoster(root)；root 为仓库根；两者回传漂移项数组，
 *   字段与 ref-check 现有漂移项一致，含 item、file、line、criterion、expect、found。
 * 调用方：scripts/ref-check.js 的 C5 与 C11 校验项。
 */

const fs = require("fs");
const path = require("path");

// 声明代理集合的入口：规范入口、仓库说明与安装脚本；卸载脚本持有同名清单副本，一并校验以免悄悄漂移
const AGENT_DECLARATION_FILES = [["skill", "ddd-methodology", "SKILL.md"], ["README.md"], ["scripts", "install.sh"], ["scripts", "install.bat"], ["scripts", "uninstall.sh"], ["scripts", "uninstall.bat"]];
// skill 清单的声明文件：安装脚本与卸载脚本、仓库说明；实际目录集合由 skill/*/SKILL.md 枚举
const SKILL_DECLARATION_FILES = [["scripts", "install.sh"], ["scripts", "install.bat"], ["scripts", "uninstall.sh"], ["scripts", "uninstall.bat"], ["README.md"]];
const SKILL_NAME = /^ddd-[a-z][a-z0-9-]*$/; // skill 目录名形态，与安装脚本清单取值一致

function readFileText(file) {
  try { return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""; } catch (e) { return ""; }
}
function withLineNumbers(text) {
  return String(text || "").split("\n").map((line, index) => ({ line, no: index + 1 }));
}
function drift(item, file, line, criterion, expect, found) {
  return { item, file, line, criterion, expect, found: found === undefined ? "" : String(found).slice(0, 60) };
}
// skill 目录集合的唯一枚举入口：C5 的代理名排除集与 C11 的实际集合共用，避免两处各自遍历 skill 目录
function enumerateSkillDirs(root) {
  try {
    return fs.readdirSync(path.join(root, "skill"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, "skill", entry.name, "SKILL.md")))
      .map((entry) => entry.name);
  } catch (e) { return []; }
}

// 脚本的声明载体是清单赋值行，注释行不是；注释里“ddd- 前缀”类描述词会被裸 token 扫描误当声明
function isCommentLine(rel, line) {
  const name = rel[rel.length - 1];
  const trimmed = line.trim();
  if (name.endsWith(".sh")) return trimmed.startsWith("#");
  if (name.endsWith(".bat")) return /^(?:rem\b|::)/i.test(trimmed);
  return false;
}

// C5 代理清单一致性：agents/ddd-*.md 的文件集合与入口文档、安装脚本声明的代理集合一致
function checkAgentRoster(root) {
  let roster = [];
  try { roster = fs.readdirSync(path.join(root, "agents")).filter((name) => /^ddd-.*\.md$/.test(name)).map((name) => name.replace(/\.md$/, "")); } catch (e) { roster = []; }
  if (!roster.length) return [drift("C5", "agents/", 0, "代理定义目录须含 ddd-*.md", "至少一份代理定义")];
  const declared = new Map();
  const nonAgentTokens = new Set(enumerateSkillDirs(root)); // ddd- 前缀但非代理名：与代理名同形的 skill 目录名
  for (const rel of AGENT_DECLARATION_FILES) {
    for (const row of withLineNumbers(readFileText(path.join(root, ...rel)))) {
      if (isCommentLine(rel, row.line)) continue;
      for (const m of row.line.matchAll(/(?<![\w./-])ddd-[a-z][a-z0-9-]*(?![\w./-])/g)) {
        if (!nonAgentTokens.has(m[0]) && !declared.has(m[0])) declared.set(m[0], { file: rel.join("/"), line: row.no });
      }
    }
  }
  const found = [];
  for (const [token, at] of declared) {
    if (!roster.includes(token)) found.push(drift("C5", at.file, at.line, "声明的代理名须对应 agents/ 下的代理定义", `agents/${token}.md 存在`, token));
  }
  for (const name of roster) {
    if (!declared.has(name)) found.push(drift("C5", AGENT_DECLARATION_FILES.map((r) => r.join("/")).join("、"), 0, "每个代理定义须被入口文档或安装脚本声明", `${name} 被声明`, name));
  }
  return found;
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
