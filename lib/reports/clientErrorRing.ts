import type { ClientErrorBrief } from '@/lib/reports/bugReportModel';
import { redactSnippet } from '@/lib/reports/sanitizeBugReport';

const MAX = 14;
let ring: ClientErrorBrief[] = [];
let installed = false;

function push(entry: Omit<ClientErrorBrief, 'atIso'> & { at?: number }) {
  const atIso = new Date(entry.at ?? Date.now()).toISOString();
  const cleaned: ClientErrorBrief = {
    atIso,
    kind: entry.kind,
    message: redactSnippet(entry.message, 500),
    origin: entry.origin ? redactSnippet(entry.origin, 280) : undefined,
    stackSnippet: entry.stackSnippet ? redactSnippet(entry.stackSnippet, 900) : undefined,
  };
  ring = [cleaned, ...ring].slice(0, MAX);
}

function stripSearch(urlish: string): string {
  const i = urlish.indexOf('?');
  return i >= 0 ? urlish.slice(0, i) : urlish;
}

/**
 * Lightweight client-side instrumentation for diagnostics payloads.
 * Does not transmit automatically — only cloned into bug reports when the user submits.
 */
export function installClientErrorListeners(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  window.addEventListener(
    'error',
    (ev: ErrorEvent) => {
      const msg = typeof ev.message === 'string' && ev.message.trim() ? ev.message : ev.error?.toString?.() ?? 'error';
      const origin =
        typeof ev.filename === 'string'
          ? stripSearch(ev.filename + (typeof ev.lineno === 'number' ? `:${ev.lineno}` : ''))
          : undefined;
      const stack =
        typeof ev.error === 'object' && ev.error && 'stack' in ev.error ? String((ev.error as Error).stack) : undefined;
      push({
        kind: 'error',
        message: msg,
        origin,
        stackSnippet: stack,
      });
    },
    true,
  );

  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    const r = ev.reason;
    const message =
      r instanceof Error
        ? r.message || String(r.name)
        : typeof r === 'string'
          ? r
          : 'unhandledrejection';
    const stack = r instanceof Error && r.stack ? r.stack : undefined;
    push({ kind: 'rejection', message, stackSnippet: stack });
  });
}

export function snapshotRecentClientErrors(): ClientErrorBrief[] {
  return [...ring];
}
