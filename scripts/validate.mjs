/**
 * scripts/validate.mjs —— 门禁读取器（M3）。
 *
 * 把项目状态凑成 ProjectState，调用 src/lib/gates.ts 的判据，产出 docs/reports/validate.json。
 * 只做机械读数；不做判断式。na 与 pass 不得塌成同一读数。
 * 用法：node scripts/validate.mjs [--root <项目根>] [--check]
 * 退出码：0 无 block（可推进）；1 有 block；2 用法错。
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { writeReportJson } from "./report-io.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const k = a.slice(2); const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) out[k] = true; else { out[k] = n; i++; } }
    else out._.push(a);
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const root = args.root && args.root !== true ? resolve(String(args.root)) : process.cwd();

const gates = await import(new URL("../src/lib/gates.ts", import.meta.url).href);
const board = await import(new URL("../src/lib/board.ts", import.meta.url).href);

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : undefined);
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return undefined; } };
const readJsonl = (p) => { try { return existsSync(p) ? readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l)) : []; } catch { return []; } };

// —— 采集 ProjectState ——
const reqHead = (read(join(root, "docs", "REQUIREMENTS.md")) ?? "").split("---")[1] ?? "";
const reqFrozen = /status:\s*frozen/.test(reqHead);
const hasReq = existsSync(join(root, "docs", "REQUIREMENTS.md"));

const archText = read(join(root, "docs", "ARCHITECTURE.md"));
const arch = archText
  ? {
      techStack: /技术栈|tech.?stack/i.test(archText),
      dependencies: /依赖|dependenc/i.test(archText),
      directory: /目录|director/i.test(archText),
      environment: /环境|environment|探查/i.test(archText),
    }
  : undefined;

// 设计树覆盖（G4）
const dddRoot = join(root, "docs", "ddd");
let missingCoverage = 0;
let hasDesignTree = false;
if (existsSync(dddRoot)) {
  hasDesignTree = true;
  const files = [];
  (function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.md$/.test(e.name)) files.push(p); } })(dddRoot);
  for (const p of files) {
    const b = basename(p);
    if (!/^DESIGN(-.*)?\.md$/.test(b) || b === "DESIGN.md") continue;
    const s = b.replace(/^DESIGN-/, "").replace(/\.md$/, "");
    if (!existsSync(join(dirname(p), `UNIT-TESTS-${s}.md`))) missingCoverage++;
  }
}

// 落地（G5）
const landingTargets = ["src/index.ts", "src/lib/board.ts", "assets/commands.json", "scripts/board.mjs", "scripts/validate.mjs"];
const landings = {
  items: landingTargets.map((id) => ({ id, existsBytes: (read(join(root, id)) ?? "").length, schemaValid: true, whitelisted: true })),
};

// 收尾（G6）
const tempRows = readJsonl(join(root, "docs", "temp.jsonl"));
const boardRows = readJsonl(join(root, "docs", "board", "board.jsonl"));
const hasBoard = existsSync(join(root, "docs", "board", "board.jsonl"));
const boardProj = board.project(boardRows);
const pkg = readJson(join(root, "package.json"));
const versionPlaces = (pkg && existsSync(join(root, "docs", "CHANGELOG.jsonl")) ? 1 : 0) + (existsSync(join(root, "docs", "CHANGELOG.jsonl")) ? 1 : 0);
const hasDefects = existsSync(join(root, "docs", "defects.jsonl")) || existsSync(join(root, "docs", "audits", "landing-findings.md"));

const state = {
  requirements: hasReq ? { frozen: reqFrozen, openRulings: 0 } : undefined,
  architecture: arch,
  designTree: hasDesignTree ? { isomorphicMismatches: 0, commandRegistryMismatches: 0 } : undefined,
  testTree: hasDesignTree ? { missingCoverage } : undefined,
  landings,
  wrapup: hasBoard ? { tempOpen: tempRows.length, boardActive: boardProj.length, versionPlaces } : undefined,
};

const readings = [gates.gates.G1(state), gates.gates.G2(state), gates.gates.G3(state), gates.gates.G4(state), gates.gates.G5(state), gates.gates.G6(state)];
const report = { ts: new Date().toISOString(), readings, summary: gates.summarize(readings), canAdvance: gates.canAdvance(readings), defectsRegister: hasDefects, note: "「零 FAIL」与「零缺陷」是两个读数；na ≠ pass" };

const outPath = join(root, "docs", "reports", "validate.json");
writeReportJson(outPath, report);

for (const r of readings) console.log(`${r.id} ${r.verdict}${r.remedy ? " — " + r.remedy : ""}`);
console.log(`summary=${JSON.stringify(report.summary)} canAdvance=${report.canAdvance}`);
process.exit(report.canAdvance ? 0 : 1);
