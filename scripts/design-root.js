/**
 * 设计文档树根路径解析的唯一实现，供 trace-check.js、governance-check.js、code-health.js 与运行时守卫共用；缺省回退 docs/design，声明的根路径优先。
 *
 * 口径权威在规范「质量门禁」节的 G3 退出条件与 templates 的 ARCHITECTURE 节：
 * 优先读 ARCHITECTURE.md 的根路径声明，读不到回退 docs/design 并由调用方告警。
 * 文本读取取同层共享的 ./lib/text.js 的 readFileText，读取失败回空串，本脚本不内联读取实现。
 * 不包含：DESIGN 文件遍历与内容校验。
 */

const path = require("path");
const { readFileText } = require("./lib/text.js");

function resolveDesignRoot(projectRoot) {
  const archPath = path.join(projectRoot, "ARCHITECTURE.md");
  const arch = readFileText(archPath);
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
