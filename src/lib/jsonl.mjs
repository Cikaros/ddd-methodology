/** Shared strict JSONL parser for the evidence and board boundaries. */
import {existsSync,readFileSync} from 'node:fs';
export class EvidenceError extends Error { constructor(message) { super(message); this.name = 'EvidenceError'; } }
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
