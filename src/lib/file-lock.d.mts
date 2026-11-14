export function withFileLock<T>(lock:string,action:()=>T|Promise<T>,options?:{timeoutMs?:number;staleMs?:number}):Promise<T>;
