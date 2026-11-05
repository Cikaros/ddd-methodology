/**
 * 目标：把七个入口脚本各自实现的输出字节上限回撤逻辑收敛为唯一实现，消除逐脚本重复与上限字面量并列。
 * 范围：按 UTF-8 字节上限求最大可保留明细数并回传装配结果，行数组与文本两种装配形态各一个入口；
 *   不包含各脚本的明细文案、固定行与机读结论行。
 * 单一权威：输出上限取自规范「结构与注释的机械证据」节的脚本消费契约表输出上限列，默认值与表内一致。
 */

// 默认输出上限：与脚本消费契约表的输出上限列一致，单个脚本如需不同可显式传 limit
const DEFAULT_LIMIT_BYTES = 12000;

// 最大可保留明细数：二分搜索，避免逐项重算
function maxKept({ total, limit, size }) {
  if (size(total) <= limit) return total;
  let lo = 0;
  let hi = total;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (size(mid) <= limit) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// 行数组装配：build(kept) 回传行数组，按换行连接后计字节
function capLines({ total, limit = DEFAULT_LIMIT_BYTES, build }) {
  return build(maxKept({ total, limit, size: (kept) => Buffer.byteLength(build(kept).join("\n"), "utf8") }));
}

// 文本装配：build(kept) 回传字符串并直接计字节，供 JSON 输出类脚本使用
function capText({ total, limit = DEFAULT_LIMIT_BYTES, build }) {
  return build(maxKept({ total, limit, size: (kept) => Buffer.byteLength(build(kept), "utf8") }));
}

module.exports = { DEFAULT_LIMIT_BYTES, capLines, capText };
