/** Bounded, secret-redacted diagnostics for optional host hooks. Never silently swallow failures. */
export type DiagnosticSeverity = 'warning' | 'error';
export interface Diagnostic { readonly code: string; readonly severity: DiagnosticSeverity; readonly detail: string; readonly at: string }

export function diagnosticMessage(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return raw.replace(/(sk-[a-z0-9_-]{8,}|(?:password|token|api[_-]?key)\s*[=:]\s*\S+)/gi, '[REDACTED]')
    .replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').slice(0, 240);
}
export class Diagnostics {
  readonly #entries: Diagnostic[] = [];
  readonly #emitted = new Set<string>();
  private readonly limit: number;
  private readonly output: (message: string) => void;
  constructor(limit = 32, output: (message: string) => void = console.error) { this.limit = limit; this.output = output; }
  record(code: string, error: unknown, severity: DiagnosticSeverity = 'warning'): void {
    const item = { code, detail: diagnosticMessage(error), severity, at: new Date().toISOString() } as const;
    this.#entries.push(item);
    if (this.#entries.length > this.limit) this.#entries.shift();
    if (!this.#emitted.has(`${code}:${item.detail}`)) {
      this.#emitted.add(`${code}:${item.detail}`);
      this.output(`[ddd:${severity}] ${code}: ${item.detail}`);
    }
  }
  snapshot(): readonly Diagnostic[] { return [...this.#entries]; }
  async optional<T>(code: string, action: () => Promise<T> | T, fallback: T): Promise<T> {
    try { return await action(); } catch (error) { this.record(code, error); return fallback; }
  }
}
