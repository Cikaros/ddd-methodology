/** A single selection policy shared by prompt admission and model context.
 * The prompt hook records *only identifiers*, while every model call reevaluates
 * current workspace evidence so newly added/removed dependencies cannot leave
 * the old Skill recommendation indefinitely pinned in storage.
 */
import { SKILLS, type SkillSpec } from './registry.ts';
import { selectSkills, type SkillMatch } from './skill-router.ts';

export function promptSkillHints(root: string, input: {text?:string; files?:readonly string[]}): string[] {
  // Explicit task mention or attachment is a hint for this request; project evidence
  // is always recalculated separately by selectCurrentSkills.
  return selectSkills(root, SKILLS, { ...input, limit: 8 }).matches
    .filter(x => x.basis.some(b => b.startsWith('task:')))
    .map(x => x.id).slice(0, 5);
}
export function selectCurrentSkills(root: string, hinted: unknown, specs: readonly SkillSpec[] = SKILLS): string[] {
  const current = selectSkills(root, specs, { limit: 8 }).matches;
  const byId = new Map(specs.map(s => [s.id, s]));
  const valid = Array.isArray(hinted) ? hinted.filter((id):id is string => typeof id === 'string' && byId.has(id)).slice(0, 5) : [];
  const seen = new Set<string>(), counts = new Map<string,number>(), output: string[]=[];
  const limit = (category: string) => category === 'language' || category === 'framework' ? 2 : 1;
  function insert(id:string) {
    if(seen.has(id))return;
    const s=byId.get(id);if(!s || s.category==='methodology')return;
    if((counts.get(s.category)??0)>=limit(s.category))return;
    output.push(id);seen.add(id);counts.set(s.category,(counts.get(s.category)??0)+1);
  }
  valid.forEach(insert);
  current.forEach((x:SkillMatch)=>insert(x.id));
  return output.slice(0, 5);
}
