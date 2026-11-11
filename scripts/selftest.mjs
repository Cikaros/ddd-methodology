/**
 * scripts/selftest.mjs —— 离线自测入口（无模型、无网络）。
 *
 * 用 mock ctx 加载 server part，断言「setup 注册了什么」并逐条跑通每个命令/RPC。
 * 退出码：0 全过；1 有失败；2 用法/入口错。
 * 依赖：Node 标准库；不引入 @opencode/plugin（用 mock 替代），入口由插件自己 import。
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const pluginDir = process.argv[2] ? resolve(process.argv[2]) : resolve(".");
const verbose = process.argv.includes("--verbose");

const failures = [];
const checks = [];
function check(name, cond, detail) {
  checks.push({ name, ok: !!cond, detail });
  if (!cond) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

function makeMockCtx(options) {
  const registrations = { commands: [], skills: [], hooks: {}, rpc: null, cleanups: [] };
  const storage = new Map();
  const record = (dispose) => Promise.resolve({ dispose: () => Promise.resolve(dispose?.()) });

  const ctx = {
    options: options ?? {},
    location: { directory: process.cwd() },
    app: { version: "0.0.0", channel: "test" },
    command: {
      transform: (cb) => {
        const editor = { add: (def) => registrations.commands.push(def) };
        cb(editor);
        return record();
      },
    },
    skill: {
      transform: (cb) => {
        const editor = { add: (s) => registrations.skills.push(s) };
        cb(editor);
        return record();
      },
    },
    session: {
      hook: (name, cb) => {
        registrations.hooks[name] = cb;
        return record();
      },
      hookAsync: (name, cb) => {
        registrations.hooks[name] = cb;
        return record();
      },
      prompt: async () => {},
      instructions: { entry: { put: async () => {}, list: async () => [], remove: async () => {} } },
      create: async () => ({ id: "ses_mock" }),
      switchAgent: async () => {},
      command: async () => {},
    },
    tool: {
      transform: (cb) => {
        const editor = { add: () => {}, list: () => [], get: () => undefined, update: () => {}, remove: () => {}, namespace: () => {} };
        cb(editor);
        return record();
      },
      hook: (name, cb) => {
        registrations.hooks[`tool:${name}`] = cb;
        return record();
      },
    },
    permission: {
      hook: (name, cb) => {
        registrations.hooks[`permission:${name}`] = cb;
        return record();
      },
      assert: async () => {},
    },
    shell: {
      hook: (name, cb) => {
        registrations.hooks[`shell:${name}`] = cb;
        return record();
      },
    },
    rpc: {
      register: (def, handlers) => {
        registrations.rpc = { def, handlers };
        return Promise.resolve({ dispose: () => Promise.resolve(), events: { emit: async () => {} } });
      },
    },
    storage: {
      get: async (k) => storage.get(k),
      set: async (k, v) => void storage.set(k, v),
      remove: async (k) => void storage.delete(k),
      scan: async () => [],
    },
    event: {
      subscribe: () => (async function* () {})(),
    },
  };
  return { ctx, registrations };
}

async function main() {
  const pkgPath = join(pluginDir, "package.json");
  if (!existsSync(pkgPath)) {
    console.error(`用法错误：${pluginDir} 下无 package.json`);
    process.exit(2);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const entryRel = pkg.exports?.["."] ?? "./src/index.ts";
  const entryAbs = resolve(pluginDir, entryRel);
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
  check("default 导出存在", !!plugin);
  check("id === 'ddd'", plugin?.id === "ddd", `实为 ${plugin?.id}`);
  check("setup 为函数", typeof plugin?.setup === "function");

  const { ctx, registrations } = makeMockCtx({ profile: "standard" });
  let cleanup;
  try {
    cleanup = await plugin.setup(ctx);
  } catch (e) {
    check("setup 可运行", false, e?.message ?? String(e));
    report();
    return;
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
    try {
      await c.execute({ sessionID: "ses_mock", prompt: { text: "" } });
    } catch (e) {
      cmdRunOk = false;
      failures.push(`命令 ${c.name} 执行抛错: ${e?.message ?? e}`);
    }
  }
  check("每条命令可跑通", cmdRunOk);

  if (registrations.rpc) {
    try {
      const gatesOut = await registrations.rpc.handlers.gates({}, { signal: new AbortController().signal, error: () => ({}) });
      check("RPC gates 返回 readings", Array.isArray(gatesOut?.readings));
      const boardOut = await registrations.rpc.handlers.board({}, { signal: new AbortController().signal, error: () => ({}) });
      check("RPC board 返回摘要", boardOut && typeof boardOut.pending === "number");
    } catch (e) {
      check("RPC handler 可跑通", false, e?.message ?? String(e));
    }
  }

  if (typeof cleanup === "function") {
    try {
      await cleanup();
      check("cleanup 可运行", true);
    } catch (e) {
      check("cleanup 可运行", false, e?.message ?? String(e));
    }
  }

  report();
}

function report() {
  if (verbose) for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
  console.log(`\nddd selftest: ${checks.length - failures.length}/${checks.length} passed`);
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
