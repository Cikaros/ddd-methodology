/** OpenCode server entry point. Assembly and behavior live in runtime.ts. */
import { Plugin } from '@opencode/plugin';
import { setupRuntime } from './runtime.ts';
export default Plugin.define({ id: 'ddd', setup: setupRuntime });
