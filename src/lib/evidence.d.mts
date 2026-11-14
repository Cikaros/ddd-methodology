/** TypeScript facade for the Node-native evidence reader (evidence.mjs).
 * The JS implementation remains directly callable from offline CLI scripts.
 */
import type { ProjectState } from './gates.ts';
export declare class EvidenceError extends Error {}
export declare function within(root: string, path: string): boolean;
export declare function readJsonlStrict(file: string, options?: {optional?: boolean; maxLineBytes?: number}): Record<string, unknown>[];
export declare function frontmatter(markdown?: string): Record<string, string> | null;
export declare function scanDesignTree(root: string): null | {
  designs: Array<{ path: string; level?: string; target?: string; status?: string; landed?: string; covers?: string; depends?: string }>;
  tests: Array<{ path: string; target?: string; status?: string; landed?: string; ids: string[] }>;
  gaps: { mismatches: string[]; missingUnitTests: string[]; missingGroupTests: string[]; duplicateTargets: string[]; duplicateIds: string[] };
  counts: { design: number; test: number; ids: number };
};
export declare function collectProjectEvidence(root: string, options?: { commandNames?: readonly string[]; packageRoot?: string }): {
  state: ProjectState;
  errors: string[];
  details: Record<string, unknown>;
};
