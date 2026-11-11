/**
 * src/lib/registry.ts —— 注册清单与自检（M10 反漂移的运行期投影）。
 *
 * 边界：只依赖标准库，可离线自测。
 * 单点权威：命令的具体取值在 assets/commands.json；本件是其运行期投影，
 * 由 scripts/ 对账二者一致（见 docs/ddd/src/lib/DESIGN-registry.md）。
 */

export interface CommandSpec {
  readonly name: string;
  readonly description: string;
}

export interface SkillSpec {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** 随包技能目录（相对包根）。 */
  readonly dir: string;
}

export interface Registrations {
  readonly commands: readonly CommandSpec[];
  readonly skills: readonly SkillSpec[];
}

/** 13 条节点命令 + ddd-board（M7）+ ddd-memo（M6），共 15 条，统一 `ddd-` 前缀。 */
export const COMMANDS: readonly CommandSpec[] = [
  { name: "ddd-init", description: "在当前项目根落项目级骨架" },
  { name: "ddd-intent", description: "明确意图：把需求澄清到可设计、可验收" },
  { name: "ddd-arch", description: "生成或更新 docs/ARCHITECTURE.md 与目录规划" },
  { name: "ddd-design", description: "逐层生成或更新设计树（--from-code 由代码反推）" },
  { name: "ddd-review", description: "冻结前独立交叉评审接口契约" },
  { name: "ddd-test-design", description: "生成或更新测试用例树" },
  { name: "ddd-implement", description: "按冻结契约落代码与单元测试" },
  { name: "ddd-test", description: "执行四级测试并出报告与缺陷路由" },
  { name: "ddd-validate", description: "跑门禁、出报告" },
  { name: "ddd-change", description: "记一条变更流" },
  { name: "ddd-map", description: "重放图集" },
  { name: "ddd-wrapup", description: "收尾：清临时件、剔需求、发布版本" },
  { name: "ddd-consolidate", description: "冻结即归并：按模块/目录隔离重构为最终版" },
  { name: "ddd-board", description: "看板闭环：查/增/转/证/弃/重挂 持久多步待办任务" },
  { name: "ddd-memo", description: "记忆闭环：查记忆条目、候选提示" },
];

/** 随包技能清单（主技能 + 前端技能 + 工具技能 + 语言族同构实例）。 */
export const SKILLS: readonly SkillSpec[] = [
  { id: "ddd-methodology", name: "ddd-methodology", description: "分治式设计驱动开发方法论主技能", dir: "skills/ddd-methodology" },
  { id: "frontend-variant-contract", name: "frontend-variant-contract", description: "变体契约奠基（第 0 步）：UI 生成前枚举合法变化空间", dir: "skills/frontend-variant-contract" },
  { id: "dev-tools", name: "dev-tools", description: "常用开发工具使用规范", dir: "skills/dev-tools" },
  { id: "lang-html", name: "lang-html", description: "HTML 语言规范", dir: "skills/lang/html" },
  { id: "lang-css", name: "lang-css", description: "CSS 语言规范", dir: "skills/lang/css" },
  { id: "lang-javascript", name: "lang-javascript", description: "JavaScript 语言规范", dir: "skills/lang/javascript" },
  { id: "lang-vue", name: "lang-vue", description: "Vue 语言规范", dir: "skills/lang/vue" },
  { id: "lang-java", name: "lang-java", description: "Java 语言规范", dir: "skills/lang/java" },
  { id: "lang-python", name: "lang-python", description: "Python 语言规范", dir: "skills/lang/python" },
  { id: "lang-shell", name: "lang-shell", description: "Shell（sh/zsh/bash/pwsh）语言规范", dir: "skills/lang/shell" },
  { id: "lang-android", name: "lang-android", description: "Android 语言规范", dir: "skills/lang/android" },
  { id: "lang-sql", name: "lang-sql", description: "SQL（mysql/redis）语言规范", dir: "skills/lang/sql" },
  { id: "lang-c", name: "lang-c", description: "C 语言规范", dir: "skills/lang/c" },
  { id: "lang-cpp", name: "lang-cpp", description: "C++ 语言规范", dir: "skills/lang/cpp" },
  { id: "lang-nasm", name: "lang-nasm", description: "NASM（x86 汇编）语言规范", dir: "skills/lang/nasm" },
];

export function registrations(): Registrations {
  return { commands: COMMANDS, skills: SKILLS };
}

/**
 * 自检：前缀、去重、必有描述。
 * @returns 问题列表（空即合格）。
 */
export function auditRegistrations(r: Registrations = registrations()): string[] {
  const problems: string[] = [];
  const seenCmd = new Set<string>();
  for (const c of r.commands) {
    if (!c.name.startsWith("ddd-")) problems.push(`命令未前缀化: ${c.name}`);
    if (!c.description || !c.description.trim()) problems.push(`命令缺描述: ${c.name}`);
    if (seenCmd.has(c.name)) problems.push(`命令重名: ${c.name}`);
    seenCmd.add(c.name);
  }
  const seenSkill = new Set<string>();
  for (const s of r.skills) {
    if (!s.description || !s.description.trim()) problems.push(`技能缺描述: ${s.id}`);
    if (!s.dir || !s.dir.trim()) problems.push(`技能缺目录: ${s.id}`);
    if (seenSkill.has(s.id)) problems.push(`技能重名: ${s.id}`);
    seenSkill.add(s.id);
  }
  return problems;
}
