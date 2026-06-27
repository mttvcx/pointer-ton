import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import { sumConfirmedTradeVolumeSolUtcToday } from '@/lib/db/trades';
import { listHeliusUsageSince, aggregateHeliusUsageStats } from '@/lib/db/heliusUsage';
import { PACKS_LIVE_COMMERCE_ENABLED } from '@/lib/packs/mode';
import type { Tables } from '@/lib/supabase/types';
import type {
  OpsCronRun,
  OpsEventLite,
  OpsHealthSnapshot,
  OpsHeliusHealth,
  OpsIndexerHealth,
  OpsIndexStatus,
  OpsProvider,
  OpsPulseHealth,
  OpsSectionError,
  OpsTradingHealth,
} from '@/lib/admin/opsTypes';

/**
 * Pointer Ops — live System Health collector.
 *
 * Reads ONLY real production signals (Postgres aggregates + env config) and
 * returns honest per-section results. Any section that throws is reported as
 * `{ ok: false, error }` rather than a faked-healthy value — the rest of the
 * snapshot still returns. Nothing here mutates state; it is read-only.
 *
 * NOTE on coverage: this is Phase 1. Several Mission Control signals (per-cron
 * last-run + duration, webhook delivery history, provider latency, deploy
 * markers, request traces) have no durable source in the codebase yet — they
 * require an `ops_events` / `ops_metrics` substrate that does not exist. Those
 * are intentionally ABSENT here rather than mocked; see the Ops roadmap.
 */

const ALL_INDEX_STATUSES: OpsIndexStatus[] = [
  'indexed',
  'failed',
  'pending',
  'indexing',
  'no_swaps',
];

function errOf(e: unknown): OpsSectionError {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

function cfg(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

async function collectTrading(): Promise<OpsTradingHealth | OpsSectionError> {
  try {
    const supabase = createAdminSupabase();
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const countFor = async (status: NonNullable<Tables<'trades'>['status']>): Promise<number> => {
      const { count, error } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('status', status)
        .gte('submitted_at', since);
      if (error) throw new Error(error.message);
      return count ?? 0;
    };
    const [confirmed, failed, pending, volumeSolToday] = await Promise.all([
      countFor('confirmed'),
      countFor('failed'),
      countFor('pending'),
      sumConfirmedTradeVolumeSolUtcToday(),
    ]);
    const denom = confirmed + failed;
    return {
      ok: true,
      windowHours: 24,
      confirmed,
      failed,
      pending,
      failRatePct: denom > 0 ? (failed / denom) * 100 : null,
      volumeSolToday,
    };
  } catch (e) {
    return errOf(e);
  }
}

async function collectIndexer(): Promise<OpsIndexerHealth | OpsSectionError> {
  try {
    const supabase = createAdminSupabase();
    const counts = await Promise.all(
      ALL_INDEX_STATUSES.map(async (status) => {
        const { count, error } = await supabase
          .from('mint_index_status')
          .select('*', { count: 'exact', head: true })
          .eq('status', status);
        if (error) throw new Error(error.message);
        return [status, count ?? 0] as const;
      }),
    );
    const byStatus = Object.fromEntries(counts) as Record<OpsIndexStatus, number>;
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

    const { data: failRows, error: failErr } = await supabase
      .from('mint_index_status')
      .select('mint, last_error, updated_at')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(5);
    if (failErr) throw new Error(failErr.message);

    return {
      ok: true,
      total,
      byStatus,
      recentFailures: (failRows ?? []).map((r) => ({
        mint: r.mint,
        lastError: r.last_error ?? null,
        updatedAt: r.updated_at,
      })),
    };
  } catch (e) {
    return errOf(e);
  }
}

async function collectPulse(): Promise<OpsPulseHealth | OpsSectionError> {
  try {
    const supabase = createAdminSupabase();
    const { data: latest, error: latestErr } = await supabase
      .from('tokens')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) throw new Error(latestErr.message);

    const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count, error: countErr } = await supabase
      .from('tokens')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', hourAgo);
    if (countErr) throw new Error(countErr.message);

    const latestTokenAt = latest?.created_at ?? null;
    const ageMinutes = latestTokenAt
      ? Math.max(0, Math.round((Date.now() - new Date(latestTokenAt).getTime()) / 60_000))
      : null;

    return { ok: true, latestTokenAt, ageMinutes, tokensLastHour: count ?? 0 };
  } catch (e) {
    return errOf(e);
  }
}

async function collectHelius(): Promise<OpsHeliusHealth | OpsSectionError> {
  try {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();
    const rows = await listHeliusUsageSince(sinceIso);
    const stats = aggregateHeliusUsageStats(rows) as unknown as Record<string, unknown>;
    return { ok: true, sinceIso, stats };
  } catch (e) {
    return errOf(e);
  }
}

async function collectCronRuns(): Promise<OpsCronRun[] | OpsSectionError> {
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from('ops_events')
      .select('name, status, ts, duration_ms')
      .eq('category', 'cron')
      .neq('status', 'started')
      .order('ts', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const latest = new Map<string, OpsCronRun>();
    for (const r of data ?? []) {
      if (latest.has(r.name)) continue;
      latest.set(r.name, {
        name: r.name,
        status: r.status,
        ts: r.ts,
        durationMs: r.duration_ms ?? null,
        ageMinutes: Math.max(0, Math.round((Date.now() - new Date(r.ts).getTime()) / 60_000)),
      });
    }
    return Array.from(latest.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    return errOf(e);
  }
}

async function collectRecentEvents(): Promise<OpsEventLite[] | OpsSectionError> {
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await supabase
      .from('ops_events')
      .select('ts, category, name, status, severity, message, duration_ms')
      .order('ts', { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      ts: r.ts,
      category: r.category,
      name: r.name,
      status: r.status,
      severity: r.severity,
      message: r.message ?? null,
      durationMs: r.duration_ms ?? null,
    }));
  } catch (e) {
    return errOf(e);
  }
}

function collectProviders(): OpsProvider[] {
  const p = (key: string, label: string, configured: boolean, critical: boolean): OpsProvider => ({
    key,
    label,
    configured,
    critical,
  });
  return [
    p('helius', 'Helius RPC / DAS', cfg('HELIUS_API_KEY') || cfg('NEXT_PUBLIC_HELIUS_API_KEY'), true),
    p(
      'supabase',
      'Supabase (Postgres)',
      cfg('SUPABASE_SERVICE_ROLE_KEY') && (cfg('SUPABASE_SERVICE_URL') || cfg('NEXT_PUBLIC_SUPABASE_URL')),
      true,
    ),
    p('privy', 'Privy (auth/wallets)', cfg('PRIVY_APP_SECRET') && cfg('NEXT_PUBLIC_PRIVY_APP_ID'), true),
    p('jupiter', 'Jupiter fee account', cfg('JUPITER_REFERRAL_ACCOUNT') || cfg('JUPITER_FEE_ACCOUNT'), true),
    p('redis', 'Upstash Redis', cfg('UPSTASH_REDIS_REST_URL') && cfg('UPSTASH_REDIS_REST_TOKEN'), false),
    p('moralis', 'Moralis (holder counts)', cfg('MORALIS_API_KEY'), false),
    p('packs', 'Packs treasury', cfg('PACKS_TREASURY_SECRET_KEY'), false),
    p('webhook', 'Helius webhook auth', cfg('HELIUS_WEBHOOK_AUTH_TOKEN'), false),
    p('cron', 'Cron secret', cfg('CRON_SECRET'), false),
    p('ai', 'AI (Anthropic/Gemini/OpenAI)', cfg('ANTHROPIC_API_KEY') || cfg('GOOGLE_GEMINI_API_KEY') || cfg('OPENAI_API_KEY'), false),
    p('sentry', 'Sentry (errors)', cfg('SENTRY_DSN') || cfg('NEXT_PUBLIC_SENTRY_DSN'), false),
    p('kalshi', 'Kalshi (predictions)', cfg('KALSHI_API_KEY_ID'), false),
    p('onramper', 'Onramper (fiat)', cfg('NEXT_PUBLIC_ONRAMPER_API_KEY'), false),
  ];
}

export async function collectOpsHealth(): Promise<OpsHealthSnapshot> {
  const [trading, indexer, pulse, helius, crons, recentEvents] = await Promise.all([
    collectTrading(),
    collectIndexer(),
    collectPulse(),
    collectHelius(),
    collectCronRuns(),
    collectRecentEvents(),
  ]);

  const packsTreasuryConfigured = cfg('PACKS_TREASURY_SECRET_KEY');
  return {
    generatedAt: new Date().toISOString(),
    trading,
    indexer,
    pulse,
    helius,
    flags: {
      pauseIngest: process.env.POINTER_PAUSE_INGEST === '1',
      packsLiveCommerce: PACKS_LIVE_COMMERCE_ENABLED && packsTreasuryConfigured,
      packsTreasuryConfigured,
    },
    providers: collectProviders(),
    crons,
    recentEvents,
  };
}
