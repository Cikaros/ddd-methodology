/** Suppress archived / stale version-bound memories. Legacy observations are hints, not verified facts. */
import { selectInjection, type MemoryEntry,type MemoryConfig } from './memory.ts';
export interface VersionedMemory extends MemoryEntry {readonly sourceRevision?:string;readonly validUntil?:string;readonly phase?:string}
export function selectApplicableMemory(entries:readonly VersionedMemory[],scope:string,cfg:MemoryConfig,opts:{revision?:string;revisions?:readonly string[];phase?:string;now?:string}={}){
  const selected=selectInjection(entries,scope,cfg) as VersionedMemory[];
  const now=opts.now??new Date().toISOString();
  return selected.filter(x=>{
    if(x.validUntil && (!Number.isFinite(Date.parse(x.validUntil)) || x.validUntil<now))return false;
    if(x.sourceRevision && x.sourceRevision!==opts.revision && !opts.revisions?.includes(x.sourceRevision))return false;
    if(x.phase && x.phase!==opts.phase)return false;
    return true;
  }).map(e=>({entry:e,confidence:e.sourceRevision?'bound':'unverified' as const}));
}
