import type { BugReportPayload } from '@/lib/reports/bugReportModel';

const REDACT =
  /\b(pk|Bearer|authorization|cookie|secret|seed|mnemonic|private[_ ]?key|refresh[_ ]?token)[:\s]+[^\s]+/gi;

/** Short stable fingerprint — not reversible; avoids shipping raw addresses/mints verbatim when wallet-scoped. */
export function fingerprintId(raw: string, prefix: string): string {
  let h = 0;
  const s = `${prefix}:${raw}`;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return `${prefix}_${(h >>> 0).toString(16)}`;
}

/** Truncate visually for wallets (token mints passed through elsewhere intentionally as public IDs). */
export function maskMiddle(raw: string, head = 4, tail = 4): string {
  const t = raw.trim();
  if (!t.length) return '—';
  if (t.length <= head + tail + 3) return '***';
  return `${t.slice(0, head)}…${t.slice(-tail)}`;
}

export function redactSnippet(s: string, maxLen = 800): string {
  const clipped = s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`;
  return clipped.replace(REDACT, (_, k: string) => `${String(k).split(/\s+/)[0]}:[redacted]`);
}

/** Final pass before persistence / transport — strip obvious secrets from user-entered + stack text. */
export function sanitizeSubmittedPayload(payload: BugReportPayload): BugReportPayload {
  return {
    ...payload,
    description: redactSnippet(payload.description, 12_000),
    context: {
      ...payload.context,
      recentClientErrors:
        payload.context.recentClientErrors?.map((e) => ({
          ...e,
          message: redactSnippet(e.message, 400),
          stackSnippet: e.stackSnippet ? redactSnippet(e.stackSnippet, 900) : undefined,
        })),
      userAgent: redactSnippet(payload.context.userAgent, 500),
    },
  };
}
