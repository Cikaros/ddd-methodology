/**
 * Project evidence collector: the single read-only evidence source for CLI and RPC.
 * This module does not decide whether a business design is good; it only examines
 * declared files and reproducible, mechanical evidence. No report file is trusted
 * as a substitute for its source material.
 */
import { readFileSync, existsSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, relative, sep, isAbsolute, basename, extname, posix } from 'node:path';

export class EvidenceError extends Error { constructor(message) { super(message); this.name = 'EvidenceError'; } }
export function within(root, path) {
  const rel = relative(resolve(root), resolve(path));
  return !rel || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
function safeTarget(root, target) {
  if (typeof target !== 'string' || !target || target.includes('\0') || target.includes('\\') || isAbsolute(target)) return null;
  const parts = target.split('/');
  if (parts.some(p => !p || p === '..' || p === '.')) return target === '.' ? resolve(root) : null;
  const abs = resolve(root, target);
  if (!within(root, abs)) return null;
  // Do not allow a declared path to follow symlinks out of the project (or across package bounds).
  let walk = resolve(root);
  for (const part of parts) {
    walk = join(walk, part);
    if (existsSync(walk) && lstatSync(walk).isSymbolicLink()) return null;
  }
  return abs;
}
export function readJsonlStrict(file, { optional = true, maxLineBytes = 1_048_576 } = {}) {
  if (!existsSync(file)) {
    if (optional) return [];
    throw new EvidenceError(`缺少 JSONL：${file}`);
  }
  const raw = readFileSync(file, 'utf8');
  const rows = [];
  raw.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    if (Buffer.byteLength(line, 'utf8') > maxLineBytes) throw new EvidenceError(`${file}:${index + 1} 超过单行大小限制`);
    try {
      const value = JSON.parse(line);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('不是 JSON 对象');
      rows.push(value);
    } catch (e) {
      throw new EvidenceError(`${file}:${index + 1} JSONL 损坏：${e.message}`);
    }
  });
  return rows;
}
function readText(path) { return existsSync(path) ? readFileSync(path, 'utf8') : undefined; }
function readJson(file) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { throw new EvidenceError(`${file} JSON 无法解析：${e.message}`); }
}
export function frontmatter(md = '') {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
function walkFiles(dir, extension = '.md') {
  if (!existsSync(dir)) return [];
  const result = [];
  function walk(path) {
    for (const ent of readdirSync(path, { withFileTypes: true })) {
      if (ent.isSymbolicLink()) continue;
      const abs = join(path, ent.name);
      if (ent.isDirectory()) walk(abs);
      else if (ent.isFile() && ent.name.endsWith(extension)) result.push(abs);
    }
  }
  walk(dir);
  return result.sort();
}
function isTemplate(target) { return /<[^>]+>/.test(target ?? ''); }
function targetForDesign(file) { return basename(file).replace(/^DESIGN-/, '').replace(/\.md$/,''); }
function checkDesignTarget(root, file, target, level, landed) {
  const p = safeTarget(root, target);
  if (!p) return '无效或越界 target';
  if (level === 'file') {
    const ddd = join(root, 'docs', 'ddd');
    const relativeDir = relative(ddd, dirname(file)).replace(/\\/g,'/');
    const expectedDir = relativeDir === '.' ? '' : relativeDir;
    const actualDir = posix.dirname(target) === '.' ? '' : posix.dirname(target);
    if (expectedDir !== actualDir) return `设计位置与 target 目录不同（${expectedDir} ≠ ${actualDir}）`;
    if (posix.basename(target).replace(/\.[^.]+$/, '') !== targetForDesign(file)) return `设计名与 target 不同（${targetForDesign(file)}）`;
  }
  if (landed === 'true' && !existsSync(p)) return `landed:true 但目标不存在：${target}`;
  if (landed === 'true' && existsSync(p) && lstatSync(p).isSymbolicLink()) return `目标是符号链接：${target}`;
  return null;
}
/** Scan directly from docs/ddd, never from an editable/stale design-tree.json. */
export function scanDesignTree(root) {
  const ddd = join(root, 'docs', 'ddd');
  if (!existsSync(ddd)) return null;
  const designs = [], tests = [], problems = [], missingUnitTests = [], missingGroupTests = [], duplicateTargets = [], duplicateIds = [];
  const seenTargets = new Set(), seenTestIds = new Set();
  for (const p of walkFiles(ddd)) {
    const name = basename(p), rel = relative(root, p).replace(/\\/g, '/');
    if (!/^(DESIGN|UNIT-TESTS|TESTS)(?:-|\.)/.test(name)) continue;
    const body = readFileSync(p, 'utf8');
    const meta = frontmatter(body) ?? {};
    if (/^DESIGN(?:-|\.)/.test(name)) {
      const d = { path: rel, level: meta.level, target: meta.target, status: meta.status, landed: meta.landed, covers: meta.covers, depends: meta.depends };
      designs.push(d);
      if (!['subproject','module','group','file'].includes(meta.level)) problems.push(`${rel}: level 无效或缺失`);
      if (!['draft','frozen'].includes(meta.status)) problems.push(`${rel}: status 无效或缺失`);
      if (!['true','false'].includes(meta.landed)) problems.push(`${rel}: landed 无效或缺失`);
      if (meta.landed === 'true' && meta.status !== 'frozen') problems.push(`${rel}: 未冻结却 landed:true`);
      if (!meta.target) problems.push(`${rel}: 缺 target`);
      if (meta.target && !isTemplate(meta.target)) {
        const err = checkDesignTarget(root, p, meta.target, meta.level, meta.landed);
        if (err) problems.push(`${rel}: ${err}`);
        if (meta.level === 'file') {
          if (seenTargets.has(meta.target)) duplicateTargets.push(meta.target);
          seenTargets.add(meta.target);
        }
      }
      if (meta.level === 'file' && !isTemplate(meta.target)) {
        const t = join(dirname(p), `UNIT-TESTS-${targetForDesign(p)}.md`);
        if (!existsSync(t)) missingUnitTests.push(rel);
      }
      if (meta.level === 'group' && !isTemplate(meta.target)) {
        const group = (meta.target ?? '').split('/').filter(Boolean).at(-1) ?? 'group';
        const candidates = [`TESTS-${group}.md`, `TESTS-${basename(dirname(p))}.md`];
        if (!candidates.some(x => existsSync(join(dirname(p), x)))) missingGroupTests.push(rel);
      }
    } else {
      const ids = [...body.matchAll(/\|\s*((?:UT|ST|MT|GT)-[A-Za-z0-9-]+-\d+)\s*\|/g)].map(x=>x[1]);
      tests.push({ path: rel, target: meta.target, status: meta.status, landed: meta.landed, ids });
      for (const id of ids) {
        if (seenTestIds.has(id)) duplicateIds.push(id);
        else seenTestIds.add(id);
      }
    }
  }
  if (!designs.length) problems.push('docs/ddd 无 DESIGN 文档');
  return { designs, tests, gaps: { mismatches: problems, missingUnitTests, missingGroupTests, duplicateTargets, duplicateIds }, counts: { design: designs.length, test: tests.length, ids: seenTestIds.size } };
}
function sectionHasContent(text, heading) {
  const re = new RegExp(`^#{1,6}\\s*[^\\n]*(?:${heading})[^\\n]*$`, 'gim');
  const m = re.exec(text);
  if (!m) return false;
  const tail = text.slice(m.index + m[0].length);
  const untilNext = tail.split(/^#{1,6}\s+/m)[0];
  const substantive = untilNext.replace(/<!--[^]*?-->/g,'').replace(/\s+/g,'').replace(/[-*|#:]+/g,'');
  return substantive.length >= 10 && !/^\W*(?:TODO|TBD|待定|未填写)/i.test(substantive);
}
function countOpenRulings(requirements) {
  const m = requirements.match(/^##\s*[^\n]*(?:裁决记录|Decisions|Rulings)[^\n]*\n([\s\S]*?)(?=^##\s+|$(?![\s\S]))/mi);
  if (!m) return NaN;
  return m[1].split(/\r?\n/).filter(x => /^\|\s*[^|]+\|/.test(x) && /\|\s*(?:未决|待定|open|pending)\s*\|?\s*$/i.test(x)).length;
}
function archivedBoardCount(rows) {
  const active = new Map();
  // Per task, last event wins; any record after archive must explicitly re-create task.
  for (const row of rows) {
    if (!row.taskId || typeof row.taskId !== 'string') throw new EvidenceError('看板记录缺 taskId');
    if (row.kind === 'task') active.set(row.taskId, row);
    else if (row.kind === 'archive') {
      if (!active.has(row.taskId)) throw new EvidenceError(`看板重复或无效归档：${row.taskId}`);
      active.delete(row.taskId);
    } else if (row.kind === 'move') {
      if (!active.has(row.taskId)) throw new EvidenceError(`看板转移未找到任务：${row.taskId}`);
    } else if (row.kind === 'evidence') {
      if (!active.has(row.taskId)) throw new EvidenceError(`看板证据未找到任务：${row.taskId}`);
    }
  }
  return active.size; // Includes blocked dependencies and done-but-unarchived tasks.
}
function countVersionLocations(root, pkg, changelog, errors) {
  const version = pkg?.version;
  if (typeof version !== 'string' || !version) return 0;
  let places = 1;
  if (changelog.length && changelog.at(-1)?.version === `v${version}`) places++;
  const configs = ['opencode.json','opencode.jsonc', '.opencode/opencode.json', '.opencode/opencode.jsonc'];
  let pin = false;
  for (const c of configs) {
    const txt = readText(join(root,c));
    if (!txt) continue;
    const named = `${pkg.name ?? ''}@${version}`;
    if (txt.includes(named)) { pin = true; break; }
    // Git commit pins cannot be correlated with package version offline; require external verification.
    if (/(?:github:|git\+https:|git\+ssh:)[^\s"']+#[a-f0-9]{40}/i.test(txt)) errors.push(`${c}: Git SHA 钉版需人工核实与 ${version} 的对应关系`);
  }
  if (pin) places++;
  return places;
}
function validateLanding(root, target, designFile) {
  const abs = safeTarget(root, target);
  const permitted = !!abs && extname(target) !== '' && !target.startsWith('docs/');
  const result = { id: target, existsBytes: 0, schemaValid: false, whitelisted: permitted };
  if (!permitted || !existsSync(abs)) return result;
  const stat = lstatSync(abs);
  if (!stat.isFile()) return result;
  result.existsBytes = stat.size;
  if (stat.size <= 10) return result;
  if (/\.json$/.test(target)) {
    try { const val = JSON.parse(readFileSync(abs,'utf8')); result.schemaValid = val !== undefined && val !== null; }
    catch { result.schemaValid = false; }
  } else if (/\.jsonl$/.test(target)) {
    try { readJsonlStrict(abs); result.schemaValid = true; } catch { result.schemaValid = false; }
  } else if (/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|md|yaml|yml|py|java|go|rs|sh|sql|html|css|scss|vue)$/i.test(target)) {
    result.schemaValid = readFileSync(abs, 'utf8').trim().length > 10;
  } else {
    // Unknown format cannot be silently marked schemaValid.
    result.schemaValid = false;
  }
  return result;
}
/**
 * Collect a ProjectState and transparent evidence diagnostics, using only live files.
 * `commandNames` is the runtime command registration; mismatch with assets is counted.
 * `packageRoot` is where the plugin's own authoritative assets are stored.
 */
export function collectProjectEvidence(rootInput, { commandNames = [], packageRoot = rootInput } = {}) {
  const root = resolve(rootInput);
  const errors = [], details = {};
  const state = {};
  const relError = (error) => String(error).replaceAll(root + '/', '').replaceAll(root + '\\', '');
  const req = readText(join(root,'docs','REQUIREMENTS.md'));
  if (req !== undefined) {
    const meta = frontmatter(req);
    const openRulings = countOpenRulings(req);
    state.requirements = { frozen: meta?.status === 'frozen', openRulings: Number.isFinite(openRulings) ? openRulings : 1 };
    if (!Number.isFinite(openRulings)) errors.push('G1: 裁决记录节缺失或无法计数；不得假定未决数为零');
  }
  const arch = readText(join(root,'docs','ARCHITECTURE.md'));
  if (arch !== undefined) {
    state.architecture = {
      techStack: sectionHasContent(arch,'技术栈|tech.?stack'),
      dependencies: sectionHasContent(arch,'核心依赖|dependenc'),
      directory: sectionHasContent(arch,'目录结构|director'),
      environment: sectionHasContent(arch,'环境探查|environment'),
    };
  }
  const design = scanDesignTree(root);
  if (design) {
    let registryMismatches = 0;
    try {
      const registered = readJson(join(packageRoot,'assets','commands.json'))?.commands;
      const names = registered?.map(c => c.name) ?? [];
      if (!names.length || !commandNames.length) registryMismatches = 1;
      else registryMismatches = [...new Set([...names,...commandNames])].filter(n => !names.includes(n) || !commandNames.includes(n)).length + Math.abs(names.length-commandNames.length);
      details.commandRegistry = { declared: names, runtime: commandNames };
    } catch (e) { errors.push(`G3: ${relError(e.message)}`); registryMismatches = 1; }
    const problems = [...design.gaps.mismatches, ...design.gaps.duplicateTargets.map(x=>`重复 target: ${x}`)];
    state.designTree = { isomorphicMismatches: problems.length, commandRegistryMismatches: registryMismatches };
    state.testTree = { missingCoverage: design.gaps.missingUnitTests.length + design.gaps.missingGroupTests.length + design.gaps.duplicateIds.length };
    state.landings = { items: design.designs.filter(d=>d.level==='file' && !isTemplate(d.target) && d.target).map(d=> { const result=validateLanding(root,d.target,d.path); if (d.landed !== 'true') return { ...result, schemaValid: false }; return result; }) };
    details.designTree = design;
    details.isomorphism = problems;
  }
  const hasBoard = existsSync(join(root,'docs','board','board.jsonl'));
  if (hasBoard) {
    let tempOpen = 0, boardActive = 0, versionPlaces = 0, defectsRegister = false;
    try { tempOpen = readJsonlStrict(join(root,'docs','temp.jsonl')).length; }
    catch (e) { tempOpen = 1; errors.push(`G6: ${relError(e.message)}`); }
    try { boardActive = archivedBoardCount(readJsonlStrict(join(root,'docs','board','board.jsonl'),{optional:false,maxLineBytes:8192})); }
    catch (e) { boardActive = 1; errors.push(`G6: ${relError(e.message)}`); }
    try {
      const pkg = readJson(join(root, 'package.json'));
      const history = readJsonlStrict(join(root,'docs','CHANGELOG.jsonl'));
      versionPlaces = countVersionLocations(root, pkg, history, errors);
    } catch (e) { errors.push(`G6: ${relError(e.message)}`); }
    try { defectsRegister = existsSync(join(root,'docs','defects.jsonl')); if (defectsRegister) readJsonlStrict(join(root,'docs','defects.jsonl')); }
    catch (e) { defectsRegister = false; errors.push(`G6: ${relError(e.message)}`); }
    state.wrapup = { tempOpen, boardActive, versionPlaces, defectsRegister };
  }
  return { state, errors, details };
}
