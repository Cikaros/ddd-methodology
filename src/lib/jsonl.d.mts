export declare class EvidenceError extends Error {}
export declare function readJsonlStrict(file: string, options?: {optional?: boolean; maxLineBytes?: number}): Record<string,unknown>[];
