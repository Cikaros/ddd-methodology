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

export interface SkillSignals {
  readonly extensions: readonly string[];
  readonly markers: readonly string[];
  readonly keywords: readonly string[];
  readonly dependencies: readonly string[];
}
export interface SkillSpec {
  readonly category: "methodology" | "language" | "framework" | "platform" | "database" | "toolchain" | "infrastructure";
  readonly tier: "existing" | "required" | "recommended";
  readonly signals: SkillSignals;
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

/** 单点权威：assets/skills-catalog.json。运行时投影与物化均只消费该文件。 */
const skillAuthority = resolve(dirname(fileURLToPath(import.meta.url)), "../../assets/skills-catalog.json");
export function loadSkills(path = skillAuthority): readonly SkillSpec[] {
  const payload = JSON.parse(readFileSync(path, "utf8")) as { schemaVersion?: number; skills?: unknown[] };
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.skills)) throw new Error("skills-catalog.json: schemaVersion/skills 非法");
  const validCategories = new Set(["methodology", "language", "framework", "platform", "database", "toolchain", "infrastructure"]);
  const seen = new Set<string>();
  return payload.skills.map((unknownSkill) => {
    if (!unknownSkill || typeof unknownSkill !== "object") throw new Error("skills-catalog.json: 非法记录");
    const raw = unknownSkill as Record<string, unknown>;
    const id = raw.id, dir = raw.dir;
    const signals = raw.signals as Record<string, unknown> | undefined;
    if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || seen.has(id))
      throw new Error(`skills-catalog.json: 非法或重复 id ${String(id)}`);
    if (typeof dir !== "string" || !/^skills\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/.test(dir) || dir.includes(".."))
      throw new Error(`skills-catalog.json: 非法目录 ${String(dir)}`);
    if (typeof raw.description !== "string" || !raw.description.trim()) throw new Error(`skills-catalog.json: ${id} 缺描述`);
    if (!validCategories.has(String(raw.category)) || !["existing", "required", "recommended"].includes(String(raw.tier)))
      throw new Error(`skills-catalog.json: ${id} 类别/层级非法`);
    if (!signals || !["extensions", "markers", "keywords", "dependencies"].every(k => Array.isArray(signals[k]) && (signals[k] as unknown[]).every(v => typeof v === "string" && v.length > 0 && v.length <= 128)))
      throw new Error(`skills-catalog.json: ${id} 信号非法`);
    seen.add(id);
    return raw as unknown as SkillSpec;
  });
}
export const SKILLS: readonly SkillSpec[] = loadSkills();

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
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id)) problems.push(`技能 ID 非法: ${s.id}`);
    if (seenSkill.has(s.id)) problems.push(`技能重名: ${s.id}`);
    seenSkill.add(s.id);
  }
  return problems;
}
