/**
 * 目标：为工具与测试框架的可执行文件解析提供四级优先链——项目内部、当前环境、默认安装位置、包管理器位置，命中即停并给出来源级别，
 *   使记录能回答「取到的是哪一处、为何是这一版本」，而不是只报一个绝对路径（见 DESIGN-environment.md 第十二节）。
 * 范围：四级来源取值表（SOURCE_LEVELS 为 source 值域的唯一权威）、各级查找位置表（项目内部子路径、系统默认目录、包管理器安装根，Windows 与类 Unix 两类分列）、
 *   brew Cellar 的 formula/version/bin 展开、resolveExecutablePath 目录级原语与 resolveWithSource 四级解析。
 * 不包含：进程调用与文件读写——位置表所依赖的项目根、PATH 目录、平台扩展名、目录列举与文件判定均由调用方经 ctx 注入；
 *   工具与测试框架清单、版本查询、记录装配、命令行入口亦不在本模块。不引入第三方依赖。
 * 边界：某一级缺席或不可读只降级往下一级查，不报缺陷；四级均不命中记不可用，不猜测也不回退上一级；解析不依赖调用时序，同一 ctx 下结果只由文件系统事实决定。
 * 依据：DESIGN-environment.md 第十二节的位置表与三条细则，该链同时适用于工具与测试框架两类探测。
 * 消费方：lib/env-probe.js 的逐命令探测、lib/env-command.js 的管理器检测、lib/ref-env.js 的来源级别判据。
 */

const path = require("node:path");

// 四级来源：数组顺序即优先序，取值即记录中 source 的合法值域，声明处只此一处
const SOURCE_LEVELS = ["project", "path", "default", "package-manager"];

// 项目内部：项目根下依赖自带可执行文件的目录。置顶的理由是项目自带的版本才是该项目应使用的版本，全局版本可能与之不兼容
const PROJECT_SUBDIRS = [
  ["node_modules", ".bin"],
  [".venv", "bin"],
  ["venv", "bin"],
];

// 默认安装位置：操作系统的常规可执行目录。按平台分列，免得把另一平台的路径当成本机候选
const DEFAULT_DIRS_POSIX = ["/usr/local/bin", "/usr/bin", "/bin"];
const DEFAULT_DIRS_WIN32 = [["System32"]];

// 包管理器位置：brew 的可执行入口、apt 的 /usr/bin；其中 /usr/bin 与第三级重合，第三级先命中，此处列出以与设计册的位置表逐条对应
const PACKAGE_MANAGER_DIRS_POSIX = ["/opt/homebrew/bin", "/usr/bin"];
// brew Cellar 下按 <formula>/<version>/bin 三级存放，当作扁平目录试探必然落空，故列为待展开的安装根
const CELLAR_ROOTS = ["/opt/homebrew/Cellar", "/usr/local/Cellar", "/home/linuxbrew/.linuxbrew/Cellar"];

// 环境变量取值：Windows 上同名变量大小写不一，按候选名逐个兜底；全无回空串
function envValue(ctx, names) {
  const env = ctx.env || {};
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

// 项目内部目录：项目根未注入时该级为空清单，解析自然降级，不报缺陷
function projectDirs(ctx) {
  if (!ctx.root) return [];
  return PROJECT_SUBDIRS.map((parts) => path.join(ctx.root, ...parts));
}

// 默认安装位置：Windows 取系统根下的系统目录，其余平台取固定目录表；系统根不可得时该级为空清单
function defaultDirs(ctx) {
  if (ctx.platform !== "win32") return DEFAULT_DIRS_POSIX;
  const systemRoot = envValue(ctx, ["SystemRoot", "windir"]);
  return systemRoot ? DEFAULT_DIRS_WIN32.map((parts) => path.join(systemRoot, ...parts)) : [];
}

// 目录列举：未注入列举原语或不可读一律回空清单，解析不因单个安装根缺席而中断
function readDirNames(ctx, dir) {
  if (typeof ctx.listDir !== "function") return [];
  try {
    const names = ctx.listDir(dir);
    return Array.isArray(names) ? names : [];
  } catch (e) { return []; }
}

// Cellar 展开：逐公式取版本目录，拼出其 bin 目录；清单不可得即回空，该安装根自然跳过
function cellarBins(ctx) {
  const out = [];
  for (const cellar of CELLAR_ROOTS) {
    for (const formula of readDirNames(ctx, cellar)) {
      const formulaDir = path.join(cellar, formula);
      for (const version of readDirNames(ctx, formulaDir)) out.push(path.join(formulaDir, version, "bin"));
    }
  }
  return out;
}

// 包管理器安装根：scoop 取 SCOOP 声明的根或用户目录下的 scoop，其余平台取 brew 入口与已展开的 Cellar
function packageManagerDirs(ctx) {
  if (ctx.platform !== "win32") return [...PACKAGE_MANAGER_DIRS_POSIX, ...cellarBins(ctx)];
  const userProfile = envValue(ctx, ["USERPROFILE", "HOME"]);
  const roots = [envValue(ctx, ["SCOOP"]), userProfile ? path.join(userProfile, "scoop") : ""].filter(Boolean);
  return [...new Set(roots)].map((root) => path.join(root, "shims"));
}

// 四级查找位置（纯函数）：逐级给出来源级别与目录清单；空清单即该级在本机不存在，交由解析降级
function lookupGroups(ctx) {
  return [
    { source: SOURCE_LEVELS[0], dirs: projectDirs(ctx) },
    { source: SOURCE_LEVELS[1], dirs: ctx.pathDirs || [] },
    { source: SOURCE_LEVELS[2], dirs: defaultDirs(ctx) },
    { source: SOURCE_LEVELS[3], dirs: packageManagerDirs(ctx) },
  ];
}

// 目录级解析：在给定目录与平台扩展名两层组合下逐条试探，命中可执行文件即回绝对路径，全无回 null
function resolveExecutablePath(command, dirs, exts, isFile) {
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, `${command}${ext}`);
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
}

// 四级解析（对外接口）：按优先链逐级试探，命中即停并连同来源级别回传；四级均不命中回 path 与 source 皆为 null
function resolveWithSource(command, ctx) {
  for (const group of lookupGroups(ctx)) {
    const hit = resolveExecutablePath(command, group.dirs, ctx.exts, ctx.isFile);
    if (hit) return { path: hit, source: group.source };
  }
  return { path: null, source: null };
}

module.exports = {
  SOURCE_LEVELS,
  resolveExecutablePath,
  resolveWithSource,
};
