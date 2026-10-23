#!/usr/bin/env node
/**
 * 目标：把仓库权威版 global/APPEND_SYSTEM.md 的标记区块合并进用户的全局 APPEND_SYSTEM.md。
 * 范围：只替换标记区块；区块之外的用户自定义内容原样保留；卸载时移除该区块。跨平台单一实现，供 install.sh 与 install.bat 共用。
 *
 * 用法：
 *   node merge-append-system.js install <仓库根> [目标文件]
 *   node merge-append-system.js remove [目标文件]
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const BEGIN = "<!-- ddd-methodology:begin -->";
const END = "<!-- ddd-methodology:end -->";

const mode = process.argv[2];
const repoRoot = process.argv[3] || process.cwd();
// 目标文件优先取入参，保证与安装脚本的 PI_HOME 口径一致；未传时回退家目录推导
const explicitTarget = mode === "remove" ? process.argv[3] : process.argv[4];
const target = explicitTarget || path.join(os.homedir(), ".pi", "agent", "APPEND_SYSTEM.md");
const backup = target + ".ddd-bak";

function readIfExists(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    return null;
  }
}

// 移除标记区块，返回剩余内容
function stripBlock(text) {
  const b = text.indexOf(BEGIN);
  if (b === -1) return text.replace(/\s+$/, "");
  const e = text.indexOf(END, b);
  if (e === -1) return text.slice(0, b).replace(/\s+$/, "");
  const before = text.slice(0, b).replace(/\s+$/, "");
  const after = text.slice(e + END.length).replace(/^\s+/, "");
  return [before, after].filter(Boolean).join("\n\n");
}

fs.mkdirSync(path.dirname(target), { recursive: true });
const existing = readIfExists(target);

if (mode === "remove") {
  if (existing === null) {
    console.log("[跳过] 全局 APPEND_SYSTEM.md 不存在");
    process.exit(0);
  }
  if (!existing.includes(BEGIN)) {
    console.log("[跳过] 未见 ddd-methodology 标记区块，未做改动");
    process.exit(0);
  }
  const rest = stripBlock(existing);
  if (rest.trim()) {
    fs.writeFileSync(target, rest + "\n");
    console.log("[完成] 已移除标记区块，保留其余自定义内容");
    process.exit(0);
  }
  // 仅剩标记区块：优先恢复安装前的备份，避免用户原有内容丢失
  const bak = readIfExists(backup);
  if (bak !== null) {
    fs.writeFileSync(target, bak);
    fs.rmSync(backup);
    console.log("[完成] 已恢复安装前备份 -> " + target);
  } else {
    fs.rmSync(target);
    console.log("[完成] 已移除全部内容并删除文件");
  }
  process.exit(0);
}

if (mode !== "install") {
  console.error("用法：node merge-append-system.js install <仓库根> [目标文件] | remove [目标文件]");
  process.exit(1);
}

const block = readIfExists(path.join(repoRoot, "global", "APPEND_SYSTEM.md"));
if (!block) {
  console.error("[错误] 缺少 global/APPEND_SYSTEM.md，无法合并全局规则");
  process.exit(1);
}
if (!block.includes(BEGIN) || !block.includes(END)) {
  console.error("[错误] global/APPEND_SYSTEM.md 缺少标记区块 ddd-methodology:begin/end");
  process.exit(1);
}

if (existing !== null) {
  if (!fs.existsSync(backup)) {
    fs.writeFileSync(backup, existing);
    console.log("[完成] 已备份原文件 -> " + backup);
  }
  const rest = stripBlock(existing);
  const merged = rest.trim() ? rest + "\n\n" + block.replace(/\s+$/, "") + "\n" : block.replace(/\s+$/, "") + "\n";
  fs.writeFileSync(target, merged);
  console.log("[完成] 标记区块已更新，区块外内容保留 -> " + target);
} else {
  fs.writeFileSync(target, block.replace(/\s+$/, "") + "\n");
  console.log("[完成] 全局规则已写入 -> " + target);
}
