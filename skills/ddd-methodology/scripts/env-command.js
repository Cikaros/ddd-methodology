#!/usr/bin/env node
/**
 * 目标：为环境记录与语言命令模板的组装提供生产入口，读 <项目根>/docs/.ddd-env.json 与本包该语言的命令模板，出可执行命令，供实现者与测试执行者调用，替代手工拼接。
 * 范围：校验项目根与命令组入参（命令组取值域取自 lib/env-command.js 的 COMMAND_GROUPS 常量）、按语言名定位本包该语言的命令模板、读环境记录、取指定命令组的候选集并调 lib/env-command.js 的 buildCommand 组装；即参数解析、读盘与输出三段，两级解析仍在 lib/env-command.js。
 * 不包含：探测与记录落盘（见 scripts/env-probe.js）、语言命令模板的内容与候选次序（归各语言技能的 assets/commands.json）、版本管理器识别与两级解析的实现。不引入第三方依赖。
 * 用法：node env-command.js <项目根绝对路径> <语言名> <test|coverage>；命令模板按相对本脚本 ../../lang-<语言名>/assets/commands.json 定位，所需版本由记录回退取用，不另传。
 * 出口：命中即 stdout 一行可执行命令并退 0；缺口即 stderr 说明原因并退 1；用法错误即 stderr 并退 2。
 */

const fs = require("node:fs");
const path = require("node:path");
const { buildCommand, COMMAND_GROUPS } = require("./lib/env-command.js");
const { ENV_RECORD_REL } = require("./lib/paths.js");

// 环境记录读取：缺失回 null，不可解析回带标记对象，两态由调用方各报各的缺口，不互相吞并
function readEnvRecord(root) {
  let text;
  try { text = fs.readFileSync(path.join(root, ...ENV_RECORD_REL.split("/")), "utf8"); } catch (e) { return null; }
  try { return JSON.parse(text); } catch (e) { return { __parseError: e.message }; }
}

// 命令模板读取：按语言名定位本包该技能的 assets/commands.json，缺文件或不可解析均回 null，由调用方报该语言无命令模板
function readTemplates(language) {
  const file = path.join(__dirname, "..", "..", `lang-${language}`, "assets", "commands.json");
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch (e) { return null; }
  try { return JSON.parse(text); } catch (e) { return null; }
}

// 入口：校验入参，读记录与模板，取候选集调组装核心；命中出命令并退 0，缺口出原因并退 1，用法错误出提示并退 2
function main(argv) {
  const [root, language, group] = argv;
  if (!root || !language || !group) { process.stderr.write("用法：node env-command.js <项目根绝对路径> <语言名> <test|coverage>\n"); return 2; }
  if (!COMMAND_GROUPS.includes(group)) { process.stderr.write(`命令组名须取自 ${COMMAND_GROUPS.join("、")}：${group}\n`); return 2; }
  if (!path.isAbsolute(root)) { process.stderr.write(`项目根须为绝对路径：${root}\n`); return 2; }
  let stat;
  try { stat = fs.statSync(root); } catch (e) { stat = null; }
  if (!stat || !stat.isDirectory()) { process.stderr.write(`项目根不存在或非目录：${root}\n`); return 2; }
  const record = readEnvRecord(root);
  if (!record) { process.stderr.write(`缺口：环境记录不存在 ${ENV_RECORD_REL}，请先运行 env-probe.js 生成\n`); return 1; }
  if (record.__parseError) { process.stderr.write(`缺口：环境记录不可解析（${record.__parseError}）\n`); return 1; }
  const templates = readTemplates(language);
  if (!templates) { process.stderr.write(`缺口：语言 ${language} 无命令模板\n`); return 1; }
  const candidates = templates[group];
  if (!Array.isArray(candidates) || candidates.length === 0) { process.stderr.write(`缺口：语言 ${language} 的 ${group} 组无可用候选\n`); return 1; }
  let command;
  try { command = buildCommand({ candidates, language }, record); } catch (error) { process.stderr.write(`${error.message}\n`); return 1; }
  process.stdout.write(`${command}\n`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
