export type WorkflowStatus = 'prepared'|'dispatched'|'running'|'awaiting_verification'|'verified'|'failed'|'superseded';
export interface WorkflowReceipt { readonly seq:number;readonly phase:string;readonly status:WorkflowStatus;readonly at:string;readonly requestHash:string;readonly reason?:string;readonly proof?:{readonly status:'passed';readonly fingerprint:string;readonly checks:readonly {readonly name:string;readonly passed:boolean;readonly exitCode:number|null}[]};readonly targetSessionHash?:string }
export interface WorkflowCheckpoint extends WorkflowReceipt {readonly schema:1|2;readonly taskSeq?:number;readonly history:readonly WorkflowReceipt[]}
export interface VerificationProof { readonly status:'passed';readonly fingerprint:{readonly sha256:string};readonly checks:readonly {readonly name:string;readonly passed:boolean;readonly exitCode?:number|null}[] }
export function checkpointPath(root:string,sessionID:string):string;
export function readCheckpoint(root:string,sessionID:string):WorkflowCheckpoint|null;
export function recordWorkflow(root:string,sessionID:string,event:{phase:string;status:WorkflowStatus;requestText?:string;targetSessionID?:string;proof?:VerificationProof;reason?:string}):Promise<WorkflowCheckpoint>;
export function recordDispatch(root:string,sessionID:string,phase:string,status:'prepared'|'dispatched'|'failed',requestText?:string):Promise<WorkflowCheckpoint>;
export function resumeHint(value:WorkflowCheckpoint|null):string;
