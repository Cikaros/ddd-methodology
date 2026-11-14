export interface EvidenceSnippet {readonly path:string;readonly text:string;readonly sha256:string}
export function selectEvidence(root:string,options?:{phase?:string;budgetTokens?:number}):EvidenceSnippet[];

export function projectEvidenceRevision(root:string):string|undefined;
