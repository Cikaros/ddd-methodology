/** Request-scoped context and evidence policy; does not mutate the model API request format. */
import { existsSync,readFileSync } from 'node:fs';
import { packagePath,projectRoot,projectPath } from './paths.ts';
import { routeSlices, type SliceSpec,type Phase,type Intent } from './router.ts';
import { project as boardProject,projectAll as boardAll,summarize as boardSummary,type BoardConfig } from './board.ts';
import { readBoardRows } from './board-store.mjs';
import { readJsonlStrict } from './jsonl.mjs';
import { readCheckpoint,resumeHint } from './workflow-store.mjs';
import {readTrace,recordTrace} from './trace-store.mjs';
import {foldMemoryRows} from './memory-store.mjs';
import { countCandidates,projectScope,type MemoryEntry,type MemoryConfig } from './memory.ts';
import { selectApplicableMemory, type VersionedMemory } from './memory-policy.ts';
import { selectEvidence,projectEvidenceRevision } from './evidence-retrieval.mjs';
import { contextBudget,composeContext } from './model-policy.ts';
import { Diagnostics } from './diagnostics.ts';
import { selectCurrentSkills } from './skill-plan.ts';
import { COMMANDS } from './registry.ts';

export const CORE_DISCIPLINE='[ddd] 关键纪律：文档为唯一权威（先改文档再落地）；变更须落 CHANGELOG 三字段；执行规则必落可执行面；持久多步待办走看板（带 acceptance）；交付须逐项、不得以摘要代替；可修问题当场修或落看板追踪，不得以「建议后续」收尾。';
function firstLine(source:string):string{
  const file=packagePath(source);if(!existsSync(file))return '';
  for(const line of readFileSync(file,'utf8').split(/\r?\n/)){
    const v=line.trim();if(v&&!/^(---|#|name:|description:)/.test(v))return v.slice(0,36);
  }
  return '';
}
export const foldMemory=foldMemoryRows as (rows:readonly Record<string,unknown>[])=>VersionedMemory[];
export function createContextHook(ctx:any, config:{options:Record<string,unknown>;boardCfg:BoardConfig;memoryCfg:MemoryConfig;slices:readonly SliceSpec[];roleTools:Record<string,string[]>;diagnostics:Diagnostics;ownerSession?:(sessionID:string)=>string}){
  const {options,boardCfg,memoryCfg,slices,roleTools,diagnostics}=config;
  const observedModels=new Map<string,string>();
  return async (ev:any)=>{
    try{
      const sessionID=ev.sessionID;if(typeof sessionID!=='string'||!sessionID)throw Error('context 缺 sessionID');
      // Child agent uses the initiating task's state/evidence, while maintaining
      // its own host instructions entry. Mapping survives runtime reloads.
      const ownerSessionID=config.ownerSession?.(sessionID)??sessionID;
      let viaEntry=false;
      if(typeof ctx.session?.instructions?.entry?.put==='function'){
        try{
          const seen=await ctx.storage.get(`ddd.core.set.${sessionID}`);
          if(!seen){
            await ctx.session.instructions.entry.put({sessionID,key:'ddd.discipline',value:CORE_DISCIPLINE});
            viaEntry=true;
            try { await ctx.storage.set(`ddd.core.set.${sessionID}`,true); }
            catch(error) { diagnostics.record('storage.core',error); }
          } else viaEntry=true;
        }catch(error){diagnostics.record('instructions.entry',error);}
      }
      if(!viaEntry&&Array.isArray(ev.system))ev.system.push({type:'text',text:CORE_DISCIPLINE});
      const root=projectRoot(ctx.location),errors:string[]=[];
      let activeCheckpoint:ReturnType<typeof readCheckpoint>=null;
      let checkpointFailure=false;
      try { activeCheckpoint=readCheckpoint(root,ownerSessionID); }
      catch(error) {checkpointFailure=true;errors.push(`检查点：${(error as Error).message}`);diagnostics.record('context.checkpoint',error);}
      const activeStatus=new Set(['prepared','dispatched','running','awaiting_verification']);
      const role=activeCheckpoint&&activeStatus.has(activeCheckpoint.status)
        ? COMMANDS.find(c=>c.name===`ddd-${activeCheckpoint.phase}`)?.role:undefined;
      // A fallback-to-current-session command still runs under its DDD role's
      // tool restrictions; agent name alone is not a sufficient permission key.
      const allowed=roleTools[String(ev.agent??'')]??(role?roleTools[role]:undefined)
        ??(checkpointFailure?['read','grep','glob','skill']:undefined);
      if(allowed&&ev.tools&&typeof ev.tools==='object')for(const name of Object.keys(ev.tools))if(!allowed.includes(name))delete ev.tools[name];
      const phase=((await diagnostics.optional(`storage.phase`,()=>ctx.storage.get(`ddd:phase:${ownerSessionID}`),undefined)) as Phase|undefined) ?? (activeCheckpoint?.phase as Phase|undefined);
      const intent=(await diagnostics.optional(`storage.intent`,()=>ctx.storage.get(`ddd:intent:${ownerSessionID}`),undefined)) as Intent|undefined;
      // Record the model actually selected by OpenCode, without modifying it.
      const modelRef=ev.model??ev.options?.model;
      const modelID=typeof modelRef==='string'?modelRef:typeof modelRef?.id==='string'?`${modelRef.providerID??'unknown'}/${modelRef.id}`:undefined;
      if(modelID && observedModels.get(ownerSessionID)!==modelID){
        try{const t=await recordTrace(root,ownerSessionID,{type:'model',model:modelID});
          if(t){observedModels.set(ownerSessionID,modelID);if(observedModels.size>256)observedModels.delete(observedModels.keys().next().value!);}
        }catch(error){diagnostics.record('context.modelTrace',error);}
      }

      let board='',memory='',checkpoint='';
      let evidence: ReturnType<typeof selectEvidence>=[];
      let revision: string|undefined;
      try {
        evidence=selectEvidence(root,{phase,budgetTokens:260});
        revision=projectEvidenceRevision(root);
      } catch(error) {
        errors.push(`设计证据：${(error as Error).message}`);
        diagnostics.record('context.evidence',error);
      }
      const legacyRevisions=evidence.map(x=>x.sha256).filter((v):v is string=>typeof v==='string');
      try{
        const boardRows=readBoardRows(root,boardCfg.maxLineBytes);
        const all=boardAll(boardRows),visible=boardProject(boardRows);
        const s=boardSummary(all);const top=visible.slice(0,2).map(x=>`${x.taskId}(${x.priority}/${x.status}) ${x.title}`).join('; ');
        if(all.length)board=`待办 ${s.pending} / 进行 ${s.inProgress} / 阻塞 ${s.blocked}${top?`; top: ${top}`:''}`;
      }catch(error){errors.push(`看板：${(error as Error).message}`);diagnostics.record('context.board',error);}
      try{
        const entries=foldMemory(readJsonlStrict(projectPath(root,'docs/memory/memory.jsonl')));
        const selected=selectApplicableMemory(entries,projectScope(root),memoryCfg,{phase,revision,revisions:legacyRevisions}).slice(0,3).map(({entry:e,confidence})=>`${e.symptom??e.key}(${e.confidence}★;${confidence==='bound'?'版本匹配':'历史提示待核对'})`);
        const candidates=countCandidates(entries,memoryCfg);memory=selected.join('; ')+(candidates?`; 候选 ${candidates} 条`:'');
      }catch(error){errors.push(`记忆：${(error as Error).message}`);diagnostics.record('context.memory',error);}
      try{
        checkpoint=resumeHint(activeCheckpoint);
        const trace=readTrace(root,ownerSessionID);
        if(trace?.recentTools?.length)checkpoint+=` 最近工具：${trace.recentTools.slice(-3).map(x=>x.name+(x.failed?'(失败)':'(成功)')).join(',')}；输出结果需重新核验。`;
      }catch(error){errors.push(`检查点：${(error as Error).message}`);diagnostics.record('context.checkpoint',error);}
      const taskHints = await diagnostics.optional('storage.skillHints', () => ctx.storage.get(`ddd:skill-hints:${ownerSessionID}`), []);
      const skillIds = selectCurrentSkills(root, taskHints);
      const route=routeSlices({phase,intent},slices);
      const hints=route.sliceIds.map(id=>{const source=slices.find(s=>s.id===id)?.source;return{id,source,preview:source?firstLine(source):undefined};});
      const budget=contextBudget(ev.model??ev.options?.model??options.model,options.contextBudgetChars,phase,intent,typeof options.profile==='string'?options.profile:undefined);
      const content=composeContext({budget,phase,intent,slices:hints,skills:skillIds,evidence,board,memory,checkpoint,errors});
      if(Array.isArray(ev.system)&&!ev.system.some((p:any)=>String(p.text??'').startsWith('[ddd:runtime]')))ev.system.push({type:'text',text:content});
    }catch(error){diagnostics.record('context.hook',error,'error');}
  };
}
