/**
 * 目标：脚本共享层的版本标识工具，把 v主.次[.补丁] 的解析、数值比较、跨度推进与格式化收敛为唯一实现，供 debt-check 与 metrics-report 共用。
 * 范围：四项纯函数——解析、比较、加跨度、格式化；版本形态为 v主.次 或 v主.次.补丁，缺省补丁按零，比较按三段数值。
 * 不包含：登记簿字段语义（见顶层 debt-check.js）、趋势与度量口径（见顶层 metrics-report.js）、命令行入口。不引入第三方依赖。
 */

// 版本解析：接受 v主.次 与 v主.次.补丁，缺省补丁按零，使 v1.2 与 v1.2.0 归为同一版本；缺失或不合形回 null
function parseVersion(value) {
  const m = /^v(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(value == null ? "" : value).trim());
  return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3] || 0) } : null;
}

// 数值比较，避免字符串比较把 v2.10 误判为小于 v2.9；补丁段参与比较，使三段与两段写法同在一条排序线上
function compareVersion(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

// 版本推进：仅在次段加跨度，与既有两轮语义同源，不引入新的阈值体系；补丁段原样保留
function addSpan(v, span) {
  return { major: v.major, minor: v.minor + span, patch: v.patch };
}

// 格式化：补丁为零时省略第三段，使 v1.2 与 v1.2.0 归一到同一文本，避免同一版本出现两种写法
function formatVersion(v) {
  return v.patch ? `v${v.major}.${v.minor}.${v.patch}` : `v${v.major}.${v.minor}`;
}

module.exports = { parseVersion, compareVersion, addSpan, formatVersion };
