/**
 * 目标：把 ref-check 的校验链从手工装配改为注册表模式——扫描 lib 下符合命名的校验模块，收集其导出的契约对象，
 *   校验契约完整性、按 id 数字序排序，并把三项注册表自校验作为注册项交付装配处执行，使新增检测面只加一个模块文件。
 * 范围：注册表装载（扫描 ref-*.js、归一导出形态、四键校验、按 id 数字序排序）与 C31 契约完整、C32 id 唯一且序号连续、
 *   C33 头部计数派生一致三项自校验契约。三项自校验的判据面向注册表自身，故不读活文档，只读注册表与装配脚本头部。
 * 不包含：各校验项的判据（见同目录各 ref-*.js）、活文档遍历与排除集、命令行入口。不引入第三方依赖。
 * 依赖：文本读取与漂移项构造取 ./text.js。本模块自身也是注册项来源，其契约随同其余模块被扫描。
 * 退休编号：C13 与 C18 的校验面已随模型配比改声明撤除，编号不复用以免既有引用漂移，故连续性判据须扣除退休编号，
 *   否则真实注册表会被误报断号；新增检测面一律续用最大编号之后的新号。
 */

const fs = require("fs");
const path = require("path");
const { readFileText, drift } = require("./text.js");

// 契约四键：id 形如 C 加序号，name 为检测面简名，domain 为所属域，run 接统一上下文并回传漂移项数组
const CONTRACT_KEYS = ["id", "name", "domain", "run"];
// 校验模块命名：lib 下 ref-*.js；单元测试文件同为 ref-*.js 形态但非契约来源，按 .test.js 形态排除
const CHECK_MODULE_RE = /^ref-.+\.js$/;
const TEST_MODULE_RE = /\.test\.js$/;
// 退休编号：连续性判据的扣除项，值只在此声明一处
const RETIRED_IDS = ["C13", "C18"];
const RETIRED = new Set(RETIRED_IDS);
// 装配脚本本体的相对路径：C33 须读其头部注释与运行时头部行
const REF_CHECK_REL = "skills/ddd-methodology/scripts/ref-check.js";
const LIB_REL = ["skills", "ddd-methodology", "scripts", "lib"];

// id 序号：C 加数字形态回其数值，其余回 null，供排序与连续性判据跳过非法编号
function idNumber(id) {
  const m = /^C(\d+)$/.exec(String(id || ""));
  return m ? Number(m[1]) : null;
}

// 导出形态归一：模块可直接导出契约对象、契约数组，或以 contracts 键承载契约数组，三者归一为契约数组；
// 单对象形态的识别以「含任一契约键」为准，使缺键的模块仍进入四键校验而非被当作「未导出契约」而失去具体缺口
function contractsOf(exported) {
  if (Array.isArray(exported)) return exported;
  if (exported && typeof exported === "object") {
    if (Array.isArray(exported.contracts)) return exported.contracts;
    if (CONTRACT_KEYS.some((key) => exported[key] !== undefined)) return [exported];
  }
  return null;
}

// 契约完整性：四键齐备且类型正确；缺键或形态非法回缺陷描述，由 C31 转为缺口
function contractDefect(contract) {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) return "契约须为对象";
  const missing = CONTRACT_KEYS.filter((key) => contract[key] === undefined);
  if (missing.length) return `契约缺键：${missing.join("、")}`;
  if (typeof contract.id !== "string" || idNumber(contract.id) === null) return `契约 id 须形如 C 加序号，实际 ${JSON.stringify(contract.id)}`;
  if (typeof contract.name !== "string" || !contract.name.trim()) return "契约 name 须为非空字符串";
  if (typeof contract.domain !== "string" || !contract.domain.trim()) return "契约 domain 须为非空字符串";
  if (typeof contract.run !== "function") return "契约 run 须为函数";
  return null;
}

// 注册表装载：扫描 lib 下 ref-*.js（排除 .test.js），逐个归一导出并校验契约，回传有效契约与缺陷清单；
// 契约按 id 数字序排序，避免 C10 排到 C2 之前；模块加载或导出异常记入缺陷而不中断其余模块
function loadRegistry(ctx) {
  const libDir = path.join(ctx.root, ...LIB_REL);
  let names = [];
  try { names = fs.readdirSync(libDir); } catch (e) { names = []; }
  const moduleFiles = names.filter((name) => CHECK_MODULE_RE.test(name) && !TEST_MODULE_RE.test(name)).sort();
  const contracts = [];
  const defects = [];
  for (const name of moduleFiles) {
    const rel = `lib/${name}`;
    let exported;
    try { exported = require(path.join(libDir, name)); }
    catch (e) { defects.push({ file: rel, reason: `模块加载失败：${String((e && e.message) || e)}` }); continue; }
    const list = contractsOf(exported);
    if (!list || !list.length) { defects.push({ file: rel, reason: "模块未导出契约对象或契约数组" }); continue; }
    for (const contract of list) {
      const reason = contractDefect(contract);
      if (reason) defects.push({ file: rel, reason: `${reason}（id：${contract && contract.id !== undefined ? String(contract.id) : "无"}）` });
      else contracts.push(contract);
    }
  }
  contracts.sort((a, b) => idNumber(a.id) - idNumber(b.id));
  return { contracts, defects, moduleFiles };
}

// 首个块注释：装配脚本头部；C33 只在其内查计数声明，免与正文措辞相混
function leadingComment(source) {
  const m = String(source).match(/\/\*\*[\s\S]*?\*\//);
  return m ? m[0] : "";
}

// 中文数字转阿拉伯：支持十百千组合，用于读头部声明的中文计数；无法解析回 null
function cnNumber(token) {
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const units = { 十: 10, 百: 100, 千: 1000 };
  let section = 0;
  let number = 0;
  for (const ch of token) {
    if (digits[ch] !== undefined) number = digits[ch];
    else if (units[ch] !== undefined) { section += (number || 1) * units[ch]; number = 0; }
    else return null;
  }
  const total = section + number;
  return token === "零" ? 0 : total > 0 ? total : null;
}

// 头部计数声明：形如「N 项校验」的计数，N 取阿拉伯或中文数字；无声明回 null，表示头部已改为派生表述
function declaredHeadCount(comment) {
  const m = String(comment).match(/([零〇一二三四五六七八九十百千两\d]+)\s*项校验/);
  if (!m) return null;
  return /^\d+$/.test(m[1]) ? Number(m[1]) : cnNumber(m[1]);
}

// 运行时头部计数为派生表达式：形如「校验项：${...length} 项」，字面量形态即判未派生
const DERIVED_COUNT_RE = /校验项：\$\{[^}]*\.length\}[^}]*项/;

const CONTRACTS = [
  {
    id: "C31",
    name: "校验模块契约完整",
    domain: "registry",
    run(ctx) {
      const registry = ctx.registry;
      if (!registry) return [drift("C31", REF_CHECK_REL, 0, "注册表须先于校验项装载", "注册表已装载", "未装载")];
      return registry.defects.map((defect) => drift("C31", defect.file, 0, "每个校验模块须导出含 id、name、domain、run 四键的契约对象", "四键齐备且类型正确", defect.reason));
    },
  },
  {
    id: "C32",
    name: "校验项 id 唯一且序号连续",
    domain: "registry",
    run(ctx) {
      const registry = ctx.registry;
      if (!registry) return [drift("C32", REF_CHECK_REL, 0, "注册表须先于校验项装载", "注册表已装载", "未装载")];
      const found = [];
      const counts = new Map();
      for (const contract of registry.contracts) counts.set(contract.id, (counts.get(contract.id) || 0) + 1);
      for (const [id, count] of counts) if (count > 1) found.push(drift("C32", REF_CHECK_REL, 0, "校验项 id 须全局唯一", `id ${id} 仅出现一次`, `出现 ${count} 次`));
      const numbers = [...new Set([...counts.keys()].map(idNumber).filter((n) => n !== null))].sort((a, b) => a - b);
      if (numbers.length) {
        const max = numbers[numbers.length - 1];
        const present = new Set(numbers);
        const gaps = [];
        for (let n = 1; n <= max; n++) if (!present.has(n) && !RETIRED.has(`C${n}`)) gaps.push(`C${n}`);
        if (gaps.length) found.push(drift("C32", REF_CHECK_REL, 0, `校验项 id 序号须自 C1 连续，断号即报（退休编号 ${RETIRED_IDS.join("、")} 除外）`, `C1 至 C${max} 无断号`, `断号 ${gaps.join("、")}`));
      }
      return found;
    },
  },
  {
    id: "C33",
    name: "头部计数与注册表长度一致",
    domain: "registry",
    run(ctx) {
      const registry = ctx.registry;
      if (!registry) return [drift("C33", REF_CHECK_REL, 0, "注册表须先于校验项装载", "注册表已装载", "未装载")];
      const found = [];
      const source = readFileText(path.join(ctx.root, ...REF_CHECK_REL.split("/")));
      const declared = declaredHeadCount(leadingComment(source));
      if (declared !== null && declared !== registry.contracts.length) {
        found.push(drift("C33", REF_CHECK_REL, 0, "头部若声明校验项计数，须等于注册表长度；计数改由注册表派生，不再手工维护", `计数等于注册表长度 ${registry.contracts.length}`, `头部声明 ${declared} 项`));
      }
      if (!DERIVED_COUNT_RE.test(source)) {
        found.push(drift("C33", REF_CHECK_REL, 0, "运行时头部的校验项计数须由注册表长度派生，不得写为字面量", "计数取自注册表长度", "未检出派生表达式"));
      }
      return found;
    },
  },
];

module.exports = { loadRegistry, contracts: CONTRACTS, CONTRACT_KEYS, RETIRED_IDS };
