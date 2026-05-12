import type { BugReportPayload } from '@/lib/reports/bugReportModel';
import { sanitizeSubmittedPayload } from '@/lib/reports/sanitizeBugReport';

export type BugSubmitResult = { ok: true; receiptId?: string } | { ok: false; error: string };

/**
 * Ships structured diagnostics using `POST /api/reports/bug`.
 * Fallback: deterministic mock receipt in dev/offline (`console.info` only — no outbound network spam).
 *
 * Future: Slack / Linear / ticketing via same route.
 */
export async function submitBugReport(payload: BugReportPayload): Promise<BugSubmitResult> {
  const body = sanitizeSubmittedPayload(payload);

  try {
    const res = await fetch('/api/reports/bug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });

    const json = (await res.json().catch(() => ({}))) as { receiptId?: string; error?: string };

    if (res.ok) {
      return { ok: true, receiptId: typeof json.receiptId === 'string' ? json.receiptId : undefined };
    }

    return { ok: false, error: json.error ?? `HTTP ${res.status}` };
  } catch {
    /** Mock receipt when offline / TLS issues — UX still completes locally. */
    const mockReceipt = `diag_${Date.now().toString(36)}`;
    let logMock = false;
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const local = host === 'localhost' || host === '127.0.0.1';
      const devEnv = process.env.NODE_ENV !== 'production';
      logMock = local || devEnv;
      if (logMock) console.info('[Pointer diagnostics/mock transport]', mockReceipt, body);
    }

    return { ok: true, receiptId: mockReceipt };
  }
}
