/**
 * 设计文档树根路径解析的唯一实现，供 trace-check.js 与 governance-check.js 共用。
 *
 * 口径权威在 skill/ddd-methodology/references/spec.md §2 的 G3 退出条件与 templates 的 ARCHITECTURE 节：
 * 优先读 ARCHITECTURE.md 的根路径声明，读不到回退 docs/design 并由调用方告警。
 * 不包含：DESIGN 文件遍历与内容校验。
 */

const fs = require("fs");
const path = require("path");

function resolveDesignRoot(projectRoot) {
  const archPath = path.join(projectRoot, "ARCHITECTURE.md");
  const arch = fs.existsSync(archPath) ? fs.readFileSync(archPath, "utf8") : "";
  let m = arch.match(/设计文档树根路径为[：:]*\s*`([^`]+)`/);
  if (!m) m = arch.match(/设计文档树根路径为[：:]*\s*([^\n\s。]+)/);
  if (m) return { dir: m[1].trim(), declared: true };
  return { dir: "docs/design", declared: false };
}

function absoluteDesignDir(projectRoot) {
  const info = resolveDesignRoot(projectRoot);
  const dir = path.isAbsolute(info.dir) ? info.dir : path.join(projectRoot, info.dir);
  return { ...info, dir };
}

module.exports = { absoluteDesignDir };
