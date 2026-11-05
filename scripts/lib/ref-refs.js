/**
 * 目标：把 ref-check 中「活文档与脚本里的引用形态」这一域的校验外置为单一模块，控制 ref-check 的行数规模。
 * 范围：C1 语义化节引用有效、C2 裸章节号引用已清除、C7 脚本名一致性——三者同属跨文档引用形态域，扫描活文档文本与 scripts、extensions 两目录及其 lib 子目录下的脚本文本。
 * 不包含：阈值、门号、守卫编号等常量集合校验（见 ref-constants.js）、冻结短语（见 ref-phrases.js）、
 *   阶段键（见 ref-stages.js）、规范读取面（见 spec-doc.js）、命令行入口。不引入第三方依赖。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, withLineNumbers, drift } = require("./text.js");
const { trimHeadingNumber } = require("./spec-doc.js");

// 工厂：root、relPath、活文档清单与规范读取器由 ref-check 注入，本模块不自定扫描面
function createRefChecks(env) {
  const { root, relPath, liveDocPaths, spec } = env;

  // C1 语义化节引用有效：见「X」节 与 见规范「X」节 的 X 须命中规范的二级或三级标题；规范节标题去编号后须跨文件唯一
  function checkSemanticRefs() {
    if (!spec.docs.length) return spec.missing("C1", "语义化节引用须解析到规范节标题");
    const found = [];
    for (const [title, hits] of spec.headingSources) {
      if (hits.length > 1) found.push(drift("C1", hits[0].rel, hits[0].line, "规范二级与三级节标题去编号后须跨文件唯一", `「${title}」唯一命中`, hits.map((h) => `${h.rel}:${h.line}`).join("、")));
    }
    for (const file of liveDocPaths) {
      for (const row of withLineNumbers(readFileText(file))) {
        // 兼容两种引用形态：见「X」节 与 见规范「X」节（中间多出规范二字），后者原不入校验而致失效引用漏检
        for (const m of row.line.matchAll(/见(?:规范)?「([^」\n]+)」节/g)) {
          const title = trimHeadingNumber(m[1]);
          if (spec.headingSet.has(title)) continue;
          found.push(drift("C1", relPath(file), row.no, "见「X」节 或 见规范「X」节 的 X 须命中规范二级或三级标题", `标题「${title}」在规范节标题集合中`, m[0]));
        }
      }
    }
    return found;
  }

  // C2 的扩展扫描面：scripts/ 与 extensions/ 下的脚本文件，含各自 lib 子目录，两层足矣不再深挖；
  // 子目录先前不在面内，致其中的裸子节号引用逃过扫描
  function collectScanScripts() {
    const out = [];
    for (const [dirName, suffix] of [["scripts", ".js"], ["extensions", ".ts"]]) {
      for (const sub of ["", "lib"]) {
        const dir = path.join(root, dirName, sub);
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith(suffix)) out.push(path.join(dir, entry.name));
        }
      }
    }
    return out;
  }
  // C2 裸章节号引用已清除：活文档与脚本文件中，编号须与语义化节名同行，规范允许编号附于语义化引用之后；
  // 裸编号有三形态，即 § 符号、无符号的「第 N 条/节/章/项」，以及带规范语境或口径后缀的子节号，三形态同属跨节引用，须一并扫描
  // 子节号取窄面两式：前缀「规范 N.M」与后缀「N.M 口径」，避免误伤版本号与小数常量
  const BARE_SUBSECTION_RE = /规范\s*\d+\.\d+|\d+\.\d+\s*口径/;
  function checkBareSectionRefs() {
    const found = [];
    for (const file of liveDocPaths.concat(collectScanScripts())) {
      for (const row of withLineNumbers(readFileText(file))) {
        if (!/§\s*\d|第\s*\d+\s*[条章节项]/.test(row.line) && !BARE_SUBSECTION_RE.test(row.line)) continue;
        if (/见「[^」]+」节/.test(row.line)) continue;
        found.push(drift("C2", relPath(file), row.no, "跨节引用须用语义化节名，编号不得独立出现", "形如 见「节标题」节 的引用", row.line.trim()));
      }
    }
    return found;
  }

  // C7 脚本名一致性：文档引用的 scripts/ 下脚本名须存在对应文件
  function checkScriptNames() {
    const found = [];
    const scriptsDir = path.join(root, "scripts");
    for (const file of liveDocPaths) {
      for (const row of withLineNumbers(readFileText(file))) {
        for (const m of row.line.matchAll(/scripts\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:js|sh|bat))/g)) {
          if (!fs.existsSync(path.join(scriptsDir, m[1]))) found.push(drift("C7", relPath(file), row.no, "引用的脚本名须存在对应文件", `scripts/${m[1]} 存在`, m[0]));
        }
      }
    }
    return found;
  }

  return { checkSemanticRefs, checkBareSectionRefs, checkScriptNames };
}

module.exports = { createRefChecks };
