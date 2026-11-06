/**
 * 目标：把「工作区行尾盲区」外化为可复现的机械证据——按仓库行尾属性声明双向核对工作区文件的实际行尾。
 * 范围：C16 工作区行尾一致性——期望行尾集合取自仓库根的 .gitattributes，逐条解析其 eol= 声明并按模式解析每个文件的期望行尾；
 *   声明为 CRLF 的文件其工作区行尾须全为 CRLF，检出裸 LF 即判漂移；
 *   声明为 LF 的文件其工作区不得含回车，检出回车即判漂移。
 *   双向判据覆盖「工具写入的行尾与工作区/属性声明不一致」的两种形态，即写入 LF 而声明 CRLF、写入 CRLF 而声明 LF，二者版本控制状态都可能仍显示干净。
 * 不包含：索引内容比对（索引行尾由 git 核心属性与 core.autocrlf 管辖）、二进制文件、其他校验项、命令行入口。不引入第三方依赖。
 * 权威来源：期望行尾一律由 .gitattributes 解析得到，本模块不另写文件名单。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./text.js");
const { walk } = require("./walk.js");

const GITATTRIBUTES_REL = ".gitattributes";
// 工作区行尾核对只跳过依赖目录；点开头条目由 walk 统一跳过，docs 等工作区内容照查
const EOL_SKIP_DIR_NAMES = new Set(["node_modules"]);

// 解析 .gitattributes 的 eol 声明：回传 pattern 到 eol 的规则序列，文件内顺序即优先级，后声明覆盖先声明
function parseEolRules(text) {
  const rules = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    const pattern = parts[0];
    let eol = null;
    for (const attr of parts.slice(1)) {
      if (attr === "eol=crlf") eol = "crlf";
      else if (attr === "eol=lf") eol = "lf";
    }
    if (eol) rules.push({ pattern, eol });
  }
  return rules;
}

// 模式匹配：无斜杠的模式按文件基名匹配任意层级，含斜杠的模式按仓库相对路径匹配
function matchesPattern(pattern, relPath) {
  if (pattern.includes("/")) {
    const anchored = pattern.replace(/^\//, "");
    if (anchored.endsWith("/*")) return relPath.startsWith(anchored.slice(0, -1));
    return relPath === anchored;
  }
  const base = relPath.split("/").pop();
  if (pattern === "*") return true;
  if (pattern.startsWith("*.")) return base.endsWith(pattern.slice(1));
  return base === pattern;
}

// 期望行尾：按规则顺序取最后一条命中，无命中回传 null，表示该文件不受行尾属性管辖
function expectedEol(rules, relPath) {
  let eol = null;
  for (const rule of rules) if (matchesPattern(rule.pattern, relPath)) eol = rule.eol;
  return eol;
}

// 二进制判定：前若干字节含 NUL 即视为二进制，行尾属性不适用于此类文件
function looksBinary(buf) {
  const end = Math.min(buf.length, 8000);
  for (let i = 0; i < end; i++) if (buf[i] === 0) return true;
  return false;
}

// 首处裸 LF 的字符下标：\n 前非 \r 即裸 LF；回传 -1 表示全部行尾均为 CRLF
function firstBareLfIndex(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n" && (i === 0 || text[i - 1] !== "\r")) return i;
  }
  return -1;
}

// 首个回车的字符下标：回传 -1 表示不含回车，供声明为 LF 的文件判定工作区是否残留 CRLF
function firstCrIndex(text) {
  return text.indexOf("\r");
}

function createLineEndingChecks(env) {
  const { root, relPath } = env;

  function checkLineEndings() {
    const found = [];
    const attrPath = path.join(root, GITATTRIBUTES_REL);
    if (!fs.existsSync(attrPath)) {
      found.push(drift("C16", GITATTRIBUTES_REL, 0, "行尾属性的权威来源须存在，判定工作区行尾方有依据", `${GITATTRIBUTES_REL} 存在`, "未找到"));
      return found;
    }
    const rules = parseEolRules(readFileText(attrPath));
    if (!rules.length) {
      found.push(drift("C16", GITATTRIBUTES_REL, 0, "行尾属性须声明期望行尾，否则工作区行尾无从判定", "至少一条 eol= 声明", "未解析到"));
      return found;
    }
    for (const file of walk(root, EOL_SKIP_DIR_NAMES)) {
      const rel = relPath(file);
      const eol = expectedEol(rules, rel);
      if (eol !== "crlf" && eol !== "lf") continue;
      let buf;
      try { buf = fs.readFileSync(file); } catch (e) { continue; }
      if (!buf.length || looksBinary(buf)) continue;
      const text = buf.toString("utf8");
      // 声明为 CRLF：任一裸 LF 即漂移；声明为 LF：任一回车即漂移
      if (eol === "crlf") {
        const bareIndex = firstBareLfIndex(text);
        if (bareIndex < 0) continue;
        const line = text.slice(0, bareIndex).split("\n").length;
        found.push(drift("C16", rel, line, "行尾属性声明为 CRLF 的文件，工作区行尾须为 CRLF", "全部行尾为 CRLF", "检出裸 LF"));
      } else {
        const crIndex = firstCrIndex(text);
        if (crIndex < 0) continue;
        const line = text.slice(0, crIndex).split("\n").length;
        found.push(drift("C16", rel, line, "行尾属性声明为 LF 的文件，工作区不得含回车", "不含回车", "检出回车"));
      }
    }
    return found;
  }

  return { checkLineEndings };
}

// 注册表契约：id、简名与所属域随本模块声明；run 只转接本模块工厂的对应判据，装配处不掌握判据内容
module.exports = {
  contracts: [{ id: "C16", name: "工作区行尾一致性", domain: "line-endings", run: (ctx) => createLineEndingChecks(ctx).checkLineEndings() }],
};
