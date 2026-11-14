/**
 * scripts/selftest.mjs —— 离线自测入口（无模型、无网络）。
 *
 * 覆盖（§十二 三种验证手段之①）：
 *   1. 注册面：mock ctx 加载 server part，断言 setup 注册了什么并跑通每个命令/RPC；
 *   2. 纯函数断言：src/lib/** 的判据（registry/paths/gates/router/guard/memory/board）；
 *   3. assets 基线：schema 合法 + 单点权威 + 取值域；
 *   4. 内容层契约：agents 角色、skills frontmatter、role-tools 一致。
 *
 * 用法：node --experimental-strip-types scripts/selftest.mjs <插件目录> [--verbose]
 * 退出码：0 全过；1 有失败；2 用法/入口错。
 */

import { readFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import os from "node:os";

const pluginDir = process.argv[2] ? resolve(process.argv[2]) : resolve(".");
const verbose = process.argv.includes("--verbose");

const failures = [];
const checks = [];
let section = "";
function group(name) {
  section = name;
  if (verbose) console.log(`\n# ${name}`);
}
function check(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail, section });
  if (!cond) failures.push(`[${section}] ${name}${detail ? ` — ${detail}` : ""}`);
}

// 隔离沙箱：mock ctx.location 指向它，避免命令 handler（如 /ddd-init 会真跑 scaffold）
// 把骨架写进本仓（自测不得污染权威件）。
// 所有临时目录登记于 TMP_DIRS，退出时一律清理（自测不得残留临时文件）。
const TMP_DIRS = [];
function mkTmp(prefix) {
  const d = mkdtempSync(join(os.tmpdir(), prefix));
  TMP_DIRS.push(d);
  return d;
}
function cleanTmp() {
  for (const d of TMP_DIRS.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}
process.on("exit", cleanTmp);
const SBX = mkTmp("ddd-selftest-");

function makeMockCtx(options) {
  const registrations = { commands: [], skills: [], hooks: {}, rpc: null, cleanups: [], asserts: [], created: [], switched: [], prompts: [], entries: [] };
  const storage = new Map();
  const record = (dispose) => Promise.resolve({ dispose: () => Promise.resolve(dispose?.()) });
  const ctx = {
    options: options ?? {},
    location: { directory: SBX },
    app: { version: "0.0.0", channel: "test" },
    command: { transform: (cb) => { const e = { add: (d) => registrations.commands.push(d) }; cb(e); return record(); } },
    skill: { transform: (cb) => { const e = { add: (s) => registrations.skills.push(s) }; cb(e); return record(); } },
    session: {
      hook: (n, cb) => { registrations.hooks[n] = cb; return record(); },
      prompt: async (input) => { registrations.prompts.push(input); },
      instructions: { entry: { put: async (input) => { registrations.entries.push(input); }, list: async () => [], remove: async () => {} } },
      create: async (input) => { registrations.created.push(input); return { id: "ses_child" }; },
      switchAgent: async (input) => { registrations.switched.push(input); },
      command: async () => {},
    },
    tool: { transform: (cb) => { cb({ add: () => {}, list: () => [], get: () => undefined, update: () => {}, remove: () => {}, namespace: () => {} }); return record(); }, hook: (n, cb) => { registrations.hooks[`tool:${n}`] = cb; return record(); } },
    permission: { hook: (n, cb) => { registrations.hooks[`permission:${n}`] = cb; return record(); }, assert: async (input) => { registrations.asserts.push(input); } },
    shell: { hook: (n, cb) => { registrations.hooks[`shell:${n}`] = cb; return record(); } },
    rpc: { register: (def, handlers) => { registrations.rpc = { def, handlers }; return Promise.resolve({ dispose: () => Promise.resolve(), events: { emit: async () => {} } }); } },
    storage: { get: async (k) => storage.get(k), set: async (k, v) => void storage.set(k, v), remove: async (k) => void storage.delete(k), scan: async () => [] },
    event: { subscribe: () => (async function* () {})() },
  };
  return { ctx, registrations, storage };
}

function readJson(rel) {
  try {
    return JSON.parse(readFileSync(join(pluginDir, rel), "utf8"));
  } catch {
    return undefined;
  }
}

async function main() {
  const pkgPath = join(pluginDir, "package.json");
  if (!existsSync(pkgPath)) {
    console.error(`用法错误：${pluginDir} 下无 package.json`);
    process.exit(2);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const entryAbs = resolve(pluginDir, pkg.exports?.["."] ?? "./src/index.ts");
  if (!existsSync(entryAbs)) {
    console.error(`入口错：${entryAbs} 不存在`);
    process.exit(2);
  }

  let mod;
  try {
    mod = await import(pathToFileURL(entryAbs).href);
  } catch (e) {
    console.error(`入口加载失败：${e?.message ?? e}`);
    process.exit(2);
  }
  const plugin = mod.default;
  group("注册面");
  check("default 导出存在", !!plugin);
  check("id === 'ddd'", plugin?.id === "ddd", `实为 ${plugin?.id}`);
  check("setup 为函数", typeof plugin?.setup === "function");

  // 纯函数层与后续 always-required 资源：仅当注册面基本成立时才要求（使坏插件能停在退出码 1）。
  let lib;
  try {
    lib = {
      registry: await import(pathToFileURL(resolve(pluginDir, "src/lib/registry.ts")).href),
      paths: await import(pathToFileURL(resolve(pluginDir, "src/lib/paths.ts")).href),
      gates: await import(pathToFileURL(resolve(pluginDir, "src/lib/gates.ts")).href),
      router: await import(pathToFileURL(resolve(pluginDir, "src/lib/router.ts")).href),
      guard: await import(pathToFileURL(resolve(pluginDir, "src/lib/guard.ts")).href),
      memory: await import(pathToFileURL(resolve(pluginDir, "src/lib/memory.ts")).href),
      board: await import(pathToFileURL(resolve(pluginDir, "src/lib/board.ts")).href),
      shellEncoding: await import(pathToFileURL(resolve(pluginDir, "src/lib/shell-encoding.ts")).href),
      powershellBom: await import(pathToFileURL(resolve(pluginDir, "src/lib/powershell-bom.ts")).href),
    };
  } catch (e) {
    check("纯函数层可加载", false, e?.message ?? String(e));
    check("setup 可运行", false, "纯函数层不可用");
    return report();
  }

  const { ctx, registrations, storage } = makeMockCtx({ profile: "standard" });
  let cleanup;
  try {
    cleanup = await plugin.setup(ctx);
  } catch (e) {
    check("setup 可运行", false, e?.message ?? String(e));
    return report();
  }
  check("注册了命令", registrations.commands.length > 0, `${registrations.commands.length} 条`);
  check("注册了技能", registrations.skills.length > 0, `${registrations.skills.length} 条`);
  check("至少一个 hook", Object.keys(registrations.hooks).length > 0);
  check("注册了 RPC", !!registrations.rpc);

  let cmdOk = true;
  for (const c of registrations.commands) {
    if (typeof c.execute !== "function") { cmdOk = false; failures.push(`命令 ${c.name} 缺 execute`); }
    if (!String(c.name).startsWith("ddd-")) { cmdOk = false; failures.push(`命令 ${c.name} 未前缀化`); }
  }
  check("每条命令有 execute 且带 ddd- 前缀", cmdOk);

  let cmdRunOk = true;
  for (const c of registrations.commands) {
    try { await c.execute({ sessionID: "ses_mock", prompt: { text: "" } }); }
    catch (e) { cmdRunOk = false; failures.push(`命令 ${c.name} 执行抛错: ${e?.message ?? e}`); }
  }
  check("每条命令可跑通", cmdRunOk);

  // M5（§9.5）：阻塞节点推进前取阻塞式确认（server 侧 permission.assert）。
  check("UT-src-index-02 M5 阻塞确认（ddd-intent/arch/wrapup/consolidate 触发 assert）", registrations.asserts.length >= 4 && registrations.asserts.every((a) => /^ddd:/.test(a.action)));

  // M13 注入载体（裁决：纪律走 instructions.entry 键控，不写用户消息正文）。
  {
    const promptHook = registrations.hooks["prompt"];
    let promptUntouched = false;
    if (typeof promptHook === "function") {
      const ev = { sessionID: "ses_mock", prompt: { text: "用户原始输入" } };
      await promptHook(ev);
      promptUntouched = ev.prompt.text === "用户原始输入";
    }
    check("UT-src-index-05 prompt hook 不注入、不改用户消息正文", promptUntouched);

    const ctxHook = registrations.hooks["context"];
    let sysHasDiscipline = false;
    if (typeof ctxHook === "function") {
      const ev = { sessionID: "ses_mock", agent: "build", tools: {}, system: [] };
      await ctxHook(ev);
      sysHasDiscipline = ev.system.some((p) => typeof p.text === "string" && p.text.includes("文档为唯一权威"));
    }
    const coreEntry = registrations.entries.find((e) => e.key === "ddd.discipline");
    check("UT-src-index-05 纪律经 instructions.entry 键控注入（key=ddd.discipline）", !!coreEntry && typeof coreEntry.value === "string" && coreEntry.value.includes("文档为唯一权威"));
    check("UT-src-index-08 核心纪律含逐项交付与即修/追踪（不以摘要或建议收尾）", !!coreEntry && coreEntry.value.includes("不得以摘要代替") && coreEntry.value.includes("建议后续"));
    // 恰好一处：entry 可用时不得再走 system 兜底（防重复注入）。
    check("UT-src-index-05 纪律只注入一处（entry 可用时 system 不重复）", !!coreEntry && sysHasDiscipline === false);

    const srcIndex = readFileSync(join(pluginDir, "src", "index.ts"), "utf8");
    check("UT-src-index-05 已退役正文哨兵 <!--ddd:core-->（不再写 ev.prompt.text）", !/prompt\.text\s*=/.test(srcIndex) && !/<!--ddd:core-->/.test(srcIndex));
    // instructions.entry 的 key 约束（宿主）：^[a-z0-9][a-z0-9._-]*$ → 不含冒号。
    // 2.0.0: instructions keys live at their owning context/dispatch boundaries.
    const injectionSources = ["src/lib/context-service.ts", "src/lib/command-dispatcher.ts"].map((f) => readFileSync(join(pluginDir, f), "utf8")).join("\n");
    const entryKeys = [...injectionSources.matchAll(/key:\s*["'](ddd\.[a-z0-9._-]+)["']/g)].map((m) => m[1]);
    check("UT-src-index-05 instructions.entry 键名合法（无冒号，匹配宿主正则）", entryKeys.length > 0 && entryKeys.every((k) => /^[a-z0-9][a-z0-9._-]*$/.test(k)), entryKeys.join(","));
  }

  // Q3 派发（裁决 16）：默认同会话；仅 review/validate/consolidate 建子会话（且带 parentID）。
  {
    const dispatchOf = {};
    for (const c of (readJson("assets/commands.json")?.commands ?? [])) dispatchOf[c.name] = c.dispatch ?? "same";
    const isolated = Object.entries(dispatchOf).filter(([, d]) => d === "isolated").map(([n]) => n).sort();
    const expectIsolated = ["ddd-consolidate", "ddd-review", "ddd-validate"];
    check("UT-src-index-02 Q3 隔离例外恰为 review/validate/consolidate", JSON.stringify(isolated) === JSON.stringify(expectIsolated), isolated.join(","));
    check("UT-src-index-02 Q3 隔离命令建子会话（session.create + switchAgent）", registrations.created.length === expectIsolated.length && registrations.switched.length === expectIsolated.length && registrations.created.every((c) => typeof c.agent === "string"));
    check("UT-src-index-02 Q3 子会话带 parentID（非顶层新会话）", registrations.created.every((c) => typeof c.parentID === "string" && c.parentID.length > 0));
  }

  // M13 相位读写同键（DEF：写 ddd.phase.<sid> 而读 ddd:phase:<sid> → 相位切片静默失效）
  {
    check("UT-src-index-06 相位读写同键（storage 含 ddd:phase:<sid>）", storage.has("ddd:phase:ses_mock"), [...storage.keys()].filter((k) => /phase/.test(k)).join(","));
    check("UT-src-index-06 相位键无遗留形态（ddd.phase.<sid> 不复存在）", ![...storage.keys()].some((k) => /^ddd\.phase\./.test(k)));
  }

  // 同会话路径：角色约束与切片全文指针须显式进入指令（角色 md 不自动入上下文）
  {
    const withRole = registrations.prompts.map((p) => String(p?.text ?? ""));
    const designer = withRole.find((t) => t.includes("角色=ddd-designer"));
    check("UT-src-index-07 同会话指令投影角色约束（〖硬约束〗块）", !!designer && designer.includes("〖硬约束") && designer.includes("凭空发明"));
    check("UT-src-index-07 同会话指令含切片全文指针", !!designer && /先读纪律切片/.test(designer) && /skills\/ddd-methodology\//.test(designer));
    check("UT-src-index-07 指令尾置执行前自检（END 区）", !!designer && designer.trimEnd().endsWith("未改设计件不得改代码。"));
    const noRole = withRole.find((t) => t.startsWith("[ddd/ddd-init]"));
    check("UT-src-index-07 无角色命令不产硬约束块（不发明）", !!noRole && !noRole.includes("〖硬约束"));
  }

  if (registrations.rpc) {
    try {
      const g = await registrations.rpc.handlers.gates({}, { signal: new AbortController().signal, error: () => ({}) });
      check("RPC gates 返回 readings", Array.isArray(g?.readings));
      const b = await registrations.rpc.handlers.board({}, { signal: new AbortController().signal, error: () => ({}) });
      check("RPC board 返回摘要", b && typeof b.pending === "number");
    } catch (e) { check("RPC handler 可跑通", false, e?.message ?? String(e)); }
  }
  if (typeof cleanup === "function") {
    try { await cleanup(); check("cleanup 可运行", true); }
    catch (e) { check("cleanup 可运行", false, e?.message ?? String(e)); }
  }

  // ============ 2. 纯函数断言 ============
  group("纯函数：registry");
  check("UT-src-lib-registry-01 导出面齐全", typeof lib.registry.registrations === "function" && Array.isArray(lib.registry.COMMANDS) && Array.isArray(lib.registry.SKILLS) && typeof lib.registry.auditRegistrations === "function");
  check("UT-src-lib-registry-02 自检合格（前缀/去重/描述）", lib.registry.auditRegistrations().length === 0, lib.registry.auditRegistrations().join("; "));
  check("UT-src-lib-registry-03 非法输入报错而非沉默", lib.registry.auditRegistrations({ commands: [{ name: "bad", description: "" }], skills: [] }).length > 0);

  group("纯函数：paths");
  {
    const pr = lib.paths.packageRoot();
    check("UT-src-lib-paths-01 导出面齐全", typeof lib.paths.projectRoot === "function" && typeof lib.paths.packagePath === "function" && typeof lib.paths.projectPath === "function" && typeof lib.paths.within === "function");
    check("UT-src-lib-paths-02 packagePath 相对包根", lib.paths.packagePath("assets/board.json").startsWith(pr));
    let threw = false;
    try { lib.paths.projectRoot(undefined); } catch { threw = true; }
    check("UT-src-lib-paths-03 缺 directory 抛错（不回落）", threw);
    check("UT-src-lib-paths-03 within 判定", lib.paths.within(pr, lib.paths.packagePath("src/index.ts")) === true && lib.paths.within(pr, resolve(pr, "..")) === false);
  }

  group("纯函数：gates");
  {
    const g = lib.gates;
    check("UT-src-lib-gates-01 导出面齐全", typeof g.gates?.G1 === "function" && typeof g.summarize === "function" && typeof g.canAdvance === "function");
    const pass = g.gates.G1({ requirements: { frozen: true, openRulings: 0 } });
    check("UT-src-lib-gates-02 正常路径 pass", pass.verdict === "pass");
    const na = g.gates.G1({});
    check("UT-src-lib-gates-03 无判定对象 → na（不判 pass）", na.verdict === "na");
    const block = g.gates.G1({ requirements: { frozen: false, openRulings: 1 } });
    check("UT-src-lib-gates-03 block 带 remedy", block.verdict === "block" && !!block.remedy);
    check("UT-src-lib-gates-02 自省字段齐备", typeof pass.examined === "number" && typeof pass.unrecognized === "number");
    check("UT-src-lib-gates-02 canAdvance 依 block 判定", g.canAdvance([pass, na]) === true && g.canAdvance([block]) === false);
  }

  group("纯函数：router");
  {
    const r = lib.router;
    const slices = [{ id: "core", source: "a", when: {} }, { id: "design", source: "b", when: { phase: "design" } }];
    check("UT-src-lib-router-01 导出面齐全", typeof r.routeSlices === "function" && typeof r.detectIntent === "function");
    const out = r.routeSlices({ phase: "design" }, slices);
    check("UT-src-lib-router-02 命中相位选切片", out.sliceIds.includes("design") && out.sliceIds.includes("core"));
    check("UT-src-lib-router-02 判定可观测 basis", out.basis.phase === "design" && typeof out.basis.matched === "number");
    const out2 = r.routeSlices({ phase: "intent" }, slices);
    check("UT-src-lib-router-03 未命中只留常驻", out2.sliceIds.length === 1 && out2.sliceIds[0] === "core");
    check("UT-src-lib-router-02 detectIntent bugfix", r.detectIntent("修复这个 bug") === "bugfix");
    // 角色约束只读投影（单点权威在 agents/<role>.md；此处只提取，不复制）
    const md = "# 职责\n\n有事。\n\n# 约束\n\n- 只在 `docs/ddd/**` 写。\n- **不得**凭空发明。\n\n# 输出\n\n- 件。\n";
    const cs = r.roleConstraints(md);
    check("UT-src-lib-router-04 角色约束提取（仅「约束」节，别节不混入）", cs.length === 2 && cs[0].includes("只在") && cs[1].includes("不得") && !cs.some((c) => c.includes("有事")));
    check("UT-src-lib-router-04 无「约束」节 → 空（不发明）", r.roleConstraints("# 职责\n\nx\n").length === 0);
    const sl = [{ id: "core", source: "skills/core.md", when: {} }, { id: "d", source: "skills/d.md", when: { phase: "design" } }, { id: "d2", source: "skills/d.md", when: { phase: "design" } }];
    check("UT-src-lib-router-05 切片来源去重且可解析", JSON.stringify(r.sliceSources(["core", "d", "d2"], sl)) === JSON.stringify(["skills/core.md", "skills/d.md"]));
    check("UT-src-lib-router-05 未命中的 id 忽略", r.sliceSources(["nope"], sl).length === 0);
  }

  group("纯函数：guard");
  {
    const gu = lib.guard;
    const bl = [{ id: "BL1", surface: "permission", action: "edit", resource: "docs/CHANGELOG.jsonl", effect: "deny", failSemantics: "block", remedy: "只经唯一工具" }];
    check("UT-src-lib-guard-01 导出面齐全", typeof gu.evaluateBottomLines === "function" && typeof gu.assertEnforceable === "function");
    check("UT-src-lib-guard-02 命中 → block 带 remedy", gu.evaluateBottomLines(bl, { observed: { BL1: { examined: 1, unrecognized: 0, hits: 1 } } })[0].verdict === "block");
    check("UT-src-lib-guard-02 零命中 → pass", gu.evaluateBottomLines(bl, { observed: { BL1: { examined: 1, unrecognized: 0, hits: 0 } } })[0].verdict === "pass");
    check("UT-src-lib-guard-03 无观测 → na（不判 pass）", gu.evaluateBottomLines(bl, {})[0].verdict === "na");
    const bad = gu.assertEnforceable([{ id: "BLx", effect: "deny", remedy: "" }]);
    check("UT-src-lib-guard-03 无执法点被拦", bad.length > 0);
  }

  group("纯函数：memory");
  {
    const m = lib.memory;
    const cfg = readJson("assets/memory.json");
    check("UT-src-lib-memory-01 星级 1–5 单调", m.computeConfidence(1) >= 1 && m.computeConfidence(8) <= 5 && m.computeConfidence(8) >= m.computeConfidence(1));
    const e = { id: "M1", kind: "record", type: "pitfall", scope: "s", key: "k", occurrences: 5, confidence: 5, consistency: 0.9 };
    check("UT-src-lib-memory-02 阈值读 assets（不内置）", m.shouldRemind(e, cfg) === true && m.shouldPromote(e, cfg) === true);
    const d = m.decay({ ...e, confidence: 1 }, cfg);
    check("UT-src-lib-memory-03 低于 1★ 转 archived", d.archived === true);
    check("UT-src-lib-memory-03 未再现降星", m.decay({ ...e, confidence: 3 }, cfg).confidence === 3 - cfg.decayPerSession);
    check("UT-src-lib-memory-04 scope 隔离", m.projectScope("C:/a/proj") === "proj");
    const inj = m.selectInjection([e, { ...e, id: "M2", scope: "other" }], "s", cfg);
    check("UT-src-lib-memory-04 仅注入同 scope", inj.every((x) => x.scope === "s"));
    check("UT-src-lib-memory-05 幂等去重键", m.occurrenceDedupKey("s", "k", "ses", 1) === m.occurrenceDedupKey("s", "k", "ses", 1));
  }

  group("纯函数：board");
  {
    const b = lib.board;
    const cfg = readJson("assets/board.json");
    const rows = [
      { kind: "task", ts: "2026-01-01T00:00:00Z", taskId: "A", reqId: "R1", title: "a", acceptance: "x", priority: "P2", status: "pending", dependsOn: [], seq: 2 },
      { kind: "task", ts: "2026-01-01T00:00:00Z", taskId: "B", reqId: "R1", title: "b", acceptance: "x", priority: "P0", status: "pending", dependsOn: [], seq: 1 },
      { kind: "task", ts: "2026-01-01T00:00:00Z", taskId: "C", reqId: "R1", title: "c", acceptance: "x", priority: "P1", status: "pending", dependsOn: ["B"], seq: 3 },
      { kind: "archive", ts: "2026-01-01T00:00:00Z", taskId: "D", seq: 5 },
      { kind: "task", ts: "2026-01-01T00:00:00Z", taskId: "D", reqId: "R1", title: "d", acceptance: "x", priority: "P3", status: "pending", dependsOn: [], seq: 4 },
    ];
    const proj = b.project(rows);
    check("UT-src-lib-board-01 投影按 priority 升序", proj[0].taskId === "B");
    check("UT-src-lib-board-02 剔除 archive", !proj.find((x) => x.taskId === "D"));
    check("UT-src-lib-board-02 剔除前驱未满足", !proj.find((x) => x.taskId === "C"));
    check("UT-src-lib-board-03 缺 acceptance → 拒", b.admit({ kind: "task", ts: "", taskId: "E", acceptance: "" }, proj, cfg).ok === false);
    check("UT-src-lib-board-03 priority 越域 → 拒", b.admit({ kind: "task", ts: "", taskId: "E", acceptance: "x", priority: "P9" }, proj, cfg).ok === false);
    check("UT-src-lib-board-04 非法转移拒", b.canTransition("in_progress", "pending") === false && b.canTransition("pending", "in_progress") === true);
    check("UT-src-lib-board-05 反饥饿超限缺 reason 拒", b.admit({ kind: "task", ts: "", taskId: "F", acceptance: "x", priority: "P3", seq: 99 }, Array.from({ length: 9 }, (_, i) => ({ taskId: `X${i}`, reqId: null, title: "", acceptance: "x", priority: "P0", status: "pending", dependsOn: [], seq: i, ts: "2026-01-01T00:00:00Z" })), cfg).ok === false);
    const orphan = b.detectOrphans([{ taskId: "O", reqId: "R", title: "", acceptance: "x", priority: "P2", status: "in_progress", dependsOn: [], seq: 1, ts: "2000-01-01T00:00:00Z" }], new Date("2026-01-02T00:00:00Z"), cfg);
    check("UT-src-lib-board-06 孤儿检测列提示（非失败）", orphan.length === 1);
    check("UT-src-lib-board-07 收尾投影非空不得过", b.wrapupVerdict(proj, cfg).verdict === "block");
  }

  group("纯函数：shell-encoding");
  {
    const se = lib.shellEncoding;
    check("UT-src-lib-shell-encoding-01 导出面齐全", typeof se.isPowerShellShell === "function" && typeof se.powershellEncodingPrefix === "function" && typeof se.applyEncodingPrefix === "function");
    check("UT-src-lib-shell-encoding-02 判定 PowerShell（大小写不敏感）", se.isPowerShellShell("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.EXE") === true && se.isPowerShellShell("C:/Program Files/PowerShell/7/pwsh.exe") === true);
    check("UT-src-lib-shell-encoding-03 判定非 PowerShell", se.isPowerShellShell("/bin/bash") === false && se.isPowerShellShell("/bin/zsh") === false && se.isPowerShellShell("") === false && se.isPowerShellShell(undefined) === false);
    const pfx = se.powershellEncodingPrefix();
    check("UT-src-lib-shell-encoding-04 前缀无输出噪音", !/\bWrite-|echo|Out-Host/.test(pfx) && !/^\s*"/.test(pfx));
    check("UT-src-lib-shell-encoding-05 前缀设 UTF-8", /OutputEncoding/.test(pfx) && /UTF8/.test(pfx));
    check("UT-src-lib-shell-encoding-06 幂等标记", pfx.includes(se.ENCODING_MARKER) && se.hasEncodingPrefix(pfx) === true);
    // 幂等 + 仅 PowerShell + 可关
    check("UT-src-lib-shell-encoding-06 仅 PowerShell 注入", se.applyEncodingPrefix("/bin/bash", "echo hi", true) === "echo hi");
    check("UT-src-lib-shell-encoding-06 可关（disabled 不注入）", se.applyEncodingPrefix("powershell.exe", "echo hi", false) === "echo hi");
    check("UT-src-lib-shell-encoding-06 幂等（已含前缀不重复）", se.applyEncodingPrefix("powershell.exe", pfx + "\necho hi", true) === pfx + "\necho hi");
    const injected = se.applyEncodingPrefix("powershell.exe", "echo hi", true);
    check("UT-src-lib-shell-encoding-02 PowerShell 注入前缀且保留原命令", injected.includes("echo hi") && injected.startsWith("[Console]::OutputEncoding"));
  }

  group("纯函数：powershell-bom");
  {
    const pb = lib.powershellBom;
    check("UT-src-lib-powershell-bom-01 导出面齐全", typeof pb.isPowerShellScript === "function" && typeof pb.hasUtf8Bom === "function" && typeof pb.needsUtf8Bom === "function" && typeof pb.withUtf8Bom === "function");
    check("UT-src-lib-powershell-bom-02 仅 .ps1", pb.isPowerShellScript("a.ps1") === true && pb.isPowerShellScript("A.PS1") === true && pb.isPowerShellScript("a.js") === false && pb.isPowerShellScript("a.json") === false && pb.isPowerShellScript("a") === false);
    check("UT-src-lib-powershell-bom-03 含非 ASCII 才需", pb.needsUtf8Bom("a.ps1", "Write-Output 'ascii'") === false && pb.needsUtf8Bom("a.ps1", "Write-Output '中文'") === true);
    check("UT-src-lib-powershell-bom-03 非 .ps1 不处理", pb.needsUtf8Bom("a.js", "const s='中文'") === false);
    const withBom = pb.withUtf8Bom("中文");
    check("UT-src-lib-powershell-bom-05 加 BOM 形态（首字符 U+FEFF）", withBom.charCodeAt(0) === 0xfeff && withBom.length === "中文".length + 1);
    check("UT-src-lib-powershell-bom-04 幂等（已有 BOM 不再加）", pb.withUtf8Bom(withBom) === withBom && pb.hasUtf8Bom(withBom) === true && pb.needsUtf8Bom("a.ps1", withBom) === false);
  }

  // ============ 3. assets 基线 ============
  group("assets 基线");
  const commands = readJson("assets/commands.json");
  check("UT-assets-commands-01 schema 合法", !!commands && Array.isArray(commands.commands));
  check("UT-assets-commands-02 与运行期投影一致（单点权威）", commands && commands.commands.length === lib.registry.COMMANDS.length && commands.commands.every((c, i) => c.name === lib.registry.COMMANDS[i].name));
  const gatesJson = readJson("assets/gates.json");
  check("UT-assets-gates-01 schema 合法（6 道门禁）", gatesJson?.gates?.length === 6);
  check("UT-assets-gates-02 对接规范七字段 + ext（R28/裁决 3a）", gatesJson.gates.every((g) => ["id", "scope", "executor", "readingShape", "criterion", "failSemantics", "inNodeSource"].every((k) => k in g)));
  const rulesJson = readJson("assets/rules.json");
  check("UT-assets-rules-01 schema 合法", Array.isArray(rulesJson?.rules));
  check("UT-assets-rules-02 每条规则有落点三态之一", rulesJson.rules.every((r) => ["permission", "session", "evaluate"].includes(r.surface)));
  const memoryJson = readJson("assets/memory.json");
  check("UT-assets-memory-01 schema 合法（门槛齐备）", memoryJson && typeof memoryJson.remindAt === "number" && typeof memoryJson.promoteAt === "number" && Array.isArray(memoryJson.redlines));
  const blJson = readJson("assets/bottom-lines.json");
  check("UT-assets-bottom-lines-01 schema 合法", Array.isArray(blJson?.bottomLines));
  check("UT-assets-bottom-lines-02 每条底线有执法点 + remedy", lib.guard.assertEnforceable(blJson.bottomLines).length === 0);
  const roleToolsJson = readJson("assets/role-tools.json");
  check("UT-assets-role-tools-01 schema 合法（角色→工具数组）", roleToolsJson?.roles && Object.values(roleToolsJson.roles).every(Array.isArray));
  check("UT-assets-role-tools-02 只读角色无写工具", ["ddd-design-reviewer", "ddd-auditor", "ddd-intent-clarifier", "ddd-ui-diff"].every((r) => (roleToolsJson.roles[r] ?? []).every((t) => !["write", "edit", "shell"].includes(t))));
  const boardJson = readJson("assets/board.json");
  check("UT-assets-board-01 schema 合法", boardJson && ["priorityDomain", "statusDomain", "starvationWindow", "starvationLimit", "orphanHours", "maxLineBytes"].every((k) => k in boardJson));
  check("UT-assets-board-03 defaultPriority ∈ priorityDomain", boardJson.priorityDomain.includes(boardJson.defaultPriority));
  const profilesJson = readJson("assets/profiles.json");
  check("UT-assets-profiles-01 schema 合法（minimal/standard/strict）", profilesJson?.profiles?.minimal && profilesJson.profiles.standard && profilesJson.profiles.strict);
  check("UT-assets-injection-slices-01 schema 合法", Array.isArray(readJson("assets/injection-slices.json")?.slices));
  const langJson = readJson("assets/languages.json");
  check("UT-assets-languages-01 schema 合法（≥12 语言）", langJson?.languages?.length >= 12);
  check("UT-assets-variant-contract-schema-01 schema 合法（五维）", (readJson("assets/variant-contract-schema.json")?.properties?.dimensions?.minItems) === 5);

  // 版本一致性（R31 + 发布约定）：package.json / package-lock.json 根字段 / 最新 CHANGELOG 组同号。
  {
    const pkg = readJson("package.json");
    const lock = readJson("package-lock.json");
    const lockRoot = lock?.packages?.[""]?.version;
    check("UT-scripts-selftest-03 package-lock 根版本与 package.json 一致（发布须同步锁文件）", !lock || (lock.version === pkg.version && lockRoot === pkg.version), `pkg=${pkg?.version} lock=${lock?.version}/${lockRoot}`);
    const chgPath = join(pluginDir, "docs", "CHANGELOG.jsonl");
    if (existsSync(chgPath)) {
      const rows = readFileSync(chgPath, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
      const last = rows[rows.length - 1];
      const want = `v${pkg.version}`;
      check("UT-scripts-selftest-04 最新变更流记录版本 = package.json 版本（三处一致）", !last || last.version === want, `changelog=${last?.version} pkg=${want}`);
    }
  }

  // ============ 4. 内容层契约 ============
  group("内容层契约");
  const designAgents = readFileSync(join(pluginDir, "docs/ddd/agents/DESIGN.md"), "utf8");
  // 仅从「角色清单」表的第一列提取角色（避免把命令名/其它反引号误当角色）。
  const roles = [...new Set([...designAgents.matchAll(/^\|\s*`(ddd-[a-z][a-z-]*)`\s*\|/gm)].map((m) => m[1]))];
  const readOnly = ["ddd-design-reviewer", "ddd-auditor", "ddd-intent-clarifier", "ddd-ui-diff"];
  let rolesOk = true;
  for (const r of roles) {
    const p = join(pluginDir, "agents", `${r}.md`);
    if (!existsSync(p)) { rolesOk = false; failures.push(`缺角色件 ${r}.md`); continue; }
    const t = readFileSync(p, "utf8");
    if (!/^description:\s*.+/m.test(t) || !/^mode:\s*subagent$/m.test(t)) { rolesOk = false; failures.push(`${r}: frontmatter 非法`); }
    if (!["职责", "输入面", "输出", "约束"].every((s) => t.includes(s))) { rolesOk = false; failures.push(`${r}: 缺必备节`); }
    if (!roleToolsJson.roles[r]) { rolesOk = false; failures.push(`${r}: role-tools 缺条目`); }
  }
  check(`UT-agents-* 角色齐备且契约一致（${roles.length}）`, rolesOk);
  check("UT-assets-role-tools-03 角色↔role-tools 双向一致", roles.every((r) => !!roleToolsJson.roles[r]));

  const skillFiles = [];
  (function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === "SKILL.md") skillFiles.push(p); } })(join(pluginDir, "skills"));
  let skillOk = true;
  for (const p of skillFiles) {
    const t = readFileSync(p, "utf8");
    if (!/^name:\s*.+/m.test(t) || !/^description:\s*.+/m.test(t)) { skillOk = false; failures.push(`${p}: 缺 frontmatter`); }
  }
  check(`UT-skills-* SKILL.md frontmatter 合法（${skillFiles.length}）`, skillOk);

  // ============ 5. 看板唯一写入器（scripts/board.mjs 端到端）============
  group("唯一写入器：board.mjs");
  await boardChecks(pluginDir);

  // ============ 6. 机械件（snapshot/change/map/drift-check/defects/validate）============
  group("机械件：snapshot/change/map/drift-check/defects/validate");
  await toolChecks(pluginDir);

  // ============ 7. 反证（R25：判据在反证下不沉默）============
  group("反证：counterexamples");
  await counterexampleChecks(pluginDir, lib);

  // ============ 7b. TUI part（结构级：§9.5 分职责）============
  group("TUI：src/tui.tsx（结构级）");
  {
    const p = join(pluginDir, "src", "tui.tsx");
    const t = existsSync(p) ? readFileSync(p, "utf8") : "";
    check("UT-src-tui-01 tui part 存在且 Plugin.define（id: ddd）", /from\s+["']@opencode\/plugin\/tui["']/.test(t) && /Plugin\.define\(\{[\s\S]*?id:\s*["']ddd["']/.test(t));
    check("UT-src-tui-04 §9.5 分职责：dialog 仅做输入采集（select/prompt）", /dialog\.(select|prompt)\(/.test(t) && !/dialog\.confirm\(/.test(t));
    check("UT-src-tui-05 取消语义：dialog 返回 undefined 不直接中止（显式处理）", /undefined/.test(t) && /toast\.show\(/.test(t));
    check("UT-src-tui-06 keymap 工厂为纯函数形态（layer(() => ({...}))）", /keymap\.layer\(\(\)\s*=>\s*\(\{/.test(t));
    check("UT-src-tui-02 经 RPC 调 server（client.rpc(Ddd)）", /client\.rpc\(Ddd\)/.test(t));
  }

  // ============ 7b2. §8.7 / C-43 守卫：禁用 process.execPath 启动子进程 ============
  group("路径纪律：§8.7 / C-43（禁用 process.execPath 启动脚本）");
  {
    const roots = ["src", "scripts"];
    const offenders = [];
    for (const r of roots) {
      const dir = join(pluginDir, r);
      if (!existsSync(dir)) continue;
      (function walk(d) {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const p = join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (/\.(ts|tsx|mjs)$/.test(e.name)) {
            const src = readFileSync(p, "utf8");
            // 关注「用 execPath 作为 spawn 的可执行文件」这一形态
            if (/spawn\w*\(\s*process\.execPath/.test(src)) offenders.push(p.replace(pluginDir + "\\", "").replace(pluginDir + "/", ""));
          }
        }
      })(dir);
    }
    check("UT-src-index-04 §8.7/C-43 禁用 process.execPath 启动脚本（须 node 具名）", offenders.length === 0, offenders.join(", "));
  }

  // ============ 7c. 物化 / 骨架（F5 / F7）============
  group("物化与骨架：materialize.mjs / scaffold.mjs");
  {
    const { spawnSync } = await import("node:child_process");
    const { existsSync: ex, readdirSync: rd } = await import("node:fs");
    const os = await import("node:os");
    const tmp = mkTmp("ddd-tools-");
    const run = (name, args, root) => spawnSync("node", ["--experimental-strip-types", join(pluginDir, "scripts", name), ...args, "--root", root], { encoding: "utf8" });

    // materialize:agents
    const m1 = run("materialize.mjs", ["agents"], tmp);
    const dst = join(tmp, ".opencode", "agents");
    const n1 = ex(dst) ? rd(dst).filter((f) => f.endsWith(".md")).length : 0;
    check("UT-scripts-materialize-01 物化 agents（数量一致）", m1.status === 0 && n1 >= 10, `实为 ${n1}`);
    check("UT-scripts-materialize-03 包根/项目根分离（写在项目根下）", ex(join(tmp, ".opencode", "agents", "ddd-auditor.md")));
    const m2 = run("materialize.mjs", ["agents"], tmp);
    check("UT-scripts-materialize-02 幂等（二次全跳过）", m2.status === 0 && /跳过\s*\d+/.test(m2.stdout));

    // scaffold
    const s1 = run("scaffold.mjs", [], tmp);
    check("UT-scripts-scaffold-01 骨架落点齐备（三件 + docs/）", s1.status === 0 && ["AGENTS.md", "README.md", "CONTRIBUTING.md"].every((f) => ex(join(tmp, f))) && ex(join(tmp, "docs", "GLOSSARY.md")));
    check("UT-scripts-scaffold-04 物化联动（.opencode/agents 齐备）", ex(join(tmp, ".opencode", "agents", "ddd-consolidator.md")));
    const s2 = run("scaffold.mjs", [], tmp);
    check("UT-scripts-scaffold-02 幂等（二次不覆盖）", s2.status === 0 && /跳过\s*\d+/.test(s2.stdout));
    // R12：第四件根文档 → 报错
    const tmpR = mkTmp("ddd-r12-");
    const { writeFileSync: wf2 } = await import("node:fs");
    wf2(join(tmpR, "EXTRA.md"), "x", "utf8");
    const s3 = run("scaffold.mjs", [], tmpR);
    check("UT-scripts-scaffold-03 根文档白名单（第四件 → 退出 1，R12）", s3.status === 1);
  }

  // ============ 7c2. 派生报告幂等写入（DEF-0013）============
  group("幂等报告：report-io.mjs");
  {
    const { writeFileSync: wf2, readFileSync: rf2, existsSync: ex2, mkdirSync: mk2 } = await import("node:fs");
    const tmp = mkTmp("ddd-reportio-");
    const rio = await import(pathToFileURL(join(pluginDir, "scripts", "report-io.mjs")).href);
    const out = join(tmp, "docs", "reports", "x.json");
    const a = rio.writeReportJson(out, { ts: "2026-01-01T00:00:00Z", v: 1 });
    check("UT-scripts-report-io-01 首写落盘", a === true && ex2(out));
    const before = rf2(out, "utf8");
    const b = rio.writeReportJson(out, { ts: "2026-02-02T00:00:00Z", v: 1 });
    check("UT-scripts-report-io-02 内容不变保留 ts（返回 false、文件不变）", b === false && rf2(out, "utf8") === before && rf2(out, "utf8").includes("2026-01-01"));
    const c = rio.writeReportJson(out, { ts: "2026-02-02T00:00:00Z", v: 2 });
    check("UT-scripts-report-io-03 内容变化更新（返回 true）", c === true && rf2(out, "utf8").includes("\"v\": 2"));
    const outM = join(tmp, "docs", "reports", "y.md");
    mk2(join(tmp, "docs", "reports"), { recursive: true });
    wf2(outM, "same", "utf8");
    check("UT-scripts-report-io-04 文本幂等（同内容返回 false）", rio.writeReportText(outM, "same") === false);
    // 可复算：同输入连跑两次逐字节相同
    const out2 = join(tmp, "docs", "reports", "z.json");
    rio.writeReportJson(out2, { ts: "T", v: 1 });
    const s1 = rf2(out2, "utf8");
    rio.writeReportJson(out2, { ts: "T2", v: 1 });
    check("UT-scripts-report-io-05 可复算（同输入两次逐字节相同）", rf2(out2, "utf8") === s1);
  }

  // ============ 8. 自测入口自身（退出码语义）============
  group("自测入口：selftest.mjs");
  {
    const { spawnSync } = await import("node:child_process");
    const { writeFileSync: wf, mkdirSync } = await import("node:fs");
    const os = await import("node:os");
    const self = join(pluginDir, "scripts", "selftest.mjs");
    const bad = spawnSync("node", ["--experimental-strip-types", self, join(pluginDir, "__no_such_dir__")], { encoding: "utf8" });
    check("UT-scripts-selftest-02 用法/入口错 → 退出 2", bad.status === 2, `实为 ${bad.status}`);

    // 构造一个「能加载但注册面不合格」的临时插件 → 退出 1
    const fake = mkTmp("ddd-badplugin-");
    mkdirSync(join(fake, "src"), { recursive: true });
    wf(join(fake, "package.json"), JSON.stringify({ name: "bad", type: "module", exports: { ".": "./src/index.ts" } }), "utf8");
    wf(join(fake, "src", "index.ts"), "export default { id: 'nope' };\n", "utf8");
    const fail = spawnSync("node", ["--experimental-strip-types", self, fake], { encoding: "utf8" });
    check("UT-scripts-selftest-02 注册面不合格 → 退出 1", fail.status === 1, `实为 ${fail.status}`);
    check("UT-scripts-selftest-01 注册面断言（本次运行内的所有 check）", true);
  }

  report();
}

async function boardChecks(dir) {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync, readFileSync: rf, appendFileSync, existsSync: ex } = await import("node:fs");
  const os = await import("node:os");
  const board = join(dir, "scripts", "board.mjs");
  if (!ex(board)) { check("board.mjs 存在", false); return; }
  const run = (args, root) => spawnSync("node", ["--experimental-strip-types", board, ...args, "--root", root], { encoding: "utf8" });
  const tmp = mkTmp("ddd-board-");
  const jsonl = join(tmp, "docs", "board", "board.jsonl");

  // 06 无看板：reconcile 退出 0（na，不判通过）
  const r0 = run(["reconcile"], tmp);
  check("UT-scripts-board-06 无看板 reconcile 退出 0（na，不判通过）", r0.status === 0);

  // 04 命令校验：add 缺 acceptance → 退出 1
  const r1 = run(["add", "--title", "T1"], tmp);
  check("UT-scripts-board-04 add 缺 acceptance 拒写（退出 1）", r1.status === 1);

  // 01 append-only：add → move，旧行不变、新行追加
  const r2 = run(["add", "--title", "T2", "--acceptance", "ut passes", "--priority", "P1"], tmp);
  const afterAdd = rf(jsonl, "utf8");
  const tid = (afterAdd.match(/"taskId":"([^"]+)"/) ?? [])[1];
  const r3 = run(["move", "--task", tid, "--to", "in_progress"], tmp);
  const afterMove = rf(jsonl, "utf8");
  check("UT-scripts-board-01 append-only（旧行原样保留，新行追加）", r2.status === 0 && r3.status === 0 && afterMove.startsWith(afterAdd));

  // 04 非法转移拒
  const r4 = run(["move", "--task", tid, "--to", "pending"], tmp);
  check("UT-scripts-board-04 非法转移拒（退出 1）", r4.status === 1);

  // 03 replay --check 一致
  const r5 = run(["replay", "--check"], tmp);
  check("UT-scripts-board-03 派生视图与重放一致", r5.status === 0);

  // 02 手改检出：注入 seq 回退的非法行 → 退出非零
  appendFileSync(jsonl, '{"kind":"move","ts":"2026-01-01T00:00:00Z","taskId":"' + tid + '","from":"done","to":"pending","seq":0}\n', "utf8");
  const r6 = run(["reconcile"], tmp);
  check("UT-scripts-board-02 手改（seq 非单调）检出（退出非零）", r6.status !== 0);

  // 05 无归属收口：reqId:null 未 rehome/drop → reconcile 报出
  const tmp2 = mkTmp("ddd-board2-");
  run(["add", "--title", "T3", "--acceptance", "x"], tmp2);
  const r7 = run(["reconcile"], tmp2);
  check("UT-scripts-board-05 reqId:null 被列为收尾待办", r7.status === 0 && /reqId:null/.test(r7.stdout));
}

async function toolChecks(dir) {
  const { spawnSync } = await import("node:child_process");
  const { writeFileSync: wf, readFileSync: rf, existsSync: ex, mkdirSync } = await import("node:fs");
  const os = await import("node:os");
  const T = (name) => join(dir, "scripts", name);
  const run = (name, args, root) => spawnSync("node", ["--experimental-strip-types", T(name), ...args, "--root", root], { encoding: "utf8" });
  const tmp = mkTmp("ddd-scaffold-");
  mkdirSync(join(tmp, "docs", "ddd", "src"), { recursive: true });
  // 种子：最小设计树（使 snapshot 有判定对象）
  wf(join(tmp, "docs", "ddd", "DESIGN.md"), "---\ndoc: design\nlevel: subproject\ntarget: .\nstatus: frozen\nlanded: true\n---\n# sub\n", "utf8");
  wf(join(tmp, "docs", "ddd", "TESTS-subproject.md"), "---\ndoc: tests\nlevel: subproject\ntarget: .\nstatus: frozen\nlanded: true\n---\n# t\n| ST-x-01 | a | b | 已落地 |\n", "utf8");
  wf(join(tmp, "docs", "ddd", "src", "DESIGN.md"), "---\ndoc: design\nlevel: module\ntarget: src\nstatus: frozen\nlanded: true\n---\n# m\n", "utf8");
  wf(join(tmp, "docs", "ddd", "src", "TESTS-src.md"), "---\ndoc: tests\nlevel: module\ntarget: src\nstatus: frozen\nlanded: true\n---\n# t\n| MT-x-01 | a | b | 已落地 |\n", "utf8");
  wf(join(tmp, "docs", "ddd", "src", "DESIGN-a.md"), "---\ndoc: design\nlevel: file\ntarget: src/a.ts\nstatus: frozen\nlanded: true\n---\n# f\n", "utf8");
  wf(join(tmp, "docs", "ddd", "src", "UNIT-TESTS-a.md"), "---\ndoc: unit-tests\nlevel: file\ntarget: src/a.ts\nstatus: frozen\nlanded: true\n---\n# t\n| UT-src-a-01 | a | b | 已落地 |\n", "utf8");

  // snapshot
  const s1 = run("snapshot.mjs", [], tmp);
  const snap = join(tmp, "docs", "reports", "design-tree.json");
  check("UT-scripts-snapshot-01 快照字段齐备", ex(snap) && ["designs", "tests", "counts", "gaps"].every((k) => k in JSON.parse(rf(snap, "utf8"))));
  check("UT-scripts-snapshot-02 重放一致（--check 通过）", run("snapshot.mjs", ["--check"], tmp).status === 0);
  // 手改快照 → --check 失败
  wf(snap, JSON.stringify({ ...JSON.parse(rf(snap, "utf8")), tampered: true }, null, 2), "utf8");
  check("UT-scripts-snapshot-02 手改快照被检出", run("snapshot.mjs", ["--check"], tmp).status === 1);
  // 03 缺口自省：加一件无测试的文件级设计 → gaps.missingUnitTests 报出
  wf(join(tmp, "docs", "ddd", "src", "DESIGN-b.md"), "---\ndoc: design\nlevel: file\ntarget: src/b.ts\nstatus: frozen\nlanded: true\n---\n# f\n", "utf8");
  run("snapshot.mjs", [], tmp);
  const gaps = JSON.parse(rf(snap, "utf8")).gaps;
  check("UT-scripts-snapshot-03 缺口自省（缺 UNIT-TESTS 入 gaps）", (gaps.missingUnitTests ?? []).some((x) => x.includes("DESIGN-b")));
  // 04 只读权威：snapshot 不改设计件
  const before = rf(join(tmp, "docs", "ddd", "src", "DESIGN-a.md"), "utf8");
  run("snapshot.mjs", [], tmp);
  check("UT-scripts-snapshot-04 只读权威（设计件字节不变）", rf(join(tmp, "docs", "ddd", "src", "DESIGN-a.md"), "utf8") === before);

  // change
  check("UT-scripts-change-01 三字段必填（缺一拒写）", run("change.mjs", ["add", "--rationale", "why"], tmp).status === 1);
  check("UT-scripts-change-01 add 成功", run("change.mjs", ["add", "--rationale", "why", "--out-of-scope", "x", "--expected-signal", "y"], tmp).status === 0);
  check("UT-scripts-change-02 append-only", rf(join(tmp, "docs", "CHANGELOG.jsonl"), "utf8").trim().split(/\r?\n/).length === 1);
  check("UT-scripts-change-04 派生一致", run("change.mjs", ["check"], tmp).status === 0);
  // 03 手改检出：注入非法行 → check 退出 1
  const chg = join(tmp, "docs", "CHANGELOG.jsonl");
  wf(chg, rf(chg, "utf8") + "not-json\n", "utf8");
  check("UT-scripts-change-03 手改（非法行）检出", run("change.mjs", ["check"], tmp).status === 1);

  // map
  check("UT-scripts-map-01 重放产出", run("map.mjs", ["replay"], tmp).status === 0 && ex(join(tmp, "docs", "maps", "MAPS.md")));
  check("UT-scripts-map-02 重放一致", run("map.mjs", ["check"], tmp).status === 0);
  // 04 引用面不可解析：maps.json 放悬空路径 → replay 失败
  wf(join(tmp, "docs", "maps.json"), JSON.stringify({ add: ["docs/definitely/not/here.md"], override: [], disable: [] }), "utf8");
  check("UT-scripts-map-04 引用面不可解析 → 失败（R20 判据④）", run("map.mjs", ["replay"], tmp).status === 1);
  wf(join(tmp, "docs", "maps.json"), JSON.stringify({ add: [], override: [], disable: [] }), "utf8");

  // defects
  check("UT-scripts-defects-01 行契约（add 赋 DEF id）", run("defects.mjs", ["add", "--title", "bug", "--severity", "med"], tmp).status === 0);
  check("UT-scripts-defects-03 派生一致", run("defects.mjs", ["check"], tmp).status === 0);
  // 02 手改检出：注入非法行 → check 退出 1
  const dfx = join(tmp, "docs", "defects.jsonl");
  wf(dfx, rf(dfx, "utf8") + '{"id":"X"}\n', "utf8");
  check("UT-scripts-defects-02 手改（缺字段行）检出", run("defects.mjs", ["check"], tmp).status === 1);

  // drift-check + validate（对真实包根；调用前备份、调用后还原 docs/reports，避免污染本仓）
  const savedReports = {};
  for (const f of ["drift-check.json", "validate.json"]) {
    const p = join(dir, "docs", "reports", f);
    savedReports[p] = ex(p) ? rf(p, "utf8") : null;
  }
  const restoreReports = () => {
    for (const [p, content] of Object.entries(savedReports)) {
      try { if (content === null) rmSync(p, { force: true }); else wf(p, content, "utf8"); } catch { /* best-effort */ }
    }
  };

  const drift = spawnSync("node", ["--experimental-strip-types", T("drift-check.mjs"), "--root", dir], { encoding: "utf8" });
  check("UT-scripts-drift-check-02 权威=实物（零复写）", drift.status === 0);
  const dr = ex(join(dir, "docs", "reports", "drift-check.json")) ? JSON.parse(rf(join(dir, "docs", "reports", "drift-check.json"), "utf8")) : null;
  check("UT-scripts-drift-check-03 阈值不内置（专项检查在册且通过）", !!dr && (dr.checks ?? []).some((c) => c.id === "drift.no-inline-thresholds" && c.ok));

  const v = run("validate.mjs", [], dir);
  const vr = ex(join(dir, "docs", "reports", "validate.json")) ? JSON.parse(rf(join(dir, "docs", "reports", "validate.json"), "utf8")) : null;
  check("UT-scripts-validate-01 读数形态（六条 + summary）", !!vr && Array.isArray(vr.readings) && vr.readings.length === 6 && !!vr.summary);
  check("UT-scripts-validate-02 na ≠ pass", !!vr && vr.readings.some((r) => r.verdict === "na"));
  check("UT-scripts-validate-03 block 带 remedy", !!vr && vr.readings.filter((r) => r.verdict === "block").every((r) => !!r.remedy));
  check("UT-scripts-validate-04 退出码（无 block → 0）", v.status === 0);
  check("UT-scripts-validate-05 G6 核缺陷登记册（R36）", !!vr && typeof vr.defectsRegister === "boolean");
  restoreReports();
}

async function counterexampleChecks(dir, lib) {
  const { readFileSync } = await import("node:fs");
  let ce;
  try { ce = JSON.parse(readFileSync(join(dir, "assets", "counterexamples.json"), "utf8")); } catch { check("UT-assets-counterexamples-01 schema 合法", false); return; }
  check("UT-assets-counterexamples-01 schema 合法", Array.isArray(ce.counterexamples) && ce.counterexamples.every((c) => c.id && c.criterion && c.inject !== undefined));
  check("UT-assets-counterexamples-02 成对报告（≥ 机械判据数）", ce.counterexamples.length >= 8);

  // 反证注入：判据在反证下不沉默（R25）
  let notSilent = 0;
  const cfg = { priorityDomain: ["P0", "P1", "P2", "P3"], defaultPriority: "P2", statusDomain: ["pending", "in_progress", "blocked", "done", "dropped"], starvationWindow: 8, starvationLimit: 3, orphanHours: 24, maxLineBytes: 8192 };
  if (lib.board.admit({ kind: "task", ts: "", taskId: "X", acceptance: "" }, [], cfg).ok === false) notSilent++;
  if (lib.board.admit({ kind: "task", ts: "", taskId: "X", acceptance: "a", priority: "P9" }, [], cfg).ok === false) notSilent++;
  if (lib.board.canTransition("in_progress", "pending") === false) notSilent++;
  if (lib.gates.gates.G1({}).verdict === "na") notSilent++;
  if (lib.guard.assertEnforceable([{ id: "z", effect: "deny", remedy: "" }]).length > 0) notSilent++;
  if (lib.registry.auditRegistrations({ commands: [{ name: "bad", description: "" }], skills: [] }).length > 0) notSilent++;
  if (lib.gates.gates.G5({ landings: { items: [{ id: "a", existsBytes: 3, schemaValid: true, whitelisted: true }] } }).verdict === "block") notSilent++;
  if (lib.board.wrapupVerdict([{ taskId: "A", reqId: "R", title: "", acceptance: "x", priority: "P2", status: "pending", dependsOn: [], seq: 1, ts: "" }], cfg).verdict === "block") notSilent++;
  check(`UT-assets-counterexamples-03 判据在反证下不沉默（${notSilent}/8）`, notSilent === 8);
}

function report() {
  if (verbose) for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
  const passed = checks.length - failures.length;
  console.log(`\nddd selftest: ${passed}/${checks.length} passed`);
  if (failures.length) {
    for (const f of failures) console.error(`  FAIL ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(`selftest 内部错误：${e?.stack ?? e}`);
  process.exit(2);
});
