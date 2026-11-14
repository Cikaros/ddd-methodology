/** One result object for server RPC, CLI and gate reports; no cached reports as authority. */
import { collectProjectEvidence } from './evidence.mjs';
import { gates, summarize, canAdvance, type GateReading } from './gates.ts';

export interface EvaluatedGates {
  readonly state: ReturnType<typeof collectProjectEvidence>['state'];
  readonly readings: readonly GateReading[];
  readonly summary: ReturnType<typeof summarize>;
  readonly errors: readonly string[];
  readonly details: ReturnType<typeof collectProjectEvidence>['details'];
  readonly canAdvance: boolean;
  readonly readyForRelease: boolean;
}

export function evaluateProject(root:string, commandNames:readonly string[], packageRoot:string): EvaluatedGates {
  const {state, errors, details}=collectProjectEvidence(root,{commandNames,packageRoot});
  const readings: GateReading[]=[gates.G1(state),gates.G2(state),gates.G3(state),gates.G4(state),gates.G5(state),gates.G6(state)];
  for(const msg of errors){
    const idx = /^G([1-6]):/.exec(msg)?.[1];
    const index=idx?Number(idx)-1:5;
    const prior=readings[index];
    readings[index]={id:prior.id,verdict:'block',examined:prior.examined,unrecognized:prior.unrecognized+1,remedy:[prior.remedy,msg].filter(Boolean).join('；').slice(0,2000)};
  }
  // G6 may be structurally clean while G1–G5 are unresolved, but cannot be a release pass.
  if(readings[5].verdict==='pass'&&readings.slice(0,5).some(x=>x.verdict!=='pass')) {
    readings[5]={...readings[5],verdict:'visible',remedy:'收尾资料完整，但 G1–G5 尚未全部通过；不可发布。'};
  }
  const summary=summarize(readings);
  return {state,readings,summary,errors,details,canAdvance:errors.length===0&&canAdvance(readings),readyForRelease:readings.every(x=>x.verdict==='pass')&&errors.length===0};
}
