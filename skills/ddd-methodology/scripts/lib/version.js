/**
 * 目标：脚本共享层的版本标识工具，把 v主.次[.补丁] 的解析、数值比较、补丁步推进、应清版本推导、超期判定与格式化收敛为唯一实现，供 debt-check、metrics-report 与扩展侧经 createRequire 的复用方共用。
 * 范围：六项纯函数——解析、比较、加补丁步、应清版本推导、超期判定、格式化；版本形态为 v主.次 或 v主.次.补丁，缺省补丁按零，比较按三段数值。
 *   超期判据 isOverdue 由 debt-check、lib/metrics-structure 与扩展侧经 createRequire 复用，各消费方不再各写一次比较。
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

// 版本推进：仅在补丁段加跨度，主段与次段不动，补丁段可跨任意值；跨度为补丁步数，取版本管理的最小单位推进
function addSpan(v, span) {
  return { major: v.major, minor: v.minor, patch: v.patch + span };
}

// 版本入参归一：已解析的版本对象直接采用，其余按 v主.次[.补丁] 解析，两者皆不可用时回 null
function asVersion(value) {
  if (value && typeof value === "object" && !Array.isArray(value)
    && Number.isInteger(value.major) && Number.isInteger(value.minor) && Number.isInteger(value.patch)) {
    return value;
  }
  return parseVersion(value);
}

// 应清版本推导：先按补丁步数推进登记版本；结果不严格晚于当前版本时，直接取当前版本加一个补丁步，即保证严格晚于当前版本的最小版本；
// 不逐补丁递增：补丁段加一追不上更高的次段，逐次试会永不退出。当前版本不可解析时只用初始推进；登记版本或补丁步数不可解析时回 null
function deriveDue(registeredAt, span, currentVersion) {
  const base = asVersion(registeredAt);
  if (base === null || typeof span !== "number" || !Number.isFinite(span)) return null;
  const due = addSpan(base, span);
  const current = asVersion(currentVersion);
  if (current === null) return due;
  return compareVersion(due, current) > 0 ? due : addSpan(current, 1);
}

// 格式化：补丁为零时省略第三段，使 v1.2 与 v1.2.0 归一到同一文本，避免同一版本出现两种写法
function formatVersion(v) {
  return v.patch ? `v${v.major}.${v.minor}.${v.patch}` : `v${v.major}.${v.minor}`;
}

// 超期判定（纯函数）：应清版本与当前版本均可解析且前者早于后者即真；任一不可解析即假，使不可判定的项不误判超期
function isOverdue(dueValue, currentValue) {
  const due = parseVersion(dueValue);
  const current = parseVersion(currentValue);
  return due !== null && current !== null && compareVersion(due, current) < 0;
}

module.exports = { parseVersion, compareVersion, addSpan, deriveDue, formatVersion, isOverdue };
