/**
 * 目标：探测本机工具链并落盘为 <项目根>/docs/.ddd-env.json，供后续节点按环境记录组装测试与覆盖率命令，替代写死的调用形态。
 * 范围：校验项目根入参、解析所需版本参数（命令行 `--required <语言名>=<版本>` 与旧件声明的 `required` 并入）、注入进程与文件两类副作用原语、调用 lib/env-probe.js 的纯函数装配记录（结构键集为 probedAt、tools、languages、frameworks 四键，项目声明所需版本时并入可选第五键 required；tools 每项七键：path、source 与可用性、版本，加管理器三键，其中 source 取四级优先链所得来源级别，见 DESIGN-environment.md 第八、十、十二节）、写出机读件并输出人读摘要（含提供者行、校验降级、来源分级、测试框架三态与已声明的所需版本）。
 * 不包含：跨机合并既有记录（本机探测结果覆盖旧件，仅旧件已声明的 `required` 按并入规则保留，因记录须反映当前机器的工具链）、门禁接入、覆盖率基线、跨机比较。不引入第三方依赖。
 * 用法：node env-probe.js <项目根绝对路径> [--required <语言名>=<版本>]...；只查本机 PATH 与命令输出，不访问网络。
 * 出口：恒 0，探测本身不因工具缺失失败；入参非法时 2。机读件是权威，stdout 摘要仅供人读。
 * 版本控制：该件随机器而异，同仓库不同机器会互相覆盖，故不纳入版本控制，由 .gitignore 排除，理由见 spec-govern 的状态相关节。
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { DEFAULT_VERSION_ARGS, VERSION_ARGS, FRAMEWORK_COMMANDS, probeAll, buildTools, deriveLanguages, deriveFrameworks, buildEnvRecord } = require("./lib/env-probe.js");
const { collectManagers, enrichTools, versionCheckDowngrades, PROVIDER_LANGUAGES, parseRequiredArgs, mergeRequired } = require("./lib/env-command.js");
const { SOURCE_LEVELS } = require("./lib/env-resolve.js");

// 平台扩展名：Windows 先试 PATHEXT 各扩展名、再退无扩展名，使 .cmd/.exe 优先于同名的 POSIX 壳脚本；其余平台只按原样
function executableExts(env, platform) {
  if (platform !== "win32") return [""];
  const pathext = env.PATHEXT || ".COM;.EXE;.BAT;.CMD";
  return [...pathext.split(";").map((ext) => ext.trim()).filter(Boolean), ""];
}

// PATH 目录清单：环境变量名在 Windows 上大小写不一，逐名兜底
function envPathDirs(env) {
  return String(env.PATH || env.Path || env.path || "").split(path.delimiter).filter(Boolean);
}

// 可执行文件判定：任意读取异常一律回 false，探测不因单条失败而中断
function isFile(file) {
  try { return fs.statSync(file).isFile(); } catch (e) { return false; }
}

// 目录列举：brew Cellar 一类按 formula/version 分层的安装根须先展开再试探（见 lib/env-resolve.js）；不可读一律回空清单，该安装根自然跳过
function listDir(dir) {
  try { return fs.readdirSync(dir); } catch (e) { return []; }
}

// 版本查询：以解析到的绝对路径为可执行文件执行版本参数，合并 stdout 与 stderr（java -version 走 stderr）；
// Windows 的 .cmd/.bat 须经 ComSpec 执行，Node 无壳 spawn 会因 EINVAL 失败；出错回空串
function runVersion(command, exePath) {
  const args = VERSION_ARGS[command] || DEFAULT_VERSION_ARGS;
  return runProcess(exePath, args, 5000);
}

// 管理器列出命令：以管理器可执行文件执行其列出参数，超时放宽（如 uv python list 需枚举本地环境）；出错或超时回空串，由调用方降级
function runManager(exePath, args) {
  return runProcess(exePath, args, 10000);
}

// 进程调用原语：Windows 的 .cmd/.bat 须经 ComSpec 执行，其余直接无壳 spawn；任意错误一律回空串，探测不因单条失败而中断
function runProcess(exePath, args, timeout) {
  const isBatch = process.platform === "win32" && /\.(cmd|bat)$/i.test(exePath);
  const [file, argv] = isBatch ? [process.env.ComSpec || "cmd.exe", ["/d", "/c", exePath, ...args]] : [exePath, args];
  try {
    const result = spawnSync(file, argv, { encoding: "utf8", timeout });
    if (result.error) return "";
    return `${result.stdout || ""}${result.stderr || ""}`;
  } catch (e) { return ""; }
}

// 探测并装配记录：把本机原语注入纯核心，先按四级优先链归一工具事实，再并入版本管理器事实，最后推语言形态，不含落盘
function probeProject(root, required) {
  const ctx = {
    root,
    pathDirs: envPathDirs(process.env),
    exts: executableExts(process.env, process.platform),
    platform: process.platform,
    env: process.env,
    isFile,
    listDir,
    runVersion,
    runManager,
  };
  const base = buildTools(probeAll(ctx));
  const tools = enrichTools(base, collectManagers(base, ctx));
  const languages = deriveLanguages(tools);
  const frameworks = deriveFrameworks(tools, languages, probeAll(ctx, FRAMEWORK_COMMANDS));
  return buildEnvRecord({ probedAt: new Date().toISOString(), tools, languages, frameworks, required });
}

// 旧件所需版本读取：探测前读旧件并取其 required 作基，文件缺失或不可解析按空对象，不回退报错
function readDeclaredRequired(root) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(root, "docs", ".ddd-env.json"), "utf8")); } catch (e) { return {}; }
  const required = data && data.required;
  return required && typeof required === "object" && !Array.isArray(required) ? required : {};
}

// 落盘：docs 目录不存在即创建，写入机读件，回传绝对路径
function writeRecord(root, record) {
  const dir = path.join(root, "docs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, ".ddd-env.json");
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return file;
}

// 摘要：按可用与不可用分组列工具，逐级列来源级别，再列各语言可用形态；机读件才是权威，本摘要仅供人读
function summarize(record) {
  const names = Object.keys(record.tools);
  const ready = names.filter((name) => record.tools[name].available);
  const missing = names.filter((name) => !record.tools[name].available);
  // 来源分级：四级各自命中多少工具，供使用者一眼看出哪些命令取自项目内部或包管理器安装根，无须逐条翻机读件
  const levels = names.filter((name) => record.tools[name].available).map((name) => record.tools[name].source);
  const byLevel = SOURCE_LEVELS.map((level) => `${level} ${levels.filter((item) => item === level).length}`).join("、");
  const languages = Object.entries(record.languages);
  const langReady = languages.filter(([, value]) => value.available).map(([name, value]) => `${name}=${value.runner}`);
  const langMissing = languages.filter(([, value]) => !value.available).map(([name]) => name);
  const managed = names.filter((name) => record.tools[name].manager)
    .map((name) => { const tool = record.tools[name]; return `${name}=${tool.manager}(激活 ${tool.active || "未知"}，候选 ${tool.versions.length} 个)`; });
  // 运行时提供者：列其所提供语言与清单规模；清单不可得者另行记一行降级，免得降级被静默吞掉
  const providers = Object.entries(PROVIDER_LANGUAGES)
    .map(([name, language]) => {
      const row = record.tools[name];
      return row && row.available ? `${name}→${language}(提供 ${row.versions.length} 个版本)` : null;
    })
    .filter(Boolean);
  const downgrades = versionCheckDowngrades(record)
    .map((item) => `${item.tool}→${item.language}：${item.reason}，所需版本校验降级为不校验`);
  const frameworks = Object.entries(record.frameworks || {});
  const fwReady = frameworks.filter(([, value]) => value.available).map(([name, value]) => `${name}(${value.kind === "builtin" ? "内建" : "已装"})`);
  const fwMissing = frameworks.filter(([, value]) => !value.available).map(([name, value]) => `${name}(${value.kind === "builtin" ? "内建但运行器缺席" : "未安装"})`);
  // 已声明所需版本：有声明才输出该行，无声明不输出
  const required = Object.entries(record.required || {}).map(([language, version]) => `${language}=${version}`);
  return [
    `=== 环境探测：${record.probedAt} ===`,
    `工具可用 ${ready.length}/${names.length}：${ready.join("、") || "无"}`,
    `来源级别：${byLevel}`,
    `工具不可用 ${missing.length}：${missing.join("、") || "无"}`,
    `版本管理器：${managed.join("；") || "无"}`,
    `运行时提供者：${providers.join("；") || "无"}`,
    ...(required.length ? [`已声明所需版本：${required.join("、")}`] : []),
    ...(downgrades.length ? [`校验降级：${downgrades.join("；")}`] : []),
    `测试框架可用：${fwReady.join("、") || "无"}`,
    `测试框架缺失：${fwMissing.join("、") || "无"}`,
    `语言可用形态：${langReady.join("；") || "无"}`,
    `语言不可用：${langMissing.join("、") || "无"}`,
  ].join("\n");
}

// 入口：解析入参并校验项目根为存在的绝对目录，合并旧件与命令行声明的所需版本，探测、落盘并输出摘要；返回进程退出码
function main(argv) {
  let parsedArgs;
  try { parsedArgs = parseRequiredArgs(argv); } catch (error) { process.stderr.write(`${error.message}\n`); return 2; }
  const root = parsedArgs.rest[0];
  if (!root) { process.stderr.write("用法：node env-probe.js <项目根绝对路径> [--required <语言名>=<版本>]...\n"); return 2; }
  if (!path.isAbsolute(root)) { process.stderr.write(`项目根须为绝对路径：${root}\n`); return 2; }
  let stat;
  try { stat = fs.statSync(root); } catch (e) { stat = null; }
  if (!stat || !stat.isDirectory()) { process.stderr.write(`项目根不存在或非目录：${root}\n`); return 2; }
  const required = mergeRequired(readDeclaredRequired(root), parsedArgs.entries);
  const record = probeProject(root, required);
  const file = writeRecord(root, record);
  process.stdout.write(`${summarize(record)}\n环境记录已写入 ${file}\n`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
