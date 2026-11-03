#!/usr/bin/env node
/**
 * 目标：为已按旧方式安装的用户清理用户作用域的残留，使其迁移到 pi package 安装方式。
 * 范围：备份并改写 ~/.pi/agent/APPEND_SYSTEM.md；删除 ~/.pi/agent/agents/ddd-*.md；删除 ~/.pi/agent/skills/ 下
 *   ddd-methodology、ddd-rebuild、ddd-refactor 三个目录；删除 ~/.pi/agent/extensions/ddd-governance.ts；
 *   从 APPEND_SYSTEM.md 中移除 ddd 标记区块并保留区块外内容。
 * 不包含：本方法论本体的安装（由 pi install 承担）、模型配比的清理（由 apply-models.js 承担）、随包运行流程指令。
 * 丙类部署辅助：本脚本不进入随包分发的运行流程指令，也不注册为工具，仅在用户显式运行时执行。
 *
 * 保留 settings.json 的 subagents.agentOverrides：该覆写按代理名生效，对 pi package 安装的 agent 仍然适用，
 * 移除它会丢失用户已应用的模型配比，故本脚本从不读写 settings.json。
 *
 * 安全约定：默认先打印完整计划再执行；--dry-run 只列计划不落盘；备份 APPEND_SYSTEM.md 失败即中止且不做任何删除；
 *   删除只命中 ddd 命名规则（agents 段限定 ddd-*.md，skills 段限定三个具名目录，扩展段限定单个具名文件），
 *   不使用通配到无关文件的写法。
 *
 * 用法：
 *   node scripts/migrate-to-package.js            打印计划并执行迁移
 *   node scripts/migrate-to-package.js --dry-run  只打印计划，不落盘
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const BEGIN = "<!-- ddd-methodology:begin -->";
const END = "<!-- ddd-methodology:end -->";
// 旧安装写入的三个 skill 目录名，逐个具名删除，绝不递归删除整个 skills/ 以免误伤用户自有 skill
const DDD_SKILL_DIRS = ["ddd-methodology", "ddd-rebuild", "ddd-refactor"];
// agents 段的命名规则：旧安装只写入 ddd- 前缀的代理定义
const DDD_AGENT_FILE_RE = /^ddd-.*\.md$/;
const NEXT_STEP = "pi install git:github.com/Cikaros/ddd-methodology@v0.1.0";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const PI_HOME = path.join(os.homedir(), ".pi", "agent");
const APPEND_PATH = path.join(PI_HOME, "APPEND_SYSTEM.md");
const AGENTS_DIR = path.join(PI_HOME, "agents");
const SKILLS_DIR = path.join(PI_HOME, "skills");
// 旧安装的本地守卫扩展：职责已由 package 内的扩展取代
const GUARD_FILE = path.join(PI_HOME, "extensions", "ddd-governance.ts");

function readText(file) {
  try { return fs.readFileSync(file, "utf8"); } catch (e) { return null; }
}

// 删除前把路径钉在 PI_HOME 内，防止解析异常把删除动作引向用户目录之外
function assertInsidePiHome(target) {
  const resolved = path.resolve(target);
  const root = path.resolve(PI_HOME) + path.sep;
  if (resolved !== path.resolve(PI_HOME) && !resolved.startsWith(root)) {
    throw new Error(`拒绝删除用户作用域之外的路径：${resolved}`);
  }
  return resolved;
}

// 列出旧安装残留：agents 段按命名规则枚举，skills 段与扩展段按具名路径探测
function collectResidue() {
  let agentFiles = [];
  try {
    agentFiles = fs.readdirSync(AGENTS_DIR)
      .filter((name) => DDD_AGENT_FILE_RE.test(name))
      .map((name) => path.join(AGENTS_DIR, name))
      .sort();
  } catch (e) { agentFiles = []; }
  const skillDirs = DDD_SKILL_DIRS
    .map((name) => path.join(SKILLS_DIR, name))
    .filter((dir) => { try { return fs.statSync(dir).isDirectory(); } catch (e) { return false; } });
  const guardFiles = fs.existsSync(GUARD_FILE) ? [GUARD_FILE] : [];
  const appendText = fs.existsSync(APPEND_PATH) ? readText(APPEND_PATH) : null;
  const hasBlock = typeof appendText === "string" && appendText.includes(BEGIN);
  return { agentFiles, skillDirs, guardFiles, appendText, hasBlock };
}

// 移除 ddd 标记区块，含 begin 与 end 注释行；区块之外的用户内容原样保留
function stripBlock(text) {
  const b = text.indexOf(BEGIN);
  if (b === -1) return text.replace(/\s+$/, "");
  const e = text.indexOf(END, b);
  if (e === -1) return text.slice(0, b).replace(/\s+$/, "");
  const before = text.slice(0, b).replace(/\s+$/, "");
  const after = text.slice(e + END.length).replace(/^\s+/, "");
  return [before, after].filter(Boolean).join("\n\n");
}

const residue = collectResidue();
const hasResidue = residue.agentFiles.length > 0 || residue.skillDirs.length > 0 || residue.guardFiles.length > 0 || residue.hasBlock;

const out = [];
const say = (line) => { out.push(line); console.log(line); };

say("=== 旧安装迁移到 pi package ===");
say(`用户作用域：${PI_HOME}`);

if (!hasResidue) {
  say("无需迁移：未发现旧安装残留。");
  say(`下一步：${NEXT_STEP}`);
  process.exit(0);
}

// 完整计划：无论 dry-run 与否都先打印，dry-run 到此为止
say("");
say("将执行的动作：");
say(`  1. 备份 ${APPEND_PATH} 到同目录带时间戳的备份名（备份失败即中止）`);
say(`  2. 删除 agents 段 ${residue.agentFiles.length} 个 ddd-*.md 代理定义`);
for (const f of residue.agentFiles) say(`       ${f}`);
say(`  3. 删除 skills 段 ${residue.skillDirs.length} 个旧 skill 目录`);
for (const d of residue.skillDirs) say(`       ${d}`);
say(`  4. 删除扩展 ${residue.guardFiles.length} 个`);
for (const f of residue.guardFiles) say(`       ${f}`);
if (residue.hasBlock) say(`  5. 从 ${APPEND_PATH} 移除 ddd 标记区块，保留区块外内容`);
else say("  5. APPEND_SYSTEM.md 无 ddd 标记区块，不改写该文件");
say("");
say(`保留 ${path.join(PI_HOME, "settings.json")} 的 subagents.agentOverrides：该覆写对 package agent 仍然生效，不做改动。`);

if (dryRun) {
  say("");
  say("[dry-run] 仅打印计划，未落盘。");
  say(`下一步：${NEXT_STEP}`);
  process.exit(0);
}

// 备份：任一失败即中止，此时尚未做任何删除
if (fs.existsSync(APPEND_PATH)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${APPEND_PATH}.${stamp}.bak`;
  try {
    fs.copyFileSync(APPEND_PATH, backupPath);
    say("");
    say(`[完成] 已备份 ${APPEND_PATH} -> ${backupPath}`);
  } catch (e) {
    say("");
    say(`[中止] 备份失败：${e.message}`);
    say("       未做任何删除，旧安装保持原样。");
    process.exit(1);
  }
}

// 删除：逐项具名，命中数分别报告
let removedAgents = 0;
for (const file of residue.agentFiles) {
  try { fs.rmSync(assertInsidePiHome(file)); removedAgents++; } catch (e) { say(`[警告] 删除失败 ${file}：${e.message}`); }
}
say(`[完成] 已删除 ${removedAgents} 个 ddd agent 定义`);

let removedSkills = 0;
for (const dir of residue.skillDirs) {
  try { fs.rmSync(assertInsidePiHome(dir), { recursive: true }); removedSkills++; } catch (e) { say(`[警告] 删除失败 ${dir}：${e.message}`); }
}
say(`[完成] 已删除 ${removedSkills} 个旧 skill 目录`);

let removedGuards = 0;
for (const file of residue.guardFiles) {
  try { fs.rmSync(assertInsidePiHome(file)); removedGuards++; } catch (e) { say(`[警告] 删除失败 ${file}：${e.message}`); }
}
say(`[完成] 已删除 ${removedGuards} 个本地扩展`);

if (residue.hasBlock) {
  try {
    const rest = stripBlock(residue.appendText === null ? "" : residue.appendText);
    if (rest.trim()) fs.writeFileSync(APPEND_PATH, rest + "\n");
    else fs.rmSync(APPEND_PATH);
    say("[完成] 已移除 APPEND_SYSTEM.md 的 ddd 标记区块，区块外内容保留");
  } catch (e) {
    say(`[警告] 改写 APPEND_SYSTEM.md 失败：${e.message}`);
  }
}

say("");
say(`[成功] 旧安装残留清理完成，settings.json 的 subagents.agentOverrides 未改动。`);
say(`下一步：${NEXT_STEP}`);
