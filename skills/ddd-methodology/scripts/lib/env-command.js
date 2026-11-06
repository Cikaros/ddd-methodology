/**
 * 目标：为环境探测的多版本记录与命令组装提供无副作用核心——识别版本管理器、取可用版本清单、把工具事实扩为七键，并把命令模板按环境形态与所需版本两级解析为可执行命令（见 DESIGN-environment.md 第八节）；
 *   运行时提供者型管理器（如 uv 提供 python）另记其所提供语言的版本清单，与该管理器自身版本分属两处，不得混记。
 * 范围：命令组取值域，版本管理器对照表、通用管理器表、运行时提供者表、语言到运行时行的映射，managerCandidates、detectManager、parseVersionList、managerFact、collectManagers、enrichTools、versionCheckDowngrades 七个多版本记录函数，parseRequiredArgs、mergeRequired、declaredRequired 三个所需版本声明函数，以及 resolveLanguageManager、managedRow、versionAdjustedRunner、composeCommand、frameworkAvailable、runnerAvailable、candidateMatches、candidateRunner、missingFrameworks、buildFromCandidates、buildCommand 十一个命令组装函数。
 * 不包含：进程调用与文件读写——由 scripts/env-probe.js 注入 isFile、listDir 与 runManager 三类副作用原语；亦不含探测主链、记录落盘与命令行入口。复用同目录 env-resolve.js 的目录级解析原语，可执行文件的位置表与四级优先级不在本模块。不引入第三方依赖。
 * 边界：普通管理器列出命令失败只降级为单一版本文本，不报缺陷；运行时提供者清单不可得则留空，命令组装对所需版本的校验降级为不校验并登记降级，绝不回填管理器自身版本冒充清单；
 *   所需版本未声明时不加版本前缀，只按激活版本执行；入参未给所需版本时回退取记录中的 required，使命令组装与记录声明同源，其生产调用者为 scripts/env-command.js；不得为取版本改动全局激活状态，切换只以逐命令形态表达。
 * 消费方：scripts/env-command.js 的生产入口、scripts/env-probe.js 的装配处，以及 lib/ref-env.js、lib/env-probe.test.js 与 lib/env-command.test.js 的测试；语言形态优先级表的权威为 lib/env-probe.js 的 LANGUAGE_FORMS 常量。
 */

const { resolveExecutablePath } = require("./env-resolve.js");

// 版本管理器对照表（设计册第八节）：键为运行时工具名或其语言别名，值按优先级降序列候选管理器；
// 每项含命令名、列出命令参数与切换形态模板，切换形态内的 {} 为版本占位，无占位者即不支持逐命令指定版本
const NODE_MANAGERS = [
  { name: "nvm", command: "nvm", list: ["ls"], switch: "nvm exec {} --" },
  { name: "fnm", command: "fnm", list: ["list"], switch: "fnm exec --using {}" },
  { name: "volta", command: "volta", list: ["list"], switch: "volta run --node {}" },
];
const PYTHON_MANAGERS = [
  { name: "uv", command: "uv", list: ["python", "list"], switch: "uv run --python {}" },
  { name: "pyenv", command: "pyenv", list: ["versions"], switch: "pyenv shell {}" },
];
const JAVA_MANAGERS = [
  { name: "sdkman", command: "sdk", list: ["list", "java"], switch: "sdk use java {}" },
  { name: "jenv", command: "jenv", list: ["versions"], switch: "jenv shell {}" },
];
const MANAGER_CANDIDATES = {
  node: NODE_MANAGERS,
  javascript: NODE_MANAGERS,
  typescript: NODE_MANAGERS,
  python: PYTHON_MANAGERS,
  java: JAVA_MANAGERS,
};

// 通用管理器（设计册第八节通用行）：覆盖全部工具，排在专有管理器之后；两者切换形态均不含版本占位，故不支持逐命令指定版本
const UNIVERSAL_MANAGERS = [
  { name: "mise", command: "mise", list: ["ls"], switch: "mise exec --" },
  { name: "asdf", command: "asdf", list: ["list"], switch: "asdf exec" },
];

// 运行时提供者表：既是被探测的工具行、又提供某语言运行时的管理器；此类管理器的自身版本与所提供语言的版本是两回事，
// 其行内 versions 须记所提供语言的清单（取自该语言的列出命令），自身版本只留 version——混记会让「所需版本在清单内」这一判据落在空处
const PROVIDER_LANGUAGES = { uv: "python" };

// 管理器按命令名索引：运行时提供者据此取其所提供语言的列出参数，与对照表同源，不两处维护
const MANAGER_BY_COMMAND = new Map(
  [...NODE_MANAGERS, ...PYTHON_MANAGERS, ...JAVA_MANAGERS, ...UNIVERSAL_MANAGERS].map((manager) => [manager.command, manager]),
);

// 命令组：命令模板的候选集按组取，取值域为 test 与 coverage 两值，作单一权威，供校验模块与生产入口按名引用，不另立第二份
const COMMAND_GROUPS = ["test", "coverage"];

// 语言到运行时工具行：用于从记录中取该语言的管理器声明与版本清单所在行，键须为 LANGUAGE_FORMS 内语言名
const LANGUAGE_RUNTIMES = {
  javascript: ["node"],
  typescript: ["node"],
  python: ["python", "python3"],
  java: ["java"],
  go: ["go"],
  rust: ["rustc"],
};

// 管理器候选（纯函数）：专有候选在前、通用候选在后，返回顺序即优先级
function managerCandidates(name) {
  return [...(MANAGER_CANDIDATES[name] || []), ...UNIVERSAL_MANAGERS];
}

// 管理器检测（副作用经 ctx 注入）：按候选顺序找首个可执行文件在位的管理器，附解析到的路径；全无回 null
function detectManager(name, ctx) {
  for (const candidate of managerCandidates(name)) {
    const resolved = resolveExecutablePath(candidate.command, ctx.pathDirs, ctx.exts, ctx.isFile);
    if (resolved) return { ...candidate, path: resolved };
  }
  return null;
}

// 版本清单解析（纯函数）：逐行取首个 x.y[.z…] 形态版本号并去重保序，抹平各管理器列出命令的输出差异；
// 取行域内首个版本，免得把路径或注释里的版本片段当成独立条目（如 uv 输出行尾的 cpython-3.12 目录名）；无版本号回空清单
function parseVersionList(raw) {
  const versions = [];
  const seen = new Set();
  for (const line of String(raw == null ? "" : raw).split(/\r?\n/)) {
    const matched = line.match(/\d+(?:\.\d+)+/);
    if (!matched || seen.has(matched[0])) continue;
    seen.add(matched[0]);
    versions.push(matched[0]);
  }
  return versions;
}

// 运行时提供者事实（副作用经 ctx 注入）：versions 取其所提供语言的列出命令输出，自身版本留在 version 两处分记；
// 所提供语言的激活版本不在本次探测范围故 active 留空；清单不可得即留空，交由命令组装降级为不校验，绝不用自身版本顶替
function providerFact(name, tool, ctx) {
  const manager = MANAGER_BY_COMMAND.get(name);
  const listed = manager && typeof ctx.runManager === "function" ? parseVersionList(ctx.runManager(tool.path, manager.list)) : [];
  return { manager: "", versions: listed, active: null };
}

// 单工具管理器事实（副作用经 ctx 注入）：不可用者三键留空；运行时提供者走 providerFact；
// 管理器不在位者只记单一版本文本；在位者经列出命令取版本清单，命令失败或清单为空即降级为单一版本文本，不报缺陷
function managerFact(name, tool, ctx) {
  if (!tool.available) return { manager: "", versions: [], active: null };
  if (PROVIDER_LANGUAGES[name]) return providerFact(name, tool, ctx);
  const single = tool.version ? [tool.version] : [];
  const manager = detectManager(name, ctx);
  if (!manager) return { manager: "", versions: single, active: tool.version || null };
  const listed = typeof ctx.runManager === "function" ? parseVersionList(ctx.runManager(manager.path, manager.list)) : [];
  return { manager: manager.name, versions: listed.length ? listed : single, active: tool.version || null };
}

// 管理器事实收集（副作用经 ctx 注入）：逐工具判断管理器是否在位并取版本清单
function collectManagers(tools, ctx) {
  const facts = {};
  for (const [name, tool] of Object.entries(tools)) facts[name] = managerFact(name, tool, ctx);
  return facts;
}

// 工具事实扩展（纯函数）：在四键（path、source、version、available）上并入 manager、versions、active 三键，七键结构固定；
// 普通行 active 恒取 version，使所需版本比对只有一个权威值；运行时提供者行例外——其行内 versions 记所提供语言，
// 该语言的激活版本未探测故 active 留空，免得拿管理器自身版本冒充激活语言版本而误过「激活与所需一致」的短路
function enrichTools(tools, facts) {
  const enriched = {};
  for (const [name, tool] of Object.entries(tools)) {
    const fact = facts[name] || {};
    enriched[name] = {
      path: tool.path,
      source: tool.source || null,
      version: tool.version,
      available: tool.available,
      manager: fact.manager || "",
      versions: Array.isArray(fact.versions) ? fact.versions : [],
      active: PROVIDER_LANGUAGES[name] ? null : tool.version || null,
    };
  }
  return enriched;
}

// 运行时提供者行（纯函数）：行名在提供者表内且呈提供者形态——所提供语言的激活版本未探测故 active 留空；
// 旧形态的 uv 行 active 记管理器自身版本、versions 也记自身版本，不当作提供者行，免得拿自身版本冒充语言清单
function providerRow(record, name) {
  if (!PROVIDER_LANGUAGES[name]) return null;
  const row = record.tools && record.tools[name];
  return row && row.active === null ? row : null;
}

// 校验降级记录（纯函数）：运行时提供者所提供语言的清单不可得者，命令组装对所需版本的校验降级为不校验；
// 降级须显式登记并呈现在摘要里，不得静默当作已校验。普通管理器清单不可得时降级为单一版本文本，不在此列
function versionCheckDowngrades(record) {
  const downgrades = [];
  for (const [name, language] of Object.entries(PROVIDER_LANGUAGES)) {
    const row = providerRow(record, name);
    if (!row || !row.available) continue;
    if (Array.isArray(row.versions) && row.versions.length) continue;
    downgrades.push({ tool: name, language, reason: "所提供语言的版本清单不可得" });
  }
  return downgrades;
}

// 语言管理器解析（纯函数）：先在运行时工具行的 manager 声明里找，再退回 runner 首段出现的管理器名，全无回 null
function resolveLanguageManager(language, runner, record) {
  const candidates = managerCandidates(language);
  const byName = new Map(candidates.map((candidate) => [candidate.name, candidate]));
  for (const toolName of LANGUAGE_RUNTIMES[language] || []) {
    const row = record.tools && record.tools[toolName];
    if (row && row.manager && byName.has(row.manager)) return byName.get(row.manager);
  }
  const tokens = new Set(String(runner).split(/\s+/).filter(Boolean));
  for (const candidate of candidates) if (tokens.has(candidate.name)) return candidate;
  return null;
}

// 管理器所辖工具行：该语言运行时行中 manager 与所选管理器同名的行，用于取版本清单与激活版本；
// 语言运行时行未声明该管理器时退回管理器自身行（运行时提供者型管理器，如本机无 python 而 python 由 uv 提供），无则回 null
function managedRow(language, managerName, record) {
  for (const toolName of LANGUAGE_RUNTIMES[language] || []) {
    const row = record.tools && record.tools[toolName];
    if (row && row.manager === managerName) return row;
  }
  if (PROVIDER_LANGUAGES[managerName] === language) return providerRow(record, managerName);
  return null;
}

// 版本前缀解析（纯函数）：先由所需版本与切换形态得版本前缀，再与环境形态拼合；
// 无所需版本即不加前缀；激活与所需一致即直接执行；所需不在清单、管理器不支持逐命令指定均抛缺口，不改全局激活；
// 清单不可得者降级为不校验（跳过清单判据照发切换形态），其降级由 versionCheckDowngrades 显式登记，不静默当作已校验
function versionAdjustedRunner(language, required, runner, record) {
  if (!required) return runner;
  const manager = resolveLanguageManager(language, runner, record);
  if (!manager) throw new Error(`缺口：语言 ${language} 声明所需版本 ${required}，但无支持逐命令切换的管理器，需人工切换`);
  const row = managedRow(language, manager.name, record);
  if (row && row.active && row.active === required) return runner;
  if (row && Array.isArray(row.versions) && row.versions.length && !row.versions.includes(required)) {
    throw new Error(`缺口：所需版本 ${required} 不在 ${manager.name} 的版本清单内`);
  }
  if (!String(manager.switch).includes("{}")) {
    throw new Error(`缺口：管理器 ${manager.name} 不支持逐命令指定版本，需人工切换`);
  }
  const prefix = String(manager.switch).replace("{}", required);
  return runner.split(/\s+/)[0] === manager.command ? prefix : `${prefix} ${runner}`;
}

// 模板拼合（纯函数）：替换 runner 占位符；残留任何 {…} 占位符即抛错，不返回半成品
function composeCommand(template, runner) {
  const command = String(template).replace(/\{runner\}/g, runner).trim();
  const leftover = command.match(/\{[^}]*\}/);
  if (leftover) throw new Error(`缺陷：命令模板残留未解析占位符 ${leftover[0]}`);
  return command;
}

// 所需版本参数解析（纯函数）：扫描 `--required <名>=<版本>` 与 `--required=<名>=<版本>` 两形态，回传 { entries, rest }；
// rest 为去掉这些参数后的其余参数；`--required` 缺值、值缺 `=`、或名为空即抛错
function parseRequiredArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const entries = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const token = String(args[i]);
    let value;
    if (token === "--required") {
      if (i + 1 >= args.length) throw new Error("缺口：--required 缺值");
      value = String(args[++i]);
    } else if (token.startsWith("--required=")) {
      value = token.slice("--required=".length);
    } else {
      rest.push(args[i]);
      continue;
    }
    if (value === "") throw new Error("缺口：--required 缺值");
    const eq = value.indexOf("=");
    if (eq < 0) throw new Error(`缺口：--required 值缺 =：${value}`);
    const name = value.slice(0, eq);
    if (name === "") throw new Error("缺口：--required 名为空");
    entries[name] = value.slice(eq + 1);
  }
  return { entries, rest };
}

// 所需版本合并（纯函数）：回传并入后的新对象，entries 同名键覆盖 base；两参缺省按空对象处理
function mergeRequired(base, entries) {
  return Object.assign({}, base || {}, entries || {});
}

// 记录中所需版本读取（纯函数）：回传 record.required[language]，无则 undefined
function declaredRequired(record, language) {
  const required = record && record.required;
  if (!required || typeof required !== "object") return undefined;
  return required[language];
}

// 框架可用性（纯函数）：记录中 frameworks 键下同名项须存在且 available；三态中的「未安装但可装」不得据此判为可用（设计册第十节其一）
function frameworkAvailable(record, name) {
  const row = record.frameworks && record.frameworks[name];
  return Boolean(row && row.available);
}

// 运行器可用性（纯函数）：when.runner 指名的形态须在工具、框架、语言、语言形态四处任一处可用——
// 故 bats、pwsh、npx 可作条件，java 的 mvn 亦可作条件：语言形态表本就声明该形态须待 maven 就位才成立（设计册第十节其二对「调用形态可用」的定义）
function runnerAvailable(record, name) {
  const inPool = [record.tools, record.frameworks, record.languages]
    .some((pool) => Boolean(pool && pool[name] && pool[name].available));
  if (inPool) return true;
  return Object.values(record.languages || {})
    .some((form) => Boolean(form && form.available && form.runner === name));
}

// 候选命中（纯函数）：when 内的 framework 与 runner 均须成立，未给者不设该条件；when 整体缺省即恒成立
function candidateMatches(candidate, record) {
  const when = (candidate && candidate.when) || {};
  if (when.framework && !frameworkAvailable(record, when.framework)) return false;
  if (when.runner && !runnerAvailable(record, when.runner)) return false;
  return true;
}

// 候选所用运行器（纯函数）：when.runner 指名者即替代记录中的语言形态，使同一语言可按框架取不同调用前缀（如 jest 经 npx、node:test 经 node）；未指名者用语言形态
function candidateRunner(candidate, language, record) {
  const when = (candidate && candidate.when) || {};
  if (when.runner) return when.runner;
  const form = record && record.languages ? record.languages[language] : null;
  return form && form.runner;
}

// 缺口描述（纯函数）：列出候选所引用而记录中不可用的框架名，供缺口信息指明缺哪类框架
function missingFrameworks(candidates, record) {
  const names = [...new Set(candidates.map((candidate) => candidate.when && candidate.when.framework).filter(Boolean))];
  const missing = names.filter((name) => !frameworkAvailable(record, name));
  return missing.length ? `缺 ${missing.join("、")}` : "候选条件均不成立";
}

// 候选集组装（纯函数）：按优先级取首个命中候选，以候选运行器替换 {runner} 后经版本前缀拼合；
// 入参 required 为空时回退取记录中的声明值，使记录里的 required 有代码消费方；
// 无一命中即报缺口并指明缺哪类框架，绝不回落写死的默认框架（设计册第十节其三）
function buildFromCandidates(candidates, language, required, record) {
  const effectiveRequired = required || declaredRequired(record, language);
  const form = record && record.languages ? record.languages[language] : null;
  if (!form || !form.available || !form.runner) throw new Error(`缺口：语言 ${language} 无可用形态，无法组装命令`);
  const matched = candidates.find((candidate) => candidateMatches(candidate, record));
  if (!matched) throw new Error(`缺口：语言 ${language} 缺少可用的测试框架（${missingFrameworks(candidates, record)}）`);
  const runner = versionAdjustedRunner(language, effectiveRequired, candidateRunner(matched, language, record), record);
  return composeCommand(matched.template, runner);
}

// 命令组装（纯函数，对外接口）：入参候选集或单件模板、语言与所需版本，出可执行命令；
// 入参 required 为空时回退取记录中的声明值；候选集走 buildFromCandidates，单件模板走旧路径——两级解析先版本前缀再与环境形态拼合；语言无可用形态、占位符残留均抛错
function buildCommand({ template, candidates, language, required }, record) {
  const effectiveRequired = required || declaredRequired(record, language);
  if (candidates) return buildFromCandidates(candidates, language, effectiveRequired, record);
  const form = record && record.languages ? record.languages[language] : null;
  if (!form || !form.available || !form.runner) throw new Error(`缺口：语言 ${language} 无可用形态，无法组装命令`);
  const runner = versionAdjustedRunner(language, effectiveRequired, form.runner, record);
  return composeCommand(template, runner);
}

module.exports = {
  COMMAND_GROUPS,
  LANGUAGE_RUNTIMES,
  parseVersionList,
  collectManagers,
  enrichTools,
  versionCheckDowngrades,
  PROVIDER_LANGUAGES,
  composeCommand,
  parseRequiredArgs,
  mergeRequired,
  declaredRequired,
  buildCommand,
};
