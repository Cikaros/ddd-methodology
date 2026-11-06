/**
 * 目标：把环境记录与语言命令模板的可验证面外化为 ref-check 的机械校验——环境记录的存在性与四键结构、标记可用工具的路径实存、
 *   命令模板的候选集形式与占位、模板候选引用的框架与探测覆盖面一致、管理器行的版本键非空。
 * 范围：C26 至 C30 五项，编号续 ref-check 既有清单不作复用；数据源为 <项目根>/docs/.ddd-env.json 与六语言技能 assets/commands.json；
 *   框架探测的覆盖面取自同目录 env-probe.js 的常量声明处（外部测试框架清单与内建框架表），本模块不另立一份，免得两处漂移。
 * 不包含：引用形态与脚本名（见 ref-refs.js）、常量集合（见 ref-constants.js）、冻结短语（见 ref-phrases.js）、教训回写映射（见 ref-coverage.js）、命令行入口。不引入第三方依赖。
 * 依据：DESIGN-environment.md 第六、九、十一节；环境记录为四键结构（含第十节补入的 frameworks），命令模板为候选集形式。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./text.js");
const { FRAMEWORK_COMMANDS, BUILTIN_FRAMEWORKS } = require("./env-probe.js");

const ENV_REL = "docs/.ddd-env.json";
// 环境记录四键：缺一即报缺口，与 DESIGN-environment.md 第三节与第十节的结构一致
const ENV_KEYS = ["probedAt", "tools", "languages", "frameworks"];
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

  // C26 环境记录存在性与四键结构：记录缺失或四键之一缺席均报缺口
  function checkEnvRecord() {
    const found = [];
    const record = readEnvRecord();
    if (!record) { found.push(drift("C26", ENV_REL, 0, "环境记录缺失即报缺口", `${ENV_REL} 存在且可解析`, "未找到")); return found; }
    if (record.__parseError) { found.push(drift("C26", ENV_REL, 0, "环境记录须为合法 JSON", "可解析", record.__parseError)); return found; }
    for (const key of ENV_KEYS) {
      if (record[key] === undefined || record[key] === null) found.push(drift("C26", ENV_REL, 0, "环境记录结构须含四键", `含 ${key}`, "缺失"));
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

  return { checkEnvRecord, checkToolPaths, checkCommandTemplates, checkTemplateFrameworks, checkManagerVersions };
}

// 注册表契约：id、简名与所属域随本模块声明；run 只转接本模块工厂的对应判据，装配处不掌握判据内容
module.exports = {
  contracts: [
    { id: "C26", name: "环境记录完备性", domain: "env", run: (ctx) => createEnvChecks(ctx).checkEnvRecord() },
    { id: "C27", name: "可用工具路径实存", domain: "env", run: (ctx) => createEnvChecks(ctx).checkToolPaths() },
    { id: "C28", name: "命令模板候选集与占位", domain: "env", run: (ctx) => createEnvChecks(ctx).checkCommandTemplates() },
    { id: "C29", name: "模板框架在探测覆盖面内", domain: "env", run: (ctx) => createEnvChecks(ctx).checkTemplateFrameworks() },
    { id: "C30", name: "管理器版本键非空", domain: "env", run: (ctx) => createEnvChecks(ctx).checkManagerVersions() },
  ],
};
