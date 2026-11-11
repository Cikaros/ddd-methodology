/**
 * scripts/materialize.mjs —— 随包件物化（F5 修复）。
 *
 * 把随包 agents/*.md（及随包静态 md 命令，若存在）物化到 <项目根>/.opencode/ 下，
 * 使宿主能**发现**它们。（真跑证据：宿主只从 .opencode/agents/ 发现；插件 AgentEditor 无 add。）
 *
 * 用法：node scripts/materialize.mjs <agents|commands|all> [--root <项目根>] [--force]
 * 退出码：0 过；1 失败（包根缺件/写失败）；2 用法错。
 * 路径纪律（§8.7）：源取**包根**，落点取**项目根**，不得混用。
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
function usage(msg) { if (msg) console.error(`用法错：${msg}`); console.error("用法：node scripts/materialize.mjs <agents|commands|all> [--root <项目根>] [--force]"); process.exit(2); }
function fail(msg) { console.error(`失败：${msg}`); process.exit(1); }

const argv = process.argv.slice(2);
const sub = argv[0];
if (!sub) usage("缺少子命令");
const args = parseArgs(argv.slice(1));
const root = args.root && args.root !== true ? resolve(String(args.root)) : process.cwd();
const force = args.force === true;

/** 物化一个目录：<包根>/<src> → <项目根>/.opencode/<dst>。幂等；内容不同默认不覆盖（需 --force）。 */
function materialize(srcRel, dstRel) {
  const srcDir = join(packageRoot, srcRel);
  if (!existsSync(srcDir)) {
    // commands 允许缺（随包可能无 md 命令）；agents 必存在。
    if (srcRel === "agents") fail(`包根缺件：${srcRel}/`);
    return { dir: srcRel, copied: 0, skipped: 0, missing: true };
  }
  const dstDir = join(root, ".opencode", dstRel);
  mkdirSync(dstDir, { recursive: true });
  let copied = 0, skipped = 0;
  for (const e of readdirSync(srcDir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith(".md")) continue;
    const src = join(srcDir, e.name);
    const dst = join(dstDir, e.name);
    const content = readFileSync(src, "utf8");
    if (existsSync(dst) && readFileSync(dst, "utf8") === content) { skipped++; continue; }
    if (existsSync(dst) && !force) {
      console.error(`差异：.opencode/${dstRel}/${e.name} 已存在且内容不同；加 --force 覆盖。`);
      fail(`存在差异未覆盖：${e.name}`);
    }
    writeFileSync(dst, content, "utf8");
    copied++;
  }
  return { dir: srcRel, copied, skipped, missing: false };
}

const results = [];
if (sub === "agents" || sub === "all") results.push(materialize("agents", "agents"));
if (sub === "commands" || sub === "all") results.push(materialize("commands", "commands"));
if (results.length === 0) usage(`未知子命令 ${sub}`);

for (const r of results) {
  if (r.missing) console.log(`${r.dir}: 随包无此目录（跳过）`);
  else console.log(`${r.dir}: 物化 ${r.copied}、跳过 ${r.skipped} → .opencode/${r.dir === "agents" ? "agents" : "commands"}/`);
}
process.exit(0);
