/**
 * 目标：把环境记录与语言命令模板的可验证面外化为 ref-check 的机械校验——环境记录的存在性与四键结构、标记可用工具的路径实存、
 *   命令模板的候选集形式与占位、模板候选引用的框架与探测覆盖面一致、管理器行的版本键非空、可用工具的解析来源级别合法、
 *   所需版本落在所解析的版本清单内、环境记录键集声明与常量逐字一致。
 * 范围：C26 至 C30 与 C34、C36、C37 八项，编号续 ref-check 既有清单不作复用；数据源为 <项目根>/docs/.ddd-env.json、六语言技能 assets/commands.json 与 references/spec-govern.md；
 *   框架探测的覆盖面取自同目录 env-probe.js 的常量声明处（外部测试框架清单与内建框架表），来源级别值域取自同目录 env-resolve.js 的声明处，语言到运行时行与运行时提供者表的解析取自同目录 env-command.js，本模块不另立一份，免得两处漂移。
 * 不包含：引用形态与脚本名（见 ref-refs.js）、常量集合（见 ref-constants.js）、冻结短语（见 ref-phrases.js）、教训回写映射（见 ref-coverage.js）、命令行入口。不引入第三方依赖。
 * 依据：DESIGN-environment.md 第六、九、十三、十四节；环境记录为四键结构（含第十节补入的 frameworks），逐工具为七键，命令模板为候选集形式，可用工具的 path 须标明四级来源，所需版本须落在所解析的版本清单内，spec-govern.md 的键集声明须与常量逐字一致。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./text.js");
const { FRAMEWORK_COMMANDS, BUILTIN_FRAMEWORKS } = require("./env-probe.js");
const { SOURCE_LEVELS } = require("./env-resolve.js");
const { LANGUAGE_RUNTIMES, PROVIDER_LANGUAGES } = require("./env-command.js");

const ENV_REL = "docs/.ddd-env.json";
const SPEC_GOVERN_REL = "skills/ddd-methodology/references/spec-govern.md";
// 环境记录四键：缺一即报缺口，与 DESIGN-environment.md 第三节与第十节的结构一致
const ENV_KEYS = ["probedAt", "tools", "languages", "frameworks"];
// 逐工具七键：与 ENV_KEYS 并列，同为键集单一权威，供结构校验与 spec-govern 声明行生成共用
const TOOL_KEYS = ["path", "source", "version", "available", "manager", "versions", "active"];
// 六语言技能目录：命令模板落各技能 assets/commands.json；lang-md 无命令模板故不在列
const LANG_SKILLS = ["lang-python", "lang-java", "lang-javascript", "lang-typescript", "lang-shell", "lang-powershell"];
// 命令组：test 与 coverage 均须为候选集；test 候选的选择条件为 when，coverage 候选的选择条件为 tool
const COMMAND_GROUPS = ["test", "coverage"];

function createEnvChecks(env) {
  const { root } = env;

  // 环境记录读取：缺失回 null，不可解析回带标记对象，由各校验项给出各自结论而不互相吞并
  function readEnvRecord() {
    const text = readFileText(path.join(root, ...ENV_REL.split("/")));
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) { return { __parseError: e.message }; }
  }

  // 命令模板读取：六语言技能逐个读 assets/commands.json，缺文件或不可解析连同原因一并回传
  function readCommandTemplates() {
    const out = [];
    for (const skill of LANG_SKILLS) {
      const rel = `skills/${skill}/assets/commands.json`;
      const text = readFileText(path.join(root, ...rel.split("/")));
      let data = null;
      let error = null;
      if (!text) error = "文件不存在或不可读";
      else { try { data = JSON.parse(text); } catch (e) { error = e.message; } }
      out.push({ rel, data, error });
    }
    return out;
  }

  // C26 环境记录存在性与键集结构：记录缺失、四键之一缺席、逐工具行缺 TOOL_KEYS 任一均报缺口
  function checkEnvRecord() {
    const found = [];
    const record = readEnvRecord();
    if (!record) { found.push(drift("C26", ENV_REL, 0, "环境记录缺失即报缺口", `${ENV_REL} 存在且可解析`, "未找到")); return found; }
    if (record.__parseError) { found.push(drift("C26", ENV_REL, 0, "环境记录须为合法 JSON", "可解析", record.__parseError)); return found; }
    for (const key of ENV_KEYS) {
      if (record[key] === undefined || record[key] === null) found.push(drift("C26", ENV_REL, 0, "环境记录结构须含四键", `含 ${key}`, "缺失"));
    }
    if (record.tools && typeof record.tools === "object") {
      for (const [name, tool] of Object.entries(record.tools)) {
        if (!tool || typeof tool !== "object") { found.push(drift("C26", ENV_REL, 0, "逐工具行须含全部七键", `${name} 为含七键的对象`, "非对象")); continue; }
        for (const key of TOOL_KEYS) {
          if (tool[key] === undefined) found.push(drift("C26", ENV_REL, 0, "逐工具行须含全部七键", `${name}.${key} 存在`, "缺失"));
        }
      }
    }
    return found;
  }

  // C27 标记可用的工具其路径须实际存在：记录自陈可用而路径缺失或不存在即报缺口
  function checkToolPaths() {
    const found = [];
    const record = readEnvRecord();
    if (!record || record.__parseError || !record.tools) return found;
    for (const [name, tool] of Object.entries(record.tools)) {
      if (!tool || tool.available !== true) continue;
      if (!tool.path || !fs.existsSync(tool.path)) found.push(drift("C27", ENV_REL, 0, "标记可用的工具其路径须实际存在", `${name} 的 path 存在`, String(tool.path || "根元素缺 path")));
    }
    return found;
  }

  // C28 命令模板候选集形式与占位：命令组须为非空数组，每候选含 {runner} 占位与选择条件（when 对象或 tool 名），单件形式即报缺陷
  function checkCommandTemplates() {
    const found = [];
    for (const { rel, data, error } of readCommandTemplates()) {
      if (error) { found.push(drift("C28", rel, 0, "命令模板文件须存在且可解析", "合法 JSON", error)); continue; }
      for (const group of COMMAND_GROUPS) {
        const candidates = data ? data[group] : undefined;
        if (!Array.isArray(candidates) || candidates.length === 0) {
          found.push(drift("C28", rel, 0, "命令模板须为候选集形式，单件形式即报缺陷", `${group} 为非空候选集数组`, candidates === undefined ? "缺失" : Array.isArray(candidates) ? "空数组" : `单件 ${typeof candidates}`));
          continue;
        }
        candidates.forEach((candidate, index) => {
          const label = `${group}[${index}]`;
          if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
            found.push(drift("C28", rel, 0, "候选须为含选择条件与 template 的对象", "对象", label));
            return;
          }
          if (typeof candidate.template !== "string" || !candidate.template.includes("{runner}")) {
            found.push(drift("C28", rel, 0, "候选模板须含 {runner} 占位", `${label} 的 template 含 {runner}`, String(candidate.template)));
          }
          const hasWhen = candidate.when && typeof candidate.when === "object" && !Array.isArray(candidate.when) && Object.keys(candidate.when).length > 0;
          const hasTool = typeof candidate.tool === "string" && candidate.tool.trim() !== "";
          if (!hasWhen && !hasTool) found.push(drift("C28", rel, 0, "候选须含选择条件（when 对象或 tool 名）", `${label} 含 when 或 tool`, "均无"));
        });
      }
    }
    return found;
  }

  // C29 模板候选引用的框架须在探测覆盖面内：覆盖面为外部测试框架清单与内建框架表的并集，引用不在即报缺口
  function checkTemplateFrameworks() {
    const found = [];
    const covered = new Set([...FRAMEWORK_COMMANDS, ...Object.keys(BUILTIN_FRAMEWORKS)]);
    const allowed = [...covered].join("、");
    for (const { rel, data, error } of readCommandTemplates()) {
      if (error || !data) continue; // 文件级问题由 C28 报，本项不重复
      for (const group of COMMAND_GROUPS) {
        const candidates = data[group];
        if (!Array.isArray(candidates)) continue;
        candidates.forEach((candidate, index) => {
          const framework = candidate && candidate.when && candidate.when.framework;
          if (!framework) return;
          if (!covered.has(framework)) found.push(drift("C29", rel, 0, "模板候选引用的框架须在探测覆盖面内", `框架属于 ${allowed}`, framework));
        });
      }
    }
    return found;
  }

  // C30 标记管理器的工具其 versions 与 active 两键须非空：管理器在位却无版本清单或表不出激活版本即报缺口
  function checkManagerVersions() {
    const found = [];
    const record = readEnvRecord();
    if (!record || record.__parseError || !record.tools) return found;
    for (const [name, tool] of Object.entries(record.tools)) {
      if (!tool || !tool.manager) continue;
      if (!Array.isArray(tool.versions) || tool.versions.length === 0) found.push(drift("C30", ENV_REL, 0, "标记管理器的工具其 versions 须非空", `${name}.versions 非空`, "空清单"));
      if (tool.active === undefined || tool.active === null || tool.active === "") found.push(drift("C30", ENV_REL, 0, "标记管理器的工具其 active 须非空", `${name}.active 非空`, String(tool.active)));
    }
    return found;
  }

  // C34 可用工具的 path 须标明来源级别：来源缺失或不在四级之内即报缺陷（设计册第十三节第十项）；
  // 不可用工具不在此列，因其本就未解析到路径，无来源可言
  function checkToolSources() {
    const found = [];
    const record = readEnvRecord();
    if (!record || record.__parseError || !record.tools) return found;
    const allowed = SOURCE_LEVELS.join("、");
    for (const [name, tool] of Object.entries(record.tools)) {
      if (!tool || tool.available !== true) continue;
      if (!SOURCE_LEVELS.includes(tool.source)) {
        const actual = tool.source === undefined || tool.source === null ? "缺失" : JSON.stringify(tool.source);
        found.push(drift("C34", ENV_REL, 0, "可用工具的 path 须标明来源级别且取值在四级之内", `source 取 ${allowed} 之一`, `${name}.source 为 ${actual}`));
      }
    }
    return found;
  }

  // C36 所需版本在清单内（设计册第九节其六）：required 缺失即零漂移，非对象即缺口；逐项值须为非空字符串；键域收口为语言名单一域，键须为 record.languages 键，否则报缺口；
  // 清单解析次序：先逐 LANGUAGE_RUNTIMES 指名的运行时工具行取首个非空 versions，均空时取运行时提供者行即 PROVIDER_LANGUAGES 中值等于该键者的 versions；
  // 取到非空清单即断言含该版本，取不到非空清单时报无法判定而非缺口；键不在 languages 内回 null
  function resolveVersionList(record, key) {
    if (!(record.languages && record.languages[key])) return null;
    for (const toolName of LANGUAGE_RUNTIMES[key] || []) {
      const row = record.tools && record.tools[toolName];
      if (row && Array.isArray(row.versions) && row.versions.length) return row.versions;
    }
    for (const [provider, language] of Object.entries(PROVIDER_LANGUAGES)) {
      if (language !== key) continue;
      const row = record.tools && record.tools[provider];
      if (row && Array.isArray(row.versions)) return row.versions;
    }
    return [];
  }

  function checkRequiredVersions() {
    const found = [];
    const record = readEnvRecord();
    if (!record || record.__parseError) return found;
    const required = record.required;
    if (required === undefined) return found;
    if (required === null || typeof required !== "object" || Array.isArray(required)) {
      found.push(drift("C36", ENV_REL, 0, "所需版本声明须为对象", "对象或缺失", typeof required));
      return found;
    }
    for (const [key, value] of Object.entries(required)) {
      if (typeof value !== "string" || value.trim() === "") {
        found.push(drift("C36", ENV_REL, 0, "所需版本须为非空字符串", `${key} 的值为非空字符串`, JSON.stringify(value)));
        continue;
      }
      const list = resolveVersionList(record, key);
      if (list === null) { found.push(drift("C36", ENV_REL, 0, "所需版本的键须为 languages 键", `${key} 为 record.languages 键`, "非 languages 键")); continue; }
      if (!list.length) { process.stdout.write(`[C36 无法判定] 键 ${key} 的版本清单不可得，所需版本 ${value} 无法校验\n`); continue; }
      if (!list.includes(value)) found.push(drift("C36", ENV_REL, 0, "所需版本须落在该键所解析的版本清单内", `${key} 的清单含 ${value}`, `清单 ${list.join("、")}`));
    }
    return found;
  }

  // C37 环境记录键集声明一致（设计册第十四节）：期望声明行由 ENV_KEYS 与 TOOL_KEYS 拼接生成，不写字面量副本；行缺失或与常量不符即报漂移
  function checkKeyDeclaration() {
    const found = [];
    const deliver = (keys) => keys.map((key) => `\`${key}\``).join("、");
    const expected = `环境记录键集：顶层 ${deliver(ENV_KEYS)}；逐工具 ${deliver(TOOL_KEYS)}。`;
    const text = readFileText(path.join(root, ...SPEC_GOVERN_REL.split("/")));
    if (!text) { found.push(drift("C37", SPEC_GOVERN_REL, 0, "键集声明所在规范文件须存在", "存在且可读", "未找到")); return found; }
    if (!text.includes(expected)) found.push(drift("C37", SPEC_GOVERN_REL, 0, "键集声明须与记录结构常量逐字一致", expected, "未检出该声明行"));
    return found;
  }

  return { checkEnvRecord, checkToolPaths, checkCommandTemplates, checkTemplateFrameworks, checkManagerVersions, checkToolSources, checkRequiredVersions, checkKeyDeclaration };
}

// 注册表契约：id、简名与所属域随本模块声明；run 只转接本模块工厂的对应判据，装配处不掌握判据内容
// 键集常量一并导出，作键集单一权威，供声明行生成与校验测试引用
module.exports = {
  ENV_KEYS,
  TOOL_KEYS,
  contracts: [
    { id: "C26", name: "环境记录完备性", domain: "env", run: (ctx) => createEnvChecks(ctx).checkEnvRecord() },
    { id: "C27", name: "可用工具路径实存", domain: "env", run: (ctx) => createEnvChecks(ctx).checkToolPaths() },
    { id: "C28", name: "命令模板候选集与占位", domain: "env", run: (ctx) => createEnvChecks(ctx).checkCommandTemplates() },
    { id: "C29", name: "模板框架在探测覆盖面内", domain: "env", run: (ctx) => createEnvChecks(ctx).checkTemplateFrameworks() },
    { id: "C30", name: "管理器版本键非空", domain: "env", run: (ctx) => createEnvChecks(ctx).checkManagerVersions() },
    { id: "C34", name: "工具来源级别合法", domain: "env", run: (ctx) => createEnvChecks(ctx).checkToolSources() },
    { id: "C36", name: "所需版本在清单内", domain: "env", run: (ctx) => createEnvChecks(ctx).checkRequiredVersions() },
    { id: "C37", name: "环境记录键集声明一致", domain: "env", run: (ctx) => createEnvChecks(ctx).checkKeyDeclaration() },
  ],
};
