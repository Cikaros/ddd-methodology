/** Catalog-backed Skill recommendation; bounded project inspection, no skill body injection. */
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { SkillSpec } from "./registry.ts";

export interface SkillMatch { readonly id: string; readonly category: SkillSpec["category"]; readonly score: number; readonly basis: readonly string[] }
export interface Selection { readonly matches: readonly SkillMatch[]; readonly filesExamined: number; readonly manifestCount: number }
const SKIP = new Set(["node_modules", ".git", ".ddd", ".next", "dist", "build", "target", "vendor", ".venv", "coverage", "docs", ".opencode"]);
const MANIFESTS = new Set(["package.json", "pyproject.toml", "requirements.txt", "pom.xml", "build.gradle", "build.gradle.kts", "composer.json", "pubspec.yaml", "Cargo.toml", "go.mod"]);
function safeRead(path: string): string {
  try {
    const st = lstatSync(path);
    if (st.isFile() && st.size <= 196_608) return readFileSync(path, "utf8").slice(0, 196_608).toLowerCase();
  } catch { /* unreadable is not evidence */ }
  return "";
}
/** Bounded traversal: never follow symlinks, read secret files, or crawl dependency caches. */
export function inventory(root: string, maxFiles = 500): { paths: string[]; manifests: string[] } {
  const base = resolve(root), paths: string[] = [], manifests: string[] = [];
  const queue: { path: string; depth: number }[] = [{ path: base, depth: 0 }];
  while (queue.length && paths.length < maxFiles) {
    const dir = queue.shift()!;
    let entries;
    try { entries = readdirSync(dir.path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); }
    catch { continue; }
    for (const e of entries.slice(0, 180)) {
      if (paths.length >= maxFiles) break;
      if (e.isSymbolicLink()) continue;
      const abs = join(dir.path, e.name);
      const rel = relative(base, abs).replace(/\\/g, "/");
      if (e.isDirectory()) {
        if (SKIP.has(e.name) || (e.name.startsWith(".") && e.name !== ".github") || dir.depth >= 3) continue;
        paths.push(rel + "/");
        queue.push({ path: abs, depth: dir.depth + 1 });
      } else if (e.isFile()) {
        if (e.name.startsWith(".env") || /\.(pem|key|p12)$/i.test(e.name)) continue;
        paths.push(rel);
        if (MANIFESTS.has(e.name) && manifests.length < 12) manifests.push(safeRead(abs));
      }
    }
  }
  return { paths, manifests };
}
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function glob(path: string, pattern: string): boolean {
  const p = path.toLowerCase(), v = pattern.toLowerCase();
  if (v.includes("*")) {
    const expr = v.split("*").map(escapeRegex).join("[^/]*");
    return new RegExp(`(?:^|/)${expr}$`).test(p);
  }
  return p === v || p.endsWith("/" + v) || p.startsWith(v.endsWith("/") ? v : v + "/");
}
function keywordMatch(text: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(word)}(?=$|[^a-z0-9])`, "i").test(text);
}
/** Project evidence + explicit prompt matching; raw prompt and project content never persisted. */
export function selectSkills(root: string, skills: readonly SkillSpec[], input: { text?: string; files?: readonly string[]; limit?: number } = {}): Selection {
  const inv = inventory(root);
  const files = [...new Set([...inv.paths, ...(input.files ?? []).filter(v => typeof v === "string").map(v => v.replace(/\\/g, "/"))])];
  const manifests = inv.manifests.join("\n");
  const text = (input.text ?? "").slice(0, 4_000);
  const found: SkillMatch[] = [];
  for (const spec of skills) {
    if (spec.category === "methodology") continue;
    const s = spec.signals, basis: string[] = [];
    let score = 0;
    const direct = s.keywords.find(k => keywordMatch(text, k));
    if (direct) { score += 12; basis.push(`task:${direct}`); }
    const dep = s.dependencies.find(k => manifests.includes(k.toLowerCase()));
    if (dep) { score += 8; basis.push(`dependency:${dep}`); }
    const marker = s.markers.find(k => files.some(f => glob(f, k)));
    if (marker) { score += 6; basis.push(`marker:${marker}`); }
    const ext = s.extensions.find(k => files.some(f => f.toLowerCase().endsWith(k.toLowerCase())));
    if (ext) { score += 3; basis.push(`extension:${ext}`); }
    if (score) found.push({ id: spec.id, category: spec.category, score, basis });
  }
  found.sort((a,b) => b.score-a.score || a.id.localeCompare(b.id));
  const categoryCap = new Map<string, number>();
  const limit = Math.max(0, Math.min(input.limit ?? 5, 8));
  const chosen: SkillMatch[] = [];
  for (const x of found) {
    const max = x.category === "language" ? 2 : x.category === "framework" ? 2 : 1;
    if ((categoryCap.get(x.category) ?? 0) >= max) continue;
    chosen.push(x); categoryCap.set(x.category, (categoryCap.get(x.category) ?? 0) + 1);
    if (chosen.length >= limit) break;
  }
  return { matches: chosen, filesExamined: inv.paths.length, manifestCount: inv.manifests.length };
}
