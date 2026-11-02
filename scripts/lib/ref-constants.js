/**
 * 目标：把 ref-check 中「规范为源、其余位置为受控副本」这一域的常量集合校验外置为单一模块，控制 ref-check 的行数规模。
 * 范围：C3 阈值一致性、C6 门号一致性、C9 守卫编号一致性——三者均以规范节中的常量集合为源，比对其他位置的副本。
 * 不包含：引用形态（见 ref-refs.js）、冻结短语（见 ref-phrases.js）、阶段键（见 ref-stages.js）、规范读取面（见 spec-doc.js）、命令行入口。不引入第三方依赖。
 */

const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./text.js");

function createConstantChecks(env) {
  // guardRel 由 ref-check 注入，守卫扩展的路径只在调用方定义一次，避免多处并列
  const { root, relPath, liveDocPaths, spec, guardRel } = env;

  // C3 阈值一致性：阈值以规范「粒度与独立性」节的锚点句为唯一权威，其余出现处须同值且承载正确语义
  // 锚点解析：取该节含「行」阈值最多的一句，捕获「标签 数字 行」三元组；不足三档或不可解析即判漂移
  function thresholdKeywords(label) {
    return label.split(/或/).map((part) => part.replace(/(文件|模块|项|契约|数)$/, "")).filter(Boolean);
  }
  function parseThresholdAnchor() {
    const section = spec.findSection("粒度与独立性");
    if (!section || section.ambiguous) return section && section.ambiguous ? { ambiguous: section.hits } : null;
    const lines = withLineNumbers(section.body).map((r) => r.line);
    const anchorLine = lines.slice().sort((a, b) => (b.match(/\d+\s*行/g) || []).length - (a.match(/\d+\s*行/g) || []).length)[0] || "";
    const rules = [];
    for (const m of anchorLine.matchAll(/([\u4e00-\u9fa5A-Za-z]+?)\s*(\d+)\s*行/g)) {
      const keywords = thresholdKeywords(m[1]);
      if (keywords.length) rules.push({ value: Number(m[2]), token: `${m[2]} 行`, label: m[1], cue: new RegExp(keywords.join("|")) });
    }
    return rules.length >= 3 ? { rules } : { invalid: true };
  }
  function checkThresholds() {
    if (!spec.docs.length) return spec.missing("C3", "规范粒度与独立性节须给出可解析的阈值锚点句");
    const anchor = parseThresholdAnchor();
    if (anchor && anchor.ambiguous) return [spec.sectionDrift("C3", "粒度与独立性", anchor.ambiguous)];
    if (!anchor || anchor.invalid) return [drift("C3", spec.firstRel(), 0, "规范粒度与独立性节须含可解析的三档阈值锚点句", "三档阈值锚点句", "锚点句不可解析")];
    const found = [];
    for (const file of liveDocPaths) {
      for (const row of withLineNumbers(readFileText(file))) {
        const hasRowToken = /\d+\s*行/.test(row.line);
        for (const rule of anchor.rules) {
          const mentioned = row.line.includes(rule.token);
          const cued = rule.cue.test(row.line);
          if (!hasRowToken || mentioned === cued) continue;
          found.push(drift("C3", relPath(file), row.no, mentioned ? `阈值 ${rule.token} 的上下文须承载锚点语义` : `阈值行须与锚点同值，${rule.label} 档锚点为 ${rule.token}`, mentioned ? `锚点语义 ${rule.label}` : `含 ${rule.token}`, row.line.trim()));
        }
      }
    }
    return found;
  }

  // C6 门号一致性：文档中出现的门号须属于规范「质量门禁」节门禁表定义的门号集合
  function extractSpecGateIds() {
    const section = spec.findSection("质量门禁");
    if (!section) return null;
    if (section.ambiguous) return { ambiguous: section.hits };
    const ids = new Set();
    for (const row of section.body.split("\n")) {
      if (!row.trim().startsWith("|")) continue;
      for (const cell of row.split("|")) {
        const value = cell.replace(/[`*\s]/g, "");
        if (/^G\d+(?:\.\d+|-INT)?$/.test(value)) ids.add(value);
      }
    }
    return ids.size ? ids : null;
  }
  function checkGateIds() {
    if (!spec.docs.length) return spec.missing("C6", "规范质量门禁表须给出门号集合");
    const gateIds = extractSpecGateIds();
    if (gateIds && gateIds.ambiguous) return [spec.sectionDrift("C6", "质量门禁", gateIds.ambiguous)];
    if (!gateIds) return spec.missing("C6", "规范质量门禁表须给出门号集合");
    const allowed = [...gateIds].join("/");
    const found = [];
    for (const file of liveDocPaths) {
      for (const row of withLineNumbers(readFileText(file))) {
        for (const m of row.line.matchAll(/(?<![\w-])G\d+(?:\.\d+|-INT)?(?![\w-])/g)) {
          if (!gateIds.has(m[0])) found.push(drift("C6", relPath(file), row.no, "门号须属于规范门禁表定义的门号集合", `门号属于 ${allowed}`, m[0]));
        }
      }
    }
    return found;
  }

  // C9 守卫编号一致性：扩展文件头的编号与触发点，与规范「机械约束」节的守卫判定表一致
  function normalizeGuardToken(text) {
    return String(text || "").replace(/[`*\s]/g, "");
  }
  function extractHeaderGuards(extText) {
    const headerMatch = extText.match(/\/\*\*([\s\S]*?)\*\//);
    const guards = new Map();
    for (const row of withLineNumbers(headerMatch ? headerMatch[1] : "")) {
      const m = row.line.match(/^\s*\*\s*-\s*(H-\d+)\b(.*)$/);
      if (!m) continue;
      const labeled = m[2].match(/触发点\s*[:：]\s*([^。；;\n]+)/);
      const paren = m[2].match(/[（(]([^）)]+)[）)]/);
      guards.set(m[1], normalizeGuardToken(labeled ? labeled[1] : paren ? paren[1] : ""));
    }
    return guards;
  }
  function extractSpecGuards() {
    const section = spec.findSection("机械约束");
    if (!section) return null;
    if (section.ambiguous) return { ambiguous: section.hits };
    const guards = new Map();
    for (const row of withLineNumbers(section.body)) {
      if (!row.line.trim().startsWith("|")) continue;
      const cells = row.line.split("|").map((cell) => cell.replace(/[`*\s]/g, ""));
      if (/^H-\d+$/.test(cells[1] || "")) guards.set(cells[1], { trigger: cells[2] || "", line: section.line + row.no });
    }
    return guards.size ? { guards, rel: section.rel } : null;
  }
  function checkGuardIds() {
    if (!spec.docs.length) return spec.missing("C9", "规范机械约束节须给出运行时守卫判定表");
    const specSection = extractSpecGuards();
    if (specSection && specSection.ambiguous) return [spec.sectionDrift("C9", "机械约束", specSection.ambiguous)];
    if (!specSection) return spec.missing("C9", "规范机械约束节须给出运行时守卫判定表");
    const { guards: specGuards, rel: specGuardRel } = specSection;
    const guardPath = path.join(root, ...guardRel);
    const headerGuards = extractHeaderGuards(readFileText(guardPath));
    if (!headerGuards.size) {
      return [drift("C9", relPath(guardPath), 0, "守卫扩展文件头须按编号列出触发点", "形如 - H-1 触发点：… 的条目", "未解析到编号条目")];
    }
    const found = [];
    for (const [id, row] of specGuards) {
      if (!headerGuards.has(id)) {
        found.push(drift("C9", relPath(guardPath), 0, "守卫编号集合须与规范守卫表一致", `文件头含编号 ${id}`, id));
        continue;
      }
      if (headerGuards.get(id) !== row.trigger) {
        found.push(drift("C9", relPath(guardPath), 0, "守卫触发点须与规范守卫表逐字一致", `${id} 的触发点为 ${row.trigger}`, headerGuards.get(id)));
      }
    }
    for (const id of headerGuards.keys()) {
      if (!specGuards.has(id)) found.push(drift("C9", specGuardRel, 0, "守卫编号集合须与规范守卫表一致", `规范守卫表含编号 ${id}`, id));
    }
    return found;
  }

  return { checkThresholds, checkGateIds, checkGuardIds };
}

module.exports = { createConstantChecks };
