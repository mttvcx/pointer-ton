/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only';

import type { SibylAnswer } from '@/sibyl/types';
import type { AgentContext } from '@/sibyl/agents/types';
import * as db from '@/sibyl/memory/db';

const nowIso = () => new Date().toISOString();

type TokenSnap = { mcUsd: number | null; priceUsd: number | null; liquidityUsd: number | null; symbol: string | null };

function tokenSnap(answer: SibylAnswer): TokenSnap | null {
  const t = answer.cards.find((c) => c.type === 'token') as any;
  if (!t) return null;
  const d = t.data;
  return { mcUsd: d.marketCapUsd ?? null, priceUsd: d.priceUsd ?? null, liquidityUsd: d.liquidityUsd ?? null, symbol: d.symbol ?? null };
}

function subjectId(ctx: AgentContext): string | null {
  if (ctx.mint) return `token:${ctx.mint}`;
  if (ctx.handle) return `person:${ctx.handle.toLowerCase()}`;
  if (ctx.narrative) return `narrative:${ctx.narrative.toLowerCase()}`;
  return null;
}

/** Entities to remember from an answer + its subject. */
function entitiesFrom(answer: SibylAnswer, ctx: AgentContext): unknown[] {
  const out: any[] = [];
  const snap = tokenSnap(answer);
  if (ctx.mint) out.push({ id: `token:${ctx.mint}`, kind: 'token', name: snap?.symbol ?? ctx.mint, linkedWallets: [], linkedSocials: [] });
  if (ctx.handle) out.push({ id: `person:${ctx.handle.toLowerCase()}`, kind: 'person', name: ctx.handle, linkedSocials: [ctx.handle.toLowerCase()] });
  if (ctx.narrative) out.push({ id: `narrative:${ctx.narrative.toLowerCase()}`, kind: 'narrative', name: ctx.narrative });
  for (const e of answer.entities) {
    const id = e.handle ? `person:${e.handle.toLowerCase()}` : e.address ? `wallet:${e.address}` : `${e.kind}:${e.id}`;
    out.push({
      id,
      kind: e.kind === 'person' || e.kind === 'wallet' || e.kind === 'token' || e.kind === 'narrative' ? e.kind : 'person',
      name: e.label || e.handle || e.id,
      linkedWallets: e.address ? [e.address] : [],
      linkedSocials: e.handle ? [e.handle.toLowerCase()] : [],
      relatedEntities: ctx.mint ? [`token:${ctx.mint}`] : [],
    });
  }
  return out;
}

export type Recall = { seenCount: number; firstSeen: string | null } | null;

/** Fast PK read of the subject's PRIOR memory (before this scan writes). Fail-open. */
export async function recallSubject(ctx: AgentContext): Promise<Recall> {
  const id = subjectId(ctx);
  if (!id) return null;
  const row = await db.getEntityRow(id);
  if (!row) return null;
  return { seenCount: row.seen_count, firstSeen: row.first_seen };
}

/** Compute a graded outcome from a prediction snapshot + a fresh market snapshot. */
export function gradeOutcome(prediction: any, freshMc: number | null, freshPrice: number | null, freshLiq: number | null, predictedAtIso: string) {
  const predMc = Number(prediction?.mcUsd) || 0;
  const predLiq = Number(prediction?.liquidityUsd) || 0;
  const multiple = predMc > 0 && freshMc != null ? Number((freshMc / predMc).toFixed(3)) : null;
  const rugged = (freshLiq != null && predLiq > 0 && freshLiq < predLiq * 0.15) || (predMc > 0 && freshMc != null && freshMc < predMc * 0.12);
  const horizonH = Number(((Date.now() - new Date(predictedAtIso).getTime()) / 3_600_000).toFixed(1));
  return { mcUsd: freshMc, priceUsd: freshPrice, liquidityUsd: freshLiq, multiple, rugged, horizonH };
}

/**
 * Write-through: persist the scan, upsert entities, and run the token outcome loop —
 * resolve any prior prediction that's had ≥1h to play out, then open a new one. All
 * fail-open; never throws.
 */
export async function recordScan(answer: SibylAnswer, ctx: AgentContext, meta?: { latencyMs?: number; userId?: string | null }): Promise<void> {
  try {
    const iso = nowIso();
    const snap = tokenSnap(answer);
    const scanId = await db.insertScan({
      query: ctx.query,
      subject_kind: ctx.mint ? 'token' : ctx.handle ? 'person' : ctx.narrative ? 'narrative' : 'unknown',
      subject_ref: ctx.mint ?? ctx.handle ?? ctx.narrative ?? null,
      chain: ctx.chain ?? null,
      mode: answer.mode,
      verdict: answer.verdict,
      confidence: Math.round(answer.confidence),
      action: answer.action,
      why: answer.why,
      agents_run: answer.agentsRun,
      sources: answer.sources,
      caveats: answer.caveats ?? [],
      entities: answer.entities,
      cards: answer.cards,
      latency_ms: meta?.latencyMs ?? null,
      user_id: meta?.userId ?? null,
    });

    await db.recordEntities(entitiesFrom(answer, ctx), iso);

    // Token outcome loop — the prediction→outcome dataset.
    if (ctx.mint && snap && snap.mcUsd != null) {
      const pending = await db.pendingOutcomesForMint(ctx.mint);
      let hasRecentPending = false;
      for (const p of pending) {
        const horizonH = (Date.now() - new Date(p.predicted_at).getTime()) / 3_600_000;
        if (horizonH < 1) {
          hasRecentPending = true; // too soon to grade — keep it open
          continue;
        }
        await db.resolveOutcome(p.id, gradeOutcome(p.prediction, snap.mcUsd, snap.priceUsd, snap.liquidityUsd, p.predicted_at), iso);
      }
      if (!hasRecentPending) {
        const risk = answer.cards.find((c) => c.type === 'risk') as any;
        await db.insertPendingOutcome({
          scan_id: scanId,
          subject_kind: 'token',
          subject_ref: ctx.mint,
          chain: ctx.chain ?? null,
          prediction: { verdict: answer.verdict, confidence: Math.round(answer.confidence), riskScore: risk?.data?.score ?? null, mcUsd: snap.mcUsd, priceUsd: snap.priceUsd, liquidityUsd: snap.liquidityUsd },
        });
      }
    }
  } catch {
    /* memory must never break a scan */
  }
}
