/**
 * 目标：脚本共享层的文本与漂移项工具，把 ref-check、roster-check、decision-tables 三处逐字重复的实现收敛为唯一实现。
 * 范围：三项纯函数——安全读文件、拆行并编号、构造漂移项；漂移项字段固定为 item、file、line、criterion、expect、found。
 * 不包含：目录遍历与排除集（见同目录 walk.js）、路径归一、校验语义、命令行入口。不引入第三方依赖。
 */

const fs = require("fs");

// 安全读文件：路径不存在、不可读或读取异常一律回空串，读失败不得让调用方中断
function readFileText(file) {
  try { return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""; } catch (e) { return ""; }
}

// 拆行并编号：行号按物理行自 1 起算，供按行定位的校验项使用
function withLineNumbers(text) {
  return String(text || "").split("\n").map((line, index) => ({ line, no: index + 1 }));
}

// 构造漂移项：found 截断 60 字符，避免超长单元格撑爆报告；字段名与各校验项回传形态一致
function drift(item, file, line, criterion, expect, found) {
  return { item, file, line, criterion, expect, found: found === undefined ? "" : String(found).slice(0, 60) };
}

module.exports = { readFileText, withLineNumbers, drift };
