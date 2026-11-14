/** Durable subagent-session ownership. Only opaque session IDs are stored, never prompts.
 * A child may outlive this plugin instance, so event attribution must survive reloads.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, lstatSync, readFileSync, openSync, writeFileSync, closeSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, sep, dirname } from 'node:path';
import { withFileLock } from './file-lock.mjs';

function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function sessionID(id) {
  if (typeof id !== 'string' || !id.trim() || id.length > 2048) throw Error('非法会话 ID');
  return id;
}
function existing(path) {
  try { return lstatSync(path); }
  catch (e) { if (e?.code === 'ENOENT') return null; throw e; }
}
function guarded(root, file) {
  const base = resolve(root), rel = relative(base, file);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) throw Error('会话关系路径越界');
  let current = base;
  for (const part of rel.split(sep).filter(Boolean)) {
    const st = existing(current);
    if (st?.isSymbolicLink()) throw Error('会话关系路径含符号链接');
    current = join(current, part);
  }
  if (existing(current)?.isSymbolicLink()) throw Error('会话关系文件为符号链接');
}
function fileFor(root, child) {
  return join(resolve(root), '.ddd', 'state', 'sessions', digest(sessionID(child)) + '.json');
}
export function readParentLink(root, child) {
  const file = fileFor(root, child); guarded(root, file);
  if (!existing(file)) return null;
  const value = JSON.parse(readFileSync(file, 'utf8'));
  if (value?.schema !== 1 || value.childHash !== digest(child) || typeof value.parent !== 'string' || !value.parent.trim() || value.parent.length > 2048 || value.parent === child)
    throw Error('子会话映射损坏');
  return value.parent;
}
export async function linkChildSession(root, child, parent) {
  sessionID(child); sessionID(parent);
  if (child === parent) throw Error('子会话不得指向自身');
  const file = fileFor(root, child);
  guarded(root, dirname(file)); mkdirSync(dirname(file), { recursive: true }); guarded(root, file);
  return withFileLock(file + '.lock', async () => {
    const previous = readParentLink(root, child);
    if (previous && previous !== parent) throw Error('子会话已有不同归属，拒绝覆盖');
    if (previous === parent) return false;
    const value = { schema: 1, childHash: digest(child), parent, createdAt: new Date().toISOString() };
    const tmp = file + '.' + randomUUID() + '.tmp';
    try {
      const fd = openSync(tmp, 'wx', 0o600);
      try { writeFileSync(fd, JSON.stringify(value) + '\n'); fsyncSync(fd); }
      finally { closeSync(fd); }
      renameSync(tmp, file);
    } finally { if (existing(tmp)) unlinkSync(tmp); }
    return true;
  });
}
