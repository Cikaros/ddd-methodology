/**
 * scripts/drift-check.mjs —— 反漂移复写扫描（M10）。
 *
 * 检「同一事实在权威件之外再写具体值」；核「权威件取值 = 实物」（R13）。
 * 用法：node scripts/drift-check.mjs [--root <项目根>] [--check]
 * 退出码：0 零复写；1 检出复写/不一致；2 用法错。
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return undefined; } };
const checks = [];
function addCheck(id, authority, mirrors, ok, findings) { checks.push({ id, authority, mirrors, ok, findings }); }

// 1) commands.json（权威） = registry.COMMANDS（运行期投影）
try {
  const auth = readJson(join(packageRoot, "assets", "commands.json"));
  const reg = await import(new URL("../src/lib/registry.ts", import.meta.url).href);
  const declared=(auth?.commands??[]).map(c=>({name:c.name,description:c.purpose,role:c.role??null,blocking:c.blocking,dispatch:c.dispatch}));
  const registered=(reg.COMMANDS??[]).map(c=>({name:c.name,description:c.description,role:c.role??null,blocking:c.blocking,dispatch:c.dispatch}));
  const ok=JSON.stringify(declared)===JSON.stringify(registered);
  addCheck("drift.commands", "assets/commands.json", "src/lib/registry.ts#COMMANDS", ok,
    ok?[]:[`命令的名称、角色、确认方式或派发策略与运行时不一致`]);
} catch (e) { addCheck("drift.commands", "assets/commands.json", "src/lib/registry.ts", false, [String(e?.message ?? e)]); }

// 2) gates.json 门禁条数 = 6
{
  const auth = readJson(join(packageRoot, "assets", "gates.json"));
  const n = (auth?.gates ?? []).length;
  addCheck("drift.gates-count", "assets/gates.json", "（条数=6）", n === 6, n === 6 ? [] : [`实为 ${n}`]);
}

// 3) Skill catalog = packaged Skill directories; languages.json is only a generated projection.
{
  const auth = readJson(join(packageRoot, "assets", "skills-catalog.json"));
  const projection = readJson(join(packageRoot, "assets", "languages.json"));
  const listed = auth?.skills ?? [];
  const missing = listed.filter((s) => !existsSync(join(packageRoot, s.dir ?? '', "SKILL.md"))).map(s => s.id);
  const actualLang = listed.filter(s => s.category === 'language').map(s => s.id.replace(/^lang-/,''));
  const projected = (projection?.languages ?? []).map(s => s.id);
  const mismatch = actualLang.length !== projected.length || actualLang.some((id, i) => id !== projected[i]);
  addCheck('drift.skills-catalog','assets/skills-catalog.json','skills/**',!missing.length,missing.map(id => `缺技能 ${id}`));
  addCheck('drift.languages','assets/skills-catalog.json','assets/languages.json',!mismatch,mismatch?['语言投影应从技能目录生成']:[]);
}

// 4) 阈值不内置：代码不得硬编码 board/memory 阈值
{
  const code = [];
  for (const dir of ["src", "scripts"]) {
    if (!existsSync(join(packageRoot, dir))) continue;
    (function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|mjs)$/.test(e.name)) code.push(readFileSync(p, "utf8")); } })(join(packageRoot, dir));
  }
  const blob = code.join("\n");
  const hits = [];
  if (/starvationWindow\s*[:=]\s*\d+/.test(blob) && !/assets\/board\.json/.test(blob)) hits.push("board 阈值疑似内置");
  if (/remindAt\s*[:=]\s*\d+/.test(blob) && !/assets\/memory\.json/.test(blob)) hits.push("memory 阈值疑似内置");
  addCheck("drift.no-inline-thresholds", "assets/board.json + assets/memory.json", "src/** + scripts/**", hits.length === 0, hits);
}


// 5) Agent contracts must match role permission configuration and command dispatch.
{
  const declared=(readJson(join(packageRoot,'assets','commands.json'))?.commands??[]);
  const roleTools=readJson(join(packageRoot,'assets','role-tools.json'))?.roles??{};
  const available=readdirSync(join(packageRoot,'agents'),{withFileTypes:true})
    .filter(e=>e.isFile()&&e.name.endsWith('.md')).map(e=>e.name.slice(0,-3));
  const invalid=[];
  for(const role of available)if(!Object.hasOwn(roleTools,role))invalid.push(`Agent ${role} 没有工具权限定义`);
  for(const role of Object.keys(roleTools)){
    if(!available.includes(role))invalid.push(`工具权限引用了不存在的 Agent: ${role}`);
    if(!Array.isArray(roleTools[role])||!roleTools[role].includes('skill'))
      invalid.push(`Agent ${role} 无法读取按需推荐的 Skill`);
  }
  for(const item of declared)if(item.role && !available.includes(item.role))invalid.push(`命令 ${item.name} 缺 Agent ${item.role}`);
  addCheck('drift.agent-skill-tools','agents/*.md + assets/role-tools.json','assets/commands.json + context tool policy',invalid.length===0,invalid);
}

// 6) Project version, lockfile, and latest authoritative changelog must agree.
{
  const pkg=readJson(join(packageRoot,'package.json'));
  const lock=readJson(join(packageRoot,'package-lock.json'));
  const log=readFileSync(join(packageRoot,'docs/CHANGELOG.jsonl'),'utf8').split(/\r?\n/).filter(Boolean);
  const last=log.length?JSON.parse(log.at(-1)):null;
  const ok=pkg?.version===lock?.version && pkg?.version===lock?.packages?.['']?.version &&
    last?.version===`v${pkg?.version}`;
  addCheck('drift.release-version','package.json','package-lock.json + docs/CHANGELOG.jsonl',ok,
    ok?[]:['2.0.2 版本声明与锁文件或最新变更记录不一致']);
}

const ok = checks.every((c) => c.ok);
const report = { ts: new Date().toISOString(), checks, ok };
const outPath = join(root, "docs", "reports", "drift-check.json");
writeReportJson(outPath, report);

if (!ok) {
  console.error("失败：反漂移扫描检出复写/不一致。");
  for (const c of checks.filter((x) => !x.ok)) console.error(`  - ${c.id}: ${c.findings.join("; ")}`);
  console.error("remedy：把具体值只留在权威件，其余引用不复写。");
  process.exit(1);
}
console.log(`drift-check OK：${checks.length} 项零复写。`);
process.exit(0);
