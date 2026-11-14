import type {MemoryEntry,MemoryConfig} from './memory.ts';
export function readMemoryRows(root:string):Record<string,unknown>[];
export function foldMemoryRows(rows:readonly Record<string,unknown>[]):MemoryEntry[];
export function recordMemoryHit(root:string,entry:MemoryEntry,sessionID:string,cfg:MemoryConfig):Promise<{written:number;records:MemoryEntry[]}>;
export function recordSessionDecay(root:string,sessionID:string,cfg:MemoryConfig):Promise<{written:number;records:MemoryEntry[]}>;
