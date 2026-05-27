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

function bugReportWebhookConfigured(): boolean {
  return Boolean(process.env.BUG_REPORT_WEBHOOK_URL?.trim());
}

async function deliverBugReport(
  receiptId: string,
  payload: BugReportPayload,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const webhookUrl = process.env.BUG_REPORT_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { ok: false, reason: 'webhook_not_configured' };
  }

  const categoryLabel =
    BUG_CATEGORY_OPTIONS.find((c) => c.id === payload.category)?.label ?? payload.category;
  const severityLabel =
    BUG_SEVERITY_OPTIONS.find((s) => s.id === payload.severity)?.label ?? payload.severity;

  const ctx = payload.context;
  const mintHint = ctx.tokenMintHints?.[0] ?? ctx.pulseHighlightMint ?? null;
  const lines = [
    `**Pointer bug report** · \`${receiptId.slice(0, 8)}\``,
    `**Severity:** ${severityLabel}`,
    `**Category:** ${categoryLabel}`,
    `**Route:** ${ctx.route}`,
    `**Chain:** ${ctx.activeChain}`,
    mintHint ? `**Mint:** ${mintHint}` : null,
    ctx.activeWalletMasked ? `**Wallet:** ${ctx.activeWalletMasked}` : null,
    '',
    payload.description.trim().slice(0, 3500),
  ].filter(Boolean);

  const body = {
    content: lines.join('\n').slice(0, 1900),
    embeds: [
      {
        title: 'Diagnostics context',
        description: '```json\n' + JSON.stringify(ctx, null, 2).slice(0, 3500) + '\n```',
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, reason: `webhook_${res.status}:${text.slice(0, 120)}` };
  }

  return { ok: true };
}

/**
 * Diagnostics intake endpoint.
 * Set `BUG_REPORT_WEBHOOK_URL` (Discord/Slack incoming webhook) so beta reports reach you.
 */
export async function POST(req: Request) {
  try {
    if (!bugReportWebhookConfigured()) {
      return NextResponse.json({ error: 'reporting_disabled' }, { status: 503 });
    }

    const jsonUnknown: unknown = await req.json().catch(() => null);
    const parsed = coercePayload(jsonUnknown);

    if (!parsed) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const receiptId = randomUUID();
    const trace = `[bug-report] receipt=${receiptId} route=${parsed.context.route ?? '?'} severity=${parsed.severity} category=${parsed.category}`;
    console.info(trace);

    const delivered = await deliverBugReport(receiptId, parsed);
    if (!delivered.ok) {
      console.error('[bug-report] delivery failed:', delivered.reason, trace);
      return NextResponse.json({ error: 'delivery_failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, receiptId }, { status: 200 });
  } catch (err) {
    console.error('[bug-report] unexpected failure:', err);
    return NextResponse.json({ error: 'report_failed' }, { status: 500 });
  }
}
