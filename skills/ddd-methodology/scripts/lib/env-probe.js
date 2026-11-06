/**
 * 目标：为环境探测提供无副作用的核心——把「逐命令的探测结果清单」归一为工具事实，再由工具事实按优先级推导各语言的可用命令形态；
 *   记录结构固定为 probedAt、tools、languages 三键（见 DESIGN-environment.md 第三节），供 scripts/env-probe.js 装配落盘，并供单测直接调用；工具六键里的管理器三键与命令组装另由同目录 env-command.js 承接。
 * 范围：四类工具清单常量、版本查询参数表、语言形态优先级表、路径解析与版本串抽取两原语，以及 probeCommand、probeAll、buildTools、deriveLanguages、buildEnvRecord 五个函数。
 * 不包含：进程调用与文件读写——由 scripts/env-probe.js 注入 isFile 与 runVersion 两类副作用原语；版本管理器与命令组装见 lib/env-command.js；亦不含记录落盘、目录遍历与命令行入口。不引入第三方依赖。
 * 边界：探测只查本机 PATH 与命令输出，不访问网络；某项缺失不报缺陷，只记 available 为 false。
 * 消费方：scripts/env-probe.js 的装配处；语言形态优先级表的最终判据归语言技能，本版为缺省序。
 */

const path = require("node:path");

// 四类工具（设计册第二节）：运行时、包与版本管理、语言工具、外壳；数组顺序即探测与记录顺序
const TOOL_GROUPS = {
  runtime: ["node", "bun", "deno", "python", "python3", "java", "go", "rustc"],
  packageManager: ["npm", "pnpm", "yarn", "npx", "uv", "pip", "pip3", "poetry", "maven", "gradle", "cargo"],
  languageTool: ["pytest", "ruff", "mypy", "eslint", "tsc", "shellcheck", "PSScriptAnalyzer", "markdownlint"],
  shell: ["bash", "zsh", "pwsh", "cmd"],
};

const ALL_COMMANDS = Object.values(TOOL_GROUPS).flat();

// 版本查询参数：缺省 --version，特殊形态按工具覆盖；PSScriptAnalyzer 为 PowerShell 模块，其参数交 pwsh 执行
const DEFAULT_VERSION_ARGS = ["--version"];
const VERSION_ARGS = {
  java: ["-version"],
  go: ["version"],
  maven: ["-v"],
  gradle: ["-v"],
  cmd: ["/c", "ver"],
  PSScriptAnalyzer: ["-NoProfile", "-Command", "Get-Module -ListAvailable PSScriptAnalyzer | Select-Object -First 1 -ExpandProperty Version"],
};

// 经 pwsh 承载的工具：自身无独立可执行文件，先解析 pwsh 再查模块，查不到版本即记不可用
const PWSH_HOSTED = new Set(["PSScriptAnalyzer"]);

// 语言形态优先级表：每语言按优先级降序列候选，取首个所需工具全可用的候选；表内工具名须为 TOOL_GROUPS 内命令名
const LANGUAGE_FORMS = {
  javascript: [
    { when: ["bun"], runner: "bun", test: "bun test" },
    { when: ["node"], runner: "node", test: "node --test" },
  ],
  typescript: [
    { when: ["bun"], runner: "bun", test: "bun test" },
    { when: ["tsc", "node"], runner: "node", test: "node --test" },
  ],
  python: [
    { when: ["uv"], runner: "uv run python", test: "uv run pytest" },
    { when: ["python3", "pytest"], runner: "python3", test: "pytest" },
    { when: ["python", "pytest"], runner: "python", test: "pytest" },
    { when: ["python3"], runner: "python3", test: "python3 -m pytest" },
    { when: ["python"], runner: "python", test: "python -m pytest" },
  ],
  java: [
    { when: ["maven"], runner: "mvn", test: "mvn test" },
    { when: ["gradle"], runner: "gradle", test: "gradle test" },
  ],
  go: [{ when: ["go"], runner: "go", test: "go test ./..." }],
  rust: [{ when: ["cargo"], runner: "cargo", test: "cargo test" }],
};

// 路径解析：在 PATH 目录与平台扩展名两层组合下逐条试探，命中可执行文件即回绝对路径，全无回 null
function resolveExecutablePath(command, pathDirs, exts, isFile) {
  for (const dir of pathDirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, `${command}${ext}`);
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
}

// 版本串抽取：取输出中首个 x.y[.z…] 形态的版本号，抹平各工具版本格式差异；无版本号时回清理后的首行，全空回 null
function parseVersionOutput(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return null;
  const matched = text.match(/\d+(?:\.\d+)+/);
  return matched ? matched[0] : text.split(/\r?\n/)[0].trim() || null;
}

// 单命令探测：先解析绝对路径，命中后按版本参数取版本；经 pwsh 承载者须确得模块版本才算可用
function probeCommand(name, ctx) {
  const target = PWSH_HOSTED.has(name) ? "pwsh" : name;
  const resolved = resolveExecutablePath(target, ctx.pathDirs, ctx.exts, ctx.isFile);
  if (!resolved) return { name, path: null, version: null };
  const version = parseVersionOutput(ctx.runVersion(name, resolved));
  if (PWSH_HOSTED.has(name) && !version) return { name, path: null, version: null };
  return { name, path: resolved, version };
}

// 全量探测：按给定命令清单顺序逐条探测，回传结果清单，供 buildTools 消费
function probeAll(ctx, commands = ALL_COMMANDS) {
  return commands.map((name) => probeCommand(name, ctx));
}

// 工具事实（纯函数）：以命令名为键，逐项记 path、version、available；未解析到路径者一律记不可用且路径与版本留空
function buildTools(results) {
  const tools = {};
  for (const result of results) {
    const available = Boolean(result.path);
    tools[result.name] = {
      path: result.path || null,
      version: available ? result.version || null : null,
      available,
    };
  }
  return tools;
}

// 语言形态（纯函数）：按优先级表取首个所需工具全可用的候选，无可用候选即记 available 为 false
function deriveLanguages(tools) {
  const languages = {};
  for (const [language, forms] of Object.entries(LANGUAGE_FORMS)) {
    const picked = forms.find((form) => form.when.every((tool) => tools[tool] && tools[tool].available));
    languages[language] = picked
      ? { runner: picked.runner, test: picked.test, available: true }
      : { runner: null, test: null, available: false };
  }
  return languages;
}

// 记录装配（纯函数）：三键缺一不可，tools 与 languages 由前两步的推导结果注入；required 仅在项目声明所需版本时并入
function buildEnvRecord({ probedAt, tools, languages, required }) {
  const record = { probedAt, tools, languages };
  if (required) record.required = required;
  return record;
}

module.exports = {
  TOOL_GROUPS,
  ALL_COMMANDS,
  DEFAULT_VERSION_ARGS,
  VERSION_ARGS,
  PWSH_HOSTED,
  LANGUAGE_FORMS,
  resolveExecutablePath,
  parseVersionOutput,
  probeCommand,
  probeAll,
  buildTools,
  deriveLanguages,
  buildEnvRecord,
};
