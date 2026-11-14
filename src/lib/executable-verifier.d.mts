export interface SourceFingerprint {readonly sha256:string;readonly files:number}
export interface TestCheck {readonly name:string;readonly passed:boolean;readonly exitCode:number|null;readonly signal?:string|null;readonly output?:string;readonly error?:string}
export interface ExecutableVerification { readonly status:'unverified'|'passed'|'failed';readonly kind:string;readonly checks:readonly TestCheck[];readonly reason:string;readonly fingerprint:SourceFingerprint|null }
export function fingerprint(root:string):SourceFingerprint;
export function detectChecks(root:string):{readonly kind:string;readonly checks?:readonly {readonly name:string;readonly command:string;readonly args:readonly string[]}[];readonly reason?:string};
export function verifyExecutable(root:string,options?:{timeoutMs?:number}):ExecutableVerification;
