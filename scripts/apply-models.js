#!/usr/bin/env node
/**
 * 目标：把 profiles/models.json 的按代理模型配比应用到用户设置，并在应用前对活注册表校验。
 * 范围：读写 ~/.pi/agent/settings.json 的 subagents.agentOverrides，与应用记录文件。
 * 不包含：agent 定义文件的改写。模型名属部署政策，不写入 agent 定义。
 *
 * 用法：
 *   node apply-models.js apply <profile> [--provider <p>] [--set name=model ...] [--skip-verify] [--repo <根>]
 *   node apply-models.js verify <profile> [--repo <根>]
 *   node apply-models.js clear
 *   node apply-models.js list
 *   node apply-models.js status
 *
 * 设计取舍：注册表里存在的模型不一定可用，实测出现返回空内容的实例，
 * 故应用前默认以最小请求冒烟验证，实测不可用的模型一律跳过并告警，不写入无法验证的声明。
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const PI_HOME = path.join(os.homedir(), ".pi", "agent");
const SETTINGS = path.join(PI_HOME, "settings.json");
const MODELS = path.join(PI_HOME, "models.json");
const RECORD = path.join(PI_HOME, ".ddd-model-overrides.json");

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return fallback;
  }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

// 收集活注册表中的模型，用于校验；返回 provider/id 与裸 id 两个集合
function registry() {
  const j = readJson(MODELS, {});
  const byId = new Set();
  const bare = new Set();
  for (const [provider, cfg] of Object.entries(j.providers || {})) {
    for (const m of cfg.models || []) {
      const id = typeof m === "string" ? m : m.id || m.name;
      if (!id) continue;
      byId.add(`${provider}/${id}`);
      bare.add(id);
    }
  }
  return { byId, bare };
}

function resolveProfile(repoRoot, name) {
  const file = path.join(repoRoot, "profiles", "models.json");
  const j = readJson(file, null);
  if (!j) {
    console.error(`[错误] 缺少或无法解析 ${file}`);
    process.exit(1);
  }
  if (!name || !j.profiles[name]) {
    console.error(`[错误] 未知配比 ${name || "（未指定）"}，可用：${Object.keys(j.profiles).join("、")}`);
    process.exit(1);
  }
  return { provider: j.provider, profile: j.profiles[name], all: Object.keys(j.profiles) };
}

// 最小请求冒烟：验证模型确实返回内容，并记录首字延迟，供配比选择与排障使用
async function smoke(provider, model) {
  const cfg = readJson(MODELS, null);
  const pc = cfg && cfg.providers && cfg.providers[provider];
  if (!pc) return { ok: false, reason: `未找到 provider ${provider}` };
  const url = String(pc.baseUrl).replace(/\/$/, "") + "/chat/completions";
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + pc.apiKey },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "只回复两个字：可以" }], max_tokens: 2000 }),
    });
    const ms = Date.now() - t0;
    const j = await r.json().catch(() => ({}));
    const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    const used = (j.usage && j.usage.completion_tokens) || null;
    if (r.status !== 200) return { ok: false, ms, reason: `HTTP ${r.status}` };
    // 空内容判定为不可用；预算须放宽，推理模型会把小预算耗尽在推理上而不产出内容
    if (!text) return { ok: false, ms, used, reason: "返回空内容" };
    return { ok: true, ms, used };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, reason: e.message };
  }
}

// 代理名清单的唯一来源：脚本所在仓库根下 agents/ddd-*.md 的文件名集合，不再内联第二份名单。
// 该目录随本方法论安装，与被应用项目无关，故取自 __dirname 而非 --repo。
// 读不到目录或目录为空说明安装不完整，此时无法判定代理名合法性，报错退出而非静默放行。
function loadAgentNames() {
  const dir = path.join(__dirname, "..", "agents");
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((name) => /^ddd-.*\.md$/.test(name)).map((name) => name.replace(/\.md$/, ""));
  } catch (e) {
    console.error(`[错误] 无法读取代理定义目录 ${dir}：${e.message}`);
    process.exit(1);
  }
  if (!names.length) {
    console.error(`[错误] 代理定义目录 ${dir} 下无 ddd-*.md 文件，无法校验 --set 指定的代理名`);
    process.exit(1);
  }
  return new Set(names);
}

const args = process.argv.slice(2);
const mode = args[0];
function opt(name) {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
}
const repoRoot = opt("--repo") || process.cwd();
const providerArg = opt("--provider");
const sets = [];
for (let i = 0; i < args.length; i++) if (args[i] === "--set" && args[i + 1]) sets.push(args[i + 1]);

async function main() {
if (mode === "list") {
  const j = readJson(path.join(repoRoot, "profiles", "models.json"), null);
  if (!j) {
    console.error("[错误] 缺少 profiles/models.json");
    process.exit(1);
  }
  const reg = registry();
  for (const [name, p] of Object.entries(j.profiles)) {
    console.log(`\n[${name}] ${p._说明}`);
    for (const [agent, model] of Object.entries(p.roles)) {
      const ok = reg.bare.has(model) || reg.byId.has(model);
      console.log(`  ${ok ? "✓" : "✗"} ${agent} -> ${model}${ok ? "" : "（未注册，应用时会跳过）"}`);
    }
  }
  console.log(`\n注册表可用模型：${[...reg.bare].join("、") || "无"}`);
  process.exit(0);
}

if (mode === "status") {
  const settings = readJson(SETTINGS, {});
  const ov = (settings.subagents && settings.subagents.agentOverrides) || {};
  const record = readJson(RECORD, { agents: {} });
  console.log("=== 按代理模型配置状态 ===");
  const keys = Object.keys(ov);
  if (!keys.length) console.log("未配置：全部代理沿用默认模型");
  for (const k of keys) console.log(`  ${k} -> ${ov[k].model}`);
  const recorded = Object.keys(record.agents || {});
  if (recorded.length) {
    console.log(`\n配比 ${record.profile || "未知"}，provider ${record.provider || "未知"}`);
    console.log(`由本方法论写入并可安全移除：${recorded.join("、")}`);
  } else if (keys.length) console.log("\n现有配置非本方法论写入，卸载不会改动");
  process.exit(0);
}

if (mode === "clear") {
  const record = readJson(RECORD, null);
  if (!record || !record.agents) {
    console.log("[跳过] 无本方法论的模型配置记录");
    process.exit(0);
  }
  const settings = readJson(SETTINGS, {});
  const ov = (settings.subagents && settings.subagents.agentOverrides) || {};
  let n = 0;
  // 只撤回本方法论写入的字段，保留该代理下用户原有的其他字段；写入前若已有同名字段则还原原值
  for (const [name, written] of Object.entries(record.agents)) {
    if (!ov[name]) continue;
    const before = record.originals && record.originals[name];
    if (before) ov[name] = before;
    else {
      delete ov[name].model;
      delete ov[name].defaultProvider;
      if (!Object.keys(ov[name]).length) delete ov[name];
    }
    n++;
  }
  if (settings.subagents) settings.subagents.agentOverrides = ov;
  writeJson(SETTINGS, settings);
  fs.rmSync(RECORD);
  console.log(`[完成] 已移除 ${n} 项由本方法论写入的模型配置`);
  process.exit(0);
}

if (mode === "verify") {
  const { provider, profile } = resolveProfile(repoRoot, args[1]);
  const useProvider = providerArg || provider;
  const uniq = [...new Set(Object.values(profile.roles))];
  console.log(`=== 可用性冒烟：配比 ${args[1]}，provider ${useProvider} ===`);
  const bad = [];
  for (const m of uniq) {
    const r = await smoke(useProvider, m);
    if (r.ok) console.log(`  ✓ ${m}  首字 ${r.ms} 毫秒，推理开销 ${r.used ?? "-"} token`);
    else {
      console.log(`  ✗ ${m}  不可用：${r.reason}`);
      bad.push(m);
    }
  }
  console.log(bad.length ? `\n结论：${bad.length} 个模型不可用，需更换后再应用` : "\n结论：本配比的模型全部可用");
  process.exit(bad.length ? 1 : 0);
}

if (mode !== "apply") {
  console.error("用法：node apply-models.js apply <profile>|verify <profile>|clear|list|status [--provider p] [--set name=model] [--skip-verify] [--repo 根]");
  process.exit(1);
}

const profileName = args[1];
const { provider, profile, all } = resolveProfile(repoRoot, profileName);
const useProvider = providerArg || provider;
const reg = registry();

// 逐个校验：注册表不存在的跳过并告警；已标记或实测不可用的同样跳过，不留无法验证的声明
const applied = {};
const skipped = [];
const toSmoke = new Set();
for (const [agent, model] of Object.entries(profile.roles)) {
  if (reg.byId.has(model) || reg.bare.has(model)) {
    applied[agent] = model;
    toSmoke.add(model);
  } else skipped.push({ agent, model, why: "未在注册表中" });
}
// 用户显式指定优先；代理名须属 agents/ 目录集合，模型须在注册表内
const KNOWN_AGENTS = loadAgentNames();
for (const pair of sets) {
  const [agent, model] = pair.split("=");
  if (!agent || !model) continue;
  if (!KNOWN_AGENTS.has(agent)) {
    skipped.push({ agent, model, why: "代理名不在 agents/ 目录集合中" });
    continue;
  }
  if (reg.byId.has(model) || reg.bare.has(model)) {
    applied[agent] = model;
    toSmoke.add(model);
  } else skipped.push({ agent, model, why: "未在注册表中", explicit: true });
}

if (!Object.keys(applied).length) {
  console.error("[错误] 无可应用的模型，配比中的模型均不可用");
  console.error(`注册表可用：${[...reg.bare].join("、") || "无"}`);
  process.exit(1);
}

// 应用前冒烟：把实测不可用的模型从本次应用中剔除
if (!args.includes("--skip-verify")) {
  const failed = new Set();
  for (const m of toSmoke) {
    const r = await smoke(useProvider, m);
    if (r.ok) console.log(`[冒烟] ${m} 可用，首字 ${r.ms} 毫秒，推理开销 ${r.used ?? "-"} token`);
    else {
      failed.add(m);
      console.log(`[冒烟] ${m} 不可用：${r.reason}`);
    }
  }
  for (const [agent, model] of Object.entries(applied)) {
    if (failed.has(model)) {
      delete applied[agent];
      skipped.push({ agent, model, why: "冒烟失败" });
    }
  }
  if (!Object.keys(applied).length) {
    console.error("[错误] 冒烟后无可应用模型，未改动设置文件");
    process.exit(1);
  }
}

const settings = readJson(SETTINGS, {});
settings.subagents = settings.subagents || {};
const ov = settings.subagents.agentOverrides || {};
const ovBefore = JSON.parse(JSON.stringify(ov));
for (const [agent, model] of Object.entries(applied)) {
  ov[agent] = Object.assign({}, ov[agent], { model, defaultProvider: useProvider });
}
settings.subagents.agentOverrides = ov;
writeJson(SETTINGS, settings);

// 记录本次写入，供卸载精确移除，不触碰用户自有配置
const record = readJson(RECORD, { agents: {}, originals: {} });
record.provider = useProvider;
record.profile = profileName;
// 记录写入前的原值，供 clear 精确还原，避免误删用户自有配置
record.originals = record.originals || {};
for (const a of Object.keys(applied)) {
  if (!(a in record.originals)) record.originals[a] = ovBefore[a] || null;
}
record.agents = Object.assign(record.agents || {}, Object.fromEntries(Object.keys(applied).map((a) => [a, applied[a]])));
writeJson(RECORD, record);

console.log(`=== 已应用配比 ${profileName}，provider ${useProvider} ===`);
for (const [a, m] of Object.entries(applied)) console.log(`  ✓ ${a} -> ${m}`);
if (skipped.length) {
  console.log("\n[警告] 以下模型未应用：");
  for (const s of skipped) console.log(`  ✗ ${s.agent} -> ${s.model}（${s.why}）${s.explicit ? "，由 --set 指定" : ""}`);
  console.log("如需使用，请先在 pi 中注册并确认可用，或用 --set 指定已验证的替代模型。");
}
console.log(`\n设置文件：${SETTINGS}`);
console.log(`配比可选：${all.join("、")}`);
}

main();
