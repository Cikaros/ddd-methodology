/** Transaction boundary for board JSONL. One canonical reader for CLI / evidence / runtime. */
import { readFileSync, existsSync, lstatSync, openSync, writeFileSync, closeSync, unlinkSync, statSync, mkdirSync, renameSync, fsyncSync, appendFileSync } from 'node:fs';
import { dirname, resolve, join, relative, isAbsolute, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { readJsonlStrict } from './jsonl.mjs';
import { validateBoardHistory } from './board.ts';
import {withFileLock} from './file-lock.mjs';

export function assertLocalPath(root, path) {
  const parent = resolve(root), target = resolve(path);
  const rel = relative(parent,target);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('看板路径越界');
  let current = parent;
  if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('项目根为符号链接');
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`不允许符号链接: ${part}`);
  }
}
export function boardPaths(root) {
  return { jsonl: join(resolve(root),'docs','board','board.jsonl'), md: join(resolve(root),'docs','board','BOARD.md') };
}
export function readBoardRows(root, maxLineBytes=8192) {
  const { jsonl }=boardPaths(root);
  assertLocalPath(root,jsonl);
  const rows=readJsonlStrict(jsonl,{maxLineBytes});
  validateBoardHistory(rows);
  return rows;
}
export async function withBoardLock(root, action, {timeoutMs=3000}={}) {
  const {jsonl}=boardPaths(root);
  assertLocalPath(root,jsonl);
  mkdirSync(dirname(jsonl),{recursive:true});
  return withFileLock(`${jsonl}.lock`,action,{timeoutMs});
}
export function appendBoardRow(root,row,maxLineBytes=8192){
  const {jsonl}=boardPaths(root);
  assertLocalPath(root,jsonl);
  const bytes=JSON.stringify(row)+'\n';
  if(Buffer.byteLength(bytes,'utf8')>maxLineBytes)throw new Error('新事件超过 maxLineBytes');
  appendFileSync(jsonl,bytes,'utf8');
}
export function writeBoardView(root,content){
  const {md}=boardPaths(root);
  assertLocalPath(root,md);
  mkdirSync(dirname(md),{recursive:true});
  const tmp=md+'.'+randomUUID()+'.tmp';
  const fd=openSync(tmp,'wx',0o600);
  try{writeFileSync(fd,content,'utf8');fsyncSync(fd);}finally{closeSync(fd);}
  try{renameSync(tmp,md);}catch(e){try{unlinkSync(tmp);}catch{}throw e;}
}
