import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  BUG_CATEGORY_OPTIONS,
  BUG_SEVERITY_OPTIONS,
  POINTER_REPORT_VERSION,
  type BugReportPayload,
} from '@/lib/reports/bugReportModel';

export const runtime = 'nodejs';

const CATEGORY_IDS = new Set<string>(BUG_CATEGORY_OPTIONS.map((c) => c.id));
const SEVERITY_IDS = new Set<string>(BUG_SEVERITY_OPTIONS.map((s) => s.id));

function coercePayload(raw: unknown): BugReportPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.reportVersion !== POINTER_REPORT_VERSION) return null;
  const cat = o.category;
  const sev = o.severity;
  const description = typeof o.description === 'string' ? o.description : '';
  const ctx = o.context;
  if (typeof cat !== 'string' || !CATEGORY_IDS.has(cat)) return null;
  if (typeof sev !== 'string' || !SEVERITY_IDS.has(sev)) return null;
  if (!description.trim() || description.length > 12000) return null;
  if (!ctx || typeof ctx !== 'object') return null;
  const cx = ctx as Record<string, unknown>;
  if (typeof cx.route !== 'string' || typeof cx.activeChain !== 'string') return null;

  /** Trust client structure when minimal shape matches — server does not widen scope. */
  return o as BugReportPayload;
}

/**
 * Diagnostics intake endpoint.
 *
 * TODO: Persist to warehouse / ticketing (Supabase bug_reports etc.), alerting on `urgent_funds`,
 * and attach optional screenshot blobs when capture ships client-side.
 */
export async function POST(req: Request) {
  try {
    const jsonUnknown: unknown = await req.json().catch(() => null);
    const parsed = coercePayload(jsonUnknown);

    if (!parsed) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const receiptId = randomUUID();
    const trace = `[bug-report] receipt=${receiptId} route=${parsed.context.route ?? '?'} severity=${parsed.severity} category=${parsed.category}`;
    console.info(trace);

    return NextResponse.json({ ok: true, receiptId }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'report_failed' }, { status: 500 });
  }
}
