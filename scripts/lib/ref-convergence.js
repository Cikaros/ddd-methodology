/**
 * 目标：把本仓库的收敛度外化为四条机械断言——设计文档唯一、仓库条目数不增长、文档结构项数不增长、新增规则重复为零——
 *   作为 ref-check 的 C19 校验项，承载「设计内敛、文件内敛、规则内敛」判据。
 * 范围：C19 四项断言——其一，docs/internal/refactor/ 下 .md 文件恰好一份；
 *   其二，仓库内非忽略文件数与目录数与基线比对，只报增长；其三，对 ref-check 已认定的活文档集合逐份统计标题数与基线比对，只报增长；
 *   其四，抽取候选规范句，检出跨两个以上文件重复者中相对基线新增的部分，已登记于基线的重复不再计入。
 * 不包含：引用形态、常量集合、冻结短语的校验语义（各见同目录对应模块）、命令行入口。不引入第三方依赖。
 * 单一权威：冻结短语集合读取 ref-phrases.js 的登记表声明处，本模块不另立一份；活文档集合由 ref-check 经 env 注入，本模块不另写遍历口径。
 * 基线：scripts/lib/convergence-baseline.json，记录仓库文件数与目录数、各活文档标题数、以及已复核的跨文件重复
 *   （每条含归一化句、原文首句、检出文件清单、来源与待清波次）。基线缺失时由本模块首次生成并落盘，其后只读比对。
 * 断言四的语义固定为「检出相对基线的新增重复」，不代表库内不存在重复：库内既有重复登记于基线并同步登记为债务，基线是过渡登记而非静默冻结。
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { readFileText, drift } = require("./text.js");

const REFACTOR_DIR_REL = "docs/internal/refactor";
const BASELINE_REL = "scripts/lib/convergence-baseline.json";
const FROZEN_PHRASES_REL = "scripts/lib/ref-phrases.js";
const SENTENCE_MIN_LEN = 12; // 短句多为列表项与通用短语，纳入会淹没真问题
const NORM_CUE_RE = /须|不得|必须|应|禁止|一律|严禁|必/; // 规范语气词，用于把「规范句」与步骤、说明、普通清单项区分开

// 归一化：去首尾空白、折叠连续空白、去尾部标点，与断言四的判据一致
function normalizeSentence(text) {
  return String(text).replace(/\s+/g, " ").trim().replace(/[。！？!?；;：:,，、.]+$/, "").trim();
}

// 冻结短语登记：读取 ref-phrases.js 的声明处并归一，避免在本模块另立一份而失权威
function readFrozenPhrases(root) {
  const text = readFileText(path.join(root, ...FROZEN_PHRASES_REL.split("/")));
  const out = [];
  for (const m of text.matchAll(/\{\s*phrase:\s*"([^"]*)"/g)) out.push(normalizeSentence(m[1]));
  return out;
}

// 冻结短语排除按「句内已含」判定：冻结短语须在其载体文档逐字出现，其所在句天然跨文件重复，非断言四要检的规则并列
function containsFrozen(sentence, frozen) {
  return frozen.some((phrase) => phrase && sentence.includes(phrase));
}

// 候选规范句：跳过 frontmatter、标题、表格、代码块与引用块，去列表与行内标记，按句末切分，
// 要求含规范语气词且长度达标；回传归一化句与其原文首句，供基线留下可读样本
function candidateSentences(text, frozen) {
  const out = [];
  const lines = String(text).split("\n");
  let inFence = false;
  let front = "unknown";
  let started = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!started) { if (trimmed === "") continue; started = true; }
    if (front === "unknown") {
      if (trimmed === "---") { front = "open"; continue; }
      front = "closed";
    }
    if (front === "open") { if (trimmed === "---") front = "closed"; continue; }
    if (/^\s*```/.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;
    let line = trimmed;
    if (!line || /^#{1,6}\s/.test(line) || line.startsWith("|") || line.startsWith(">")) continue;
    line = line.replace(/^[-*+]\s+/, "").replace(/^\d+[.)、]\s+/, "").replace(/\*\*/g, "").replace(/`/g, "").replace(/\[\s\]/g, "").replace(/\[x\]/gi, "");
    for (const piece of line.split(/[。！？!?]/)) {
      const sentence = normalizeSentence(piece);
      if (sentence.length < SENTENCE_MIN_LEN) continue;
      if (!NORM_CUE_RE.test(sentence)) continue;
      if (containsFrozen(sentence, frozen)) continue;
      out.push({ sentence, raw: piece.trim() });
    }
  }
  return out;
}

// 仓库非忽略条目：以 git 的非忽略集合为准（含已跟踪与未跟踪未忽略），目录取文件路径的祖先集合；git 不可用回 null
function countRepoItems(root) {
  const result = spawnSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) return null;
  const files = String(result.stdout || "").split("\n").filter(Boolean);
  const dirs = new Set();
  for (const file of files) {
    const parts = file.split("/");
    for (let k = 1; k < parts.length; k++) dirs.add(parts.slice(0, k).join("/"));
  }
  return { files: files.length, dirs: dirs.size };
}

// 标题数：一级至六级标题，跳过代码块内的井号行
function countHeadings(text) {
  let count = 0;
  let inFence = false;
  for (const line of String(text).split("\n")) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (!inFence && /^#{1,6}\s/.test(line)) count++;
  }
  return count;
}

function createConvergenceChecks(env) {
  const { root, relPath, liveDocPaths } = env;

  // 断言一：设计文档恒为一份，零份或多份均属漂移
  function checkDesignSingleton(found) {
    const dir = path.join(root, ...REFACTOR_DIR_REL.split("/"));
    let names;
    try { names = fs.readdirSync(dir); } catch (e) { names = []; }
    const mds = names.filter((name) => name.endsWith(".md"));
    if (mds.length !== 1) {
      found.push(drift("C19", `${REFACTOR_DIR_REL}/`, 0, "设计文档须恒为一份，零份或多份均属漂移", "恰好一份 .md", mds.length ? `${mds.length} 份：${mds.join("、")}` : "零份"));
    }
  }

  // 断言四的检出面：归一化句到文件的映射，只留跨两个以上文件者，附原文首句
  function collectDuplicates(frozen) {
    const bySentence = new Map();
    for (const file of liveDocPaths) {
      const rel = relPath(file);
      for (const { sentence, raw } of candidateSentences(readFileText(file), frozen)) {
        if (!bySentence.has(sentence)) bySentence.set(sentence, { raw, files: new Set() });
        bySentence.get(sentence).files.add(rel);
      }
    }
    const found = [];
    for (const [sentence, entry] of bySentence) {
      if (entry.files.size >= 2) found.push({ sentence, sample: entry.raw, files: [...entry.files].sort() });
    }
    return found.sort((a, b) => (a.sentence < b.sentence ? -1 : a.sentence > b.sentence ? 1 : 0));
  }

  function currentHeadings() {
    const map = {};
    for (const file of liveDocPaths) map[relPath(file)] = countHeadings(readFileText(file));
    return map;
  }

  function checkConvergence() {
    const found = [];
    checkDesignSingleton(found);

    const frozen = readFrozenPhrases(root);
    const items = countRepoItems(root);
    const headings = currentHeadings();
    const duplicates = collectDuplicates(frozen);

    const baselinePath = path.join(root, ...BASELINE_REL.split("/"));
    const baselineText = readFileText(baselinePath);
    // 首次生成：基线缺失即落盘一份当前快照，本次不判漂移——基线是过渡登记，不是静默冻结。
    // 先落占位使本次统计含基线文件自身，避开生成基线即报文件数增长的循环依赖；占位随即被正式内容覆盖
    if (!baselineText) {
      try { fs.writeFileSync(baselinePath, "{}\n"); } catch (e) { /* 落盘失败：按不含基线自身统计，下次生成仍会纠正 */ }
      const fresh = { generatedAt: new Date().toISOString(), repoItems: countRepoItems(root), docHeadings: currentHeadings(), duplicateFindings: duplicates.map((item) => ({ ...item, source: "待复核", dueWave: null })) };
      try { fs.writeFileSync(baselinePath, JSON.stringify(fresh, null, 2) + "\n"); } catch (e) { /* 落盘失败不阻断，下次仍会尝试生成 */ }
      return found;
    }
    let baseline;
    try { baseline = JSON.parse(baselineText); } catch (e) { baseline = null; }
    if (!baseline || typeof baseline !== "object" || !baseline.repoItems || !baseline.docHeadings || !Array.isArray(baseline.duplicateFindings)) {
      found.push(drift("C19", BASELINE_REL, 0, "收敛度基线须可解析且字段齐备", "含 repoItems、docHeadings 与 duplicateFindings 的基线", baseline ? "字段缺失" : "解析失败"));
      return found;
    }

    // 断言二：只报增长，减少是收敛
    if (items === null) {
      found.push(drift("C19", "仓库", 0, "仓库条目数须可统计以比对基线", "git 可枚举非忽略文件", "统计失败"));
    } else {
      if (items.files > baseline.repoItems.files) found.push(drift("C19", "仓库", 0, "仓库文件数不得较基线增长", `文件数 ≤ ${baseline.repoItems.files}`, `现 ${items.files}`));
      if (items.dirs > baseline.repoItems.dirs) found.push(drift("C19", "仓库", 0, "仓库目录数不得较基线增长", `目录数 ≤ ${baseline.repoItems.dirs}`, `现 ${items.dirs}`));
    }
    // 断言三：只报增长
    for (const rel of Object.keys(headings)) {
      const base = baseline.docHeadings[rel];
      if (base === undefined) { found.push(drift("C19", rel, 0, "新增活文档属结构项增长，须登记", "活文档集合与基线一致", `${headings[rel]} 个标题`)); continue; }
      if (headings[rel] > base) found.push(drift("C19", rel, 0, "文档标题数不得较基线增长", `标题数 ≤ ${base}`, `现 ${headings[rel]}`));
    }
    // 断言四：检出相对基线新增的重复，已登记于基线者不再计入
    const known = new Set(baseline.duplicateFindings.filter((item) => item && item.sentence).map((item) => item.sentence));
    for (const item of duplicates) {
      if (known.has(item.sentence)) continue;
      found.push(drift("C19", item.files[0], 0, "检出相对基线新增的跨文件规则重复，须收敛为单一权威", "仅一处定义", `${item.files.length} 份：${item.sentence}`));
    }
    return found;
  }

  return { checkConvergence };
}

module.exports = { createConvergenceChecks };
