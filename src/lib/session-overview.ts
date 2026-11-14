/** One read model for TUI/RPC: command state + current Skills + board + gates.
 * All readings are projected from authoritative stores at request time.
 */
import { COMMANDS } from './registry.ts';
import { selectCurrentSkills } from './skill-plan.ts';
import { evaluateProject } from './gate-evaluator.ts';
import { readBoardRows } from './board-store.mjs';
import { projectAll as boardAll, summarize as boardSummary, type BoardConfig } from './board.ts';
import { packageRoot } from './paths.ts';
import { resumeHint } from './workflow-store.mjs';
import type { WorkflowController } from './workflow-controller.ts';

export interface SessionOverview {
  readonly phase: string;
  readonly status: string;
  readonly seq: number;
  readonly summary: string;
  readonly skills: readonly string[];
  readonly gates: {readonly pass:number; readonly block:number; readonly visible:number; readonly na:number};
  readonly blockedGates: readonly string[];
  readonly board: {readonly pending:number; readonly inProgress:number; readonly blocked:number};
  readonly canVerify: boolean;
  readonly proofSha: string;
}
export async function readSessionOverview(root:string, sessionID:string, workflow:WorkflowController,
  getHints:(ownerSession:string)=>Promise<unknown>, boardConfig:BoardConfig):Promise<SessionOverview>{
  const owner=workflow.originalSession(sessionID);
  const checkpoint=workflow.current(owner);
  const gateStatus=evaluateProject(root,COMMANDS.map(x=>x.name),packageRoot());
  const board=boardSummary(boardAll(readBoardRows(root,boardConfig.maxLineBytes)));
  const hints=await getHints(owner);
  return {
    phase:checkpoint?.phase??'',status:checkpoint?.status??'missing',seq:checkpoint?.seq??0,
    summary:checkpoint?resumeHint(checkpoint):'当前会话无 ddd 工作流',
    skills:selectCurrentSkills(root,hints), gates:gateStatus.summary,
    blockedGates:gateStatus.readings.filter(r=>r.verdict==='block').map(r=>r.id),
    board:{pending:board.pending,inProgress:board.inProgress,blocked:board.blocked},
    canVerify:checkpoint?.status==='awaiting_verification',
    proofSha:checkpoint?.proof?.fingerprint??'',
  };
}
