/**
 * 目标：签名级符合性校验的解析器按需供给——把 web-tree-sitter 运行时与六种语言 grammar wasm 的定位、可用性探测与懒加载
 *   收敛为唯一实现，供 span-extract 复用。
 * 范围：解析器固定位置解析、按语言的 grammar 映射、解析器构造与缓存、缺失信号与安装指引。
 * 不包含：符号提取规则（见 span-langs.js 与 span-extract.js）、契约表读取与比对（见 span-compare.js）、命令行入口。除解析器自身外不引入第三方依赖。
 * 位置：用户固定位置 `~/.pi/agent/ddd-parser/`，而非本仓库 clone 目录内。原因：pi 更新 git 来源包时执行 `git clean -fdx`，
 *   会清掉 clone 目录下的未跟踪文件；解析器依赖若装在那里，每次 `pi update --extensions` 都会被清掉而不可用。
 * 隔离：本模块只从该固定位置解析，不依赖 clone 目录的 node_modules；解析器也不得写入 package.json 的 dependencies 或 peerDependencies。
 * 覆盖：环境变量 DDD_PARSER_HOME 可覆盖该位置，用于校验缺失路径而不触碰真实安装。
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { createRequire } = require("module");

// 六种语言的 grammar：一律取各 grammar 包自带的 wasm，不用聚合包（实测聚合包与 web-tree-sitter@0.27.1 的 ABI 不匹配）
const GRAMMAR_WASM = {
  typescript: "tree-sitter-typescript/tree-sitter-typescript.wasm",
  javascript: "tree-sitter-javascript/tree-sitter-javascript.wasm",
  python: "tree-sitter-python/tree-sitter-python.wasm",
  java: "tree-sitter-java/tree-sitter-java.wasm",
  go: "tree-sitter-go/tree-sitter-go.wasm",
  rust: "tree-sitter-rust/tree-sitter-rust.wasm",
};
// 与 grammar 成套锁定的版本：运行时与 grammar 不可混用不同代的版本，故在此登记且与安装指引同源
const LOCKED_VERSIONS = {
  "web-tree-sitter": "0.27.1",
  "tree-sitter-typescript": "0.23.2",
  "tree-sitter-javascript": "0.25.0",
  "tree-sitter-python": "0.25.0",
  "tree-sitter-java": "0.23.5",
  "tree-sitter-go": "0.25.0",
  "tree-sitter-rust": "0.24.0",
};

const DEFAULT_HOME = path.join(os.homedir(), ".pi", "agent", "ddd-parser");

function parserHome() {
  return process.env.DDD_PARSER_HOME || DEFAULT_HOME;
}

// 缺失信号：带上机器可辨的 code，使提取器只按 code 判「解析器未安装」，不解析错误文案
function unavailable(reason) {
  const error = new Error(reason);
  error.code = "PARSER_UNAVAILABLE";
  return error;
}

// 安装指引：把锁定版本拼成可直接执行的命令；解析器住 clone 目录之外的缘由随文本一并给出
function installGuidance() {
  const deps = Object.entries(LOCKED_VERSIONS).map(([name, version]) => `${name}@${version}`).join(" ");
  return [
    "无法判定：解析器未安装",
    `安装指引：把解析器与 grammar 装到固定位置（勿装入本仓库，否则会被 pi 的 git clean 清除）：`,
    `  mkdir -p ${DEFAULT_HOME} && cd ${DEFAULT_HOME}`,
    `  npm install ${deps}`,
  ].join("\n");
}

// 解析器供给：初始化一次、每语言 grammar 载入一次、每语言解析器一件，均在进程内缓存
function createParserProvider() {
  let runtimePromise = null;
  const languagePromises = new Map();
  const parsers = new Map();

  // 运行时载入：以固定位置的 package.json 为锚解析裸模块名，使 web-tree-sitter 只从该位置解析
  function loadRuntime() {
    if (!runtimePromise) {
      runtimePromise = (async () => {
        const home = parserHome();
        const anchor = path.join(home, "package.json");
        if (!fs.existsSync(anchor)) throw unavailable(`${home} 缺 web-tree-sitter`);
        let mod;
        try {
          mod = createRequire(anchor)("web-tree-sitter");
        } catch (e) {
          throw unavailable(`${home} 缺 web-tree-sitter`);
        }
        await mod.Parser.init();
        return mod;
      })();
    }
    return runtimePromise;
  }

  function loadLanguage(language) {
    if (!languagePromises.has(language)) {
      languagePromises.set(language, (async () => {
        const wasmRel = GRAMMAR_WASM[language];
        if (!wasmRel) {
          const error = new Error(`未挂载 grammar 的语言：${language}`);
          error.code = "LANGUAGE_UNSUPPORTED";
          throw error;
        }
        const mod = await loadRuntime();
        const wasmPath = path.join(parserHome(), "node_modules", wasmRel);
        if (!fs.existsSync(wasmPath)) throw unavailable(`${parserHome()} 缺 grammar ${wasmRel}`);
        return mod.Language.load(wasmPath);
      })());
    }
    return languagePromises.get(language);
  }

  // 解析入口：返回 Tree，调用方据 rootNode 判定语法错误与提取符号
  async function parse(source, language) {
    if (!parsers.has(language)) {
      const language_ = await loadLanguage(language);
      const mod = await loadRuntime();
      const parser = new mod.Parser();
      parser.setLanguage(language_);
      parsers.set(language, parser);
    }
    return parsers.get(language).parse(String(source));
  }

  return { parse };
}

module.exports = { createParserProvider, installGuidance, parserHome, GRAMMAR_WASM, LOCKED_VERSIONS };
