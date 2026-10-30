/**
 * 目标：把 ref-check 的判定表默认分支校验（C10）收敛为可单独复核的库文件，控制单一校验脚本的行数规模。
 * 范围：C10 的全部判定逻辑——代码围栏去除、表格分块、表头列名精确匹配、判定表识别、默认分支判定与判定矩阵豁免。
 * 不包含：其他校验项、文件遍历与路径解析。扫描哪些文件、如何读取文本、如何取相对路径均由调用方注入。
 * 调用形态：checkJudgmentDefault(files, readText)；files 为待扫描文件的路径集合，readText 为按路径取文本的函数。
 *   回传漂移项数组，每项字段与 ref-check 现有漂移项一致，含 item、file、line、criterion、expect、found。
 * 调用方：scripts/ref-check.js 的 C10 校验项 require 本模块并传入活文档路径集合与文本读取函数。
 */

// 判定表列名与默认分支词：精确相等匹配，避免 机读结论 与 默认值 等列名子串误报
const CONDITION_COLUMNS = new Set(["级别", "条件", "情境", "触发点", "判定条件", "检查项", "巡检项", "声明面对象", "产出物"]);
const ACTION_COLUMNS = new Set(["处理", "动作", "处置", "结论", "追加加载", "承接者", "归类", "不通过时的结论", "不通过时的归类"]);
const DEFAULT_BRANCH_WORDS = ["默认", "其余", "未命中", "其他", "无匹配"];
const hasDefaultBranchWord = (text) => DEFAULT_BRANCH_WORDS.some((word) => text.includes(word));

// 漂移项字段与 ref-check 现有形态一致；found 截断 60 字符，避免超长单元格撑爆报告
function drift(item, file, line, criterion, expect, found) {
  return { item, file, line, criterion, expect, found: found === undefined ? "" : String(found).slice(0, 60) };
}
// 行号化：分块判定按物理行定位，需要保留原始行号
function numberedRows(text) {
  return String(text || "").split("\n").map((line, index) => ({ line, no: index + 1 }));
}
// 去围栏：代码围栏区间内的行不参与判定，模板骨架表在围栏内须排除
function unFencedRows(text) {
  const rows = [];
  let fenced = false;
  for (const row of numberedRows(text)) {
    if (/^\s*(```|~~~)/.test(row.line)) { fenced = !fenced; continue; }
    if (!fenced) rows.push(row);
  }
  return rows;
}
// C10 判定表默认分支：连续竖线行分块，表头列名精确命中条件侧与动作侧即为判定表，末行或表后须有默认分支
function checkJudgmentDefault(files, readText) {
  const found = [];
  for (const file of files) {
    const rows = unFencedRows(readText(file));
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].line.trim().startsWith("|")) continue;
      let j = i;
      while (j < rows.length && rows[j].line.trim().startsWith("|")) j++;
      const cols = rows[i].line.split("|").map((cell) => cell.replace(/`/g, "").trim()).filter((cell) => cell.length);
      const isJudgment = cols.some((c) => CONDITION_COLUMNS.has(c)) && cols.some((c) => ACTION_COLUMNS.has(c));
      if (isJudgment) {
        const tail3 = hasDefaultBranchWord(rows.slice(j, j + 3).map((r) => r.line).join("\n"));
        const tail5 = rows.slice(j, j + 5).map((r) => r.line).join("\n");
        if (!hasDefaultBranchWord(rows[j - 1].line) && !tail3 && !/判定顺序|结论取/.test(tail5)) {
          found.push(drift("C10", file, rows[i].no, "判定表须含默认分支或表后判定顺序豁免", "末行或表后三行含默认词，或表后五行含判定顺序/结论取", cols.join("/")));
        }
      }
      i = j - 1;
    }
  }
  return found;
}

module.exports = { checkJudgmentDefault };
