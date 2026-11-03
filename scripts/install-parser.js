#!/usr/bin/env node
/**
 * 目标：把签名级符合性校验所需的解析器与 grammar 按需安装到用户固定位置（~/.pi/agent/ddd-parser/），
 *   作为仅用户触发的部署辅助入口，与模型配比命令同性质，不进入被开发项目的流程。
 * 范围：打印安装计划、把锁定版本的包与 grammar 装到固定位置、保证解析器锚点 package.json 存在。
 * 不包含：解析器供给与缺失信号（见 lib/span-parser.js）、语法提取与三态比对（见 span-check.js）、命令装配（见扩展 ddd-tools.ts）。
 * 版本单一权威：本脚本不含任何版本号，一律读 lib/span-parser.js 的 LOCKED_VERSIONS，与缺失时的安装指引同源，不另写一份。
 * 触发方式：仅由扩展的 /ddd-parser-install 命令以 --install 调用；不带 --install 时只打印计划，供人工查看与工具链自测安全自动运行，不触盘。
 * 用法：node install-parser.js [--install] [--home <位置>]
 * 输出形态：文本正文；末行机读结论 `RESULT: installed` 或 `RESULT: failed`（仅 --install 时输出）。
 * 退出码：0 打印计划成功或安装成功，1 安装失败。
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { LOCKED_VERSIONS, GRAMMAR_WASM, parserHome } = require("./lib/span-parser.js");

const PARSER_HOME_FLAG = "--home";
const argv = process.argv.slice(2);
const install = argv.includes("--install");
const homeFlag = argv.indexOf(PARSER_HOME_FLAG);
const home = homeFlag >= 0 && argv[homeFlag + 1] ? path.resolve(argv[homeFlag + 1]) : parserHome();

// 锁定包清单：由 LOCKED_VERSIONS 派生，本脚本不出现任何版本字面量
const packages = () => Object.entries(LOCKED_VERSIONS).map(([name, version]) => `${name}@${version}`);

// 安装计划：包与位置在执行前展示，位置解析与解析器供给同一来源
function planLines(target) {
  return [
    "=== 解析器安装计划（签名级符合性校验的按需依赖） ===",
    `安装位置：${target}`,
    `将安装 ${packages().length} 个锁定版本的包：`,
    ...packages().map((pkg) => `  - ${pkg}`),
    `随附 grammar：${Object.keys(GRAMMAR_WASM).join("、")}`,
    "说明：解析器须装在本仓库之外的用户固定位置，否则会被 pi 的 git clean 清除。",
  ];
}

// 解析器加载以该位置的 package.json 为锚，缺锚则补一个最小私有清单，使裸模块名可从该位置解析
function ensureAnchor(target) {
  const anchor = path.join(target, "package.json");
  if (!fs.existsSync(anchor)) fs.writeFileSync(anchor, JSON.stringify({ name: "ddd-parser", private: true }, null, 2) + "\n");
}

function run() {
  process.stdout.write(planLines(home).join("\n") + "\n");
  if (!install) return 0; // 计划模式：只展示，不触盘
  try {
    fs.mkdirSync(home, { recursive: true });
    ensureAnchor(home);
  } catch (error) {
    process.stdout.write(`安装失败：无法创建安装位置 ${home}（${error.message}）\nRESULT: failed\n`);
    return 1;
  }
  const result = spawnSync("npm", ["install", ...packages()], { cwd: home, stdio: "inherit" });
  if (result.error) {
    process.stdout.write(`安装失败：无法执行 npm（${result.error.message}）\nRESULT: failed\n`);
    return 1;
  }
  if (result.status !== 0) {
    process.stdout.write(`安装失败：npm 退出码 ${result.status}\nRESULT: failed\n`);
    return 1;
  }
  process.stdout.write(`安装完成：解析器与 grammar 已装到 ${home}\nRESULT: installed\n`);
  return 0;
}

process.exit(run());
