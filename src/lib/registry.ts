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
  readonly role?: string;
  readonly blocking: boolean;
  readonly dispatch: "same" | "isolated";
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

/** 命令注册表以 assets/commands.json 为唯一来源；角色/确认/派发不再维护第二份映射。 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const authority = resolve(dirname(fileURLToPath(import.meta.url)), "../../assets/commands.json");
function loadCommands(): readonly CommandSpec[] {
  const payload = JSON.parse(readFileSync(authority, "utf8")) as { commands?: Array<Record<string, unknown>> };
  if (!Array.isArray(payload.commands) || payload.commands.length === 0) throw new Error("commands.json: commands 缺失");
  const seen = new Set<string>();
  return payload.commands.map((raw) => {
    const name = raw.name;
    const description = raw.purpose;
    if (typeof name !== "string" || !/^ddd-[a-z-]+$/.test(name) || seen.has(name)) throw new Error(`commands.json: 非法或重复命令 ${String(name)}`);
    if (typeof description !== "string" || !description.trim()) throw new Error(`commands.json: ${name} 缺 purpose`);
    if (raw.dispatch !== "same" && raw.dispatch !== "isolated") throw new Error(`commands.json: ${name} dispatch 非法`);
    if (typeof raw.blocking !== "boolean") throw new Error(`commands.json: ${name} blocking 非法`);
    if (raw.role !== undefined && (typeof raw.role !== "string" || !/^ddd-[a-z-]+$/.test(raw.role))) throw new Error(`commands.json: ${name} role 非法`);
    seen.add(name);
    return { name, description, role: raw.role as string | undefined, blocking: raw.blocking, dispatch: raw.dispatch };
  });
}
export const COMMANDS: readonly CommandSpec[] = loadCommands();

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
