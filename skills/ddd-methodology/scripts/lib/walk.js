/**
 * 目标：脚本共享层的目录遍历，供 code-health、governance-check、trace-check 复用。
 * 范围：单一深度优先遍历函数——跳过点开头条目与调用方给定的排除目录名，回传文件绝对路径清单。
 *   调用方可选地传入收集器，用于接收不可读目录与文件的路径，供其产出扫描面告警；不传时不可读条目静默跳过。
 *   排除集随树的性质而变：源码树与设计/测试树口径不同（见下方两个 Set），故由调用方传入，默认沿用源码树口径。
 * 不包含：扩展名过滤、文本读取、语义判断、命令行入口；筛选由调用方按回传清单自理。不引入第三方依赖。
 */

const fs = require("fs");
const path = require("path");

// 源码树与活文档树的排除集：取自 code-health 的 SKIP_DIRS。docs 是项目侧证据与历史归档，不入源码度量。
const SOURCE_TREE_SKIP_DIR_NAMES = new Set(["node_modules", "dist", "build", "out", "target", "vendor", "__pycache__", "coverage", "docs"]);

// 设计树与测试树的排除集：两树本身就是待校验对象，不得沿用源码树的「目录名」排除，
// 否则 docs/design 下名为 build/dist 等的子目录会被静默跳过，导致 DESIGN 漏检与门禁假通过。
// 只保留与目录语义无关的依赖目录；点开头条目另由前缀判据统一跳过。
const DOC_TREE_SKIP_DIR_NAMES = new Set(["node_modules"]);

// 可读性探测：仅收集器在场时调用，读取权限缺失即判不可读，供告警段列出
function isReadable(file) {
  try { fs.accessSync(file, fs.constants.R_OK); return true; } catch (e) { return false; }
}

// 遍历入口：点开头条目一律不入结果；排除目录名不递归；排除集由调用方按树的性质给定，默认沿用源码树口径。
// unreadable 为可选收集器：目录列举失败即记该目录，文件无读权限即记该文件；缺省为 null 时两者均不记录。
function walk(dir, skipDirNames = SOURCE_TREE_SKIP_DIR_NAMES, out = [], unreadable = null) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) {
    if (unreadable) unreadable.push(dir);
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirNames.has(entry.name)) walk(full, skipDirNames, out, unreadable);
    } else {
      if (unreadable && !isReadable(full)) unreadable.push(full);
      out.push(full);
    }
  }
  return out;
}

module.exports = { walk, SOURCE_TREE_SKIP_DIR_NAMES, DOC_TREE_SKIP_DIR_NAMES };
