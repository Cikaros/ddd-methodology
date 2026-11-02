/**
 * 目标：把 README 的安装参数表与安装脚本实际识别的参数外化为机械可判的一致性，消除参数表遗漏受支持参数的盲区。
 * 范围：C18 一项——解析 README 安装参数表的参数名集合与 install.sh、install.bat 实际识别的参数名集合，
 *   校验安装脚本支持的每个参数都在参数表中出现。参数表另列 apply-models 的 `--repo`，属参数表覆盖面更宽者，
 *   且该参数不由安装脚本解析，故只作「脚本参数须见于表」的单向断言，不反向要求表内每项都属安装脚本参数。
 * 不包含：参数取值语义、apply-models.js 自身参数、其他校验项、命令行入口。不引入第三方依赖。
 */

const path = require("path");
const { readFileText, drift } = require("./text.js");

const README_REL = "README.md";
const INSTALL_SCRIPT_RELS = ["scripts/install.sh", "scripts/install.bat"];
const PARAM_RE = /--[a-z][a-z0-9-]*/g;

// README 参数表：取「安装参数如下」行之后首张表的首列，取反引号参数名的首个 token
function readTableParams(text) {
  const lines = text.split("\n");
  const marker = lines.findIndex((line) => line.includes("安装参数如下"));
  if (marker < 0) return null;
  const params = new Set();
  let started = false;
  for (let i = marker + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) { if (started) break; continue; }
    started = true;
    const cell = line.split("|")[1] || "";
    const m = cell.match(PARAM_RE);
    if (m) params.add(m[0]);
  }
  return params;
}

// 安装脚本参数：shell 取 case 分支标签形态，batch 取 %~1 比较形态，二者都为脚本实际识别的命令行参数
function readScriptParams(text, isBatch) {
  const params = new Set();
  const re = isBatch ? /"%~1"=="(--[a-z][a-z0-9-]*)"/g : /^\s*(--[a-z][a-z0-9-]*)\)/gm;
  for (const m of text.matchAll(re)) params.add(m[1]);
  return params;
}

function createInstallParamChecks(env) {
  const { root } = env;

  function checkInstallParams() {
    const found = [];
    const readme = readFileText(path.join(root, README_REL));
    if (!readme) {
      found.push(drift("C18", README_REL, 0, "README 须存在且可读", `${README_REL} 可读`));
      return found;
    }
    const table = readTableParams(readme);
    if (!table || !table.size) {
      found.push(drift("C18", README_REL, 0, "README 须含安装参数表", "含安装参数表", "未解析到"));
      return found;
    }
    for (const rel of INSTALL_SCRIPT_RELS) {
      const text = readFileText(path.join(root, ...rel.split("/")));
      if (!text) {
        found.push(drift("C18", rel, 0, "安装脚本须存在且可读", `${rel} 可读`));
        continue;
      }
      const supported = readScriptParams(text, rel.endsWith(".bat"));
      if (!supported.size) {
        found.push(drift("C18", rel, 0, "安装脚本须识别命令行参数", "至少一个参数", "未解析到"));
        continue;
      }
      for (const param of supported) {
        if (!table.has(param)) found.push(drift("C18", README_REL, 0, "安装脚本支持的参数须在安装参数表中列出", `参数表含 ${param}`, param));
      }
    }
    return found;
  }

  return { checkInstallParams };
}

module.exports = { createInstallParamChecks };
