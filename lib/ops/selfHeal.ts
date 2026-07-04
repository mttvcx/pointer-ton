import 'server-only';

import { collectOpsHealth } from '@/lib/db/opsHealth';
import { HEAL_ACTIONS, planSelfHeal, type HealDecision } from '@/lib/ops/selfHealDecisions';
import { recordOpsEvent } from '@/lib/ops/events';
import { replayDeadLetters } from '@/lib/webhooks/queue';
import { WEBHOOK_PROVIDERS } from '@/lib/webhooks/registry';
import { runRetryFailedIndexes } from '@/lib/ingest/livePipeline';
import { revalidatePulseFeedCache } from '@/lib/server/revalidatePulseFeed';

/**
 * Self-healing executor. Default is OBSERVE-ONLY: it computes a plan from Pointer
 * Doctor's scored findings and recommends; it executes a SAFE action only when
 * `SELFHEAL_ENABLED=1` AND Doctor confidence clears the threshold. Dangerous
 * actions never auto-run — they escalate. Every execution is an ops event.
 */

export const selfHealEnabled = (): boolean => process.env.SELFHEAL_ENABLED === '1';

/** Real repair functions for SAFE actions only. */
const EXECUTORS: Record<string, () => Promise<string>> = {
  'drain-webhook-dlq': async () => {
    const now = Date.now();
    let moved = 0;
    for (const p of WEBHOOK_PROVIDERS) moved += await replayDeadLetters(p, now);
    return `replayed ${moved} dead-lettered webhook job(s)`;
  },
  'retry-failed-indexes': async () => {
    const r = await runRetryFailedIndexes();
    return `retry-failed-indexes ${JSON.stringify(r).slice(0, 140)}`;
  },
  'rebuild-pulse-cache': async () => {
    revalidatePulseFeedCache();
    return 'pulse feed cache revalidated';
  },
};

export type PlanRow = { actionId: string; label: string; mode: HealDecision['mode']; reason: string; danger: string };
export type SelfHealResult = {
  enabled: boolean;
  plan: PlanRow[];
  executed: { actionId: string; result?: string; error?: string }[];
};

const toRow = (d: HealDecision): PlanRow => ({
  actionId: d.action.id,
  label: d.action.label,
  mode: d.mode,
  reason: d.reason,
  danger: d.action.danger,
});

/** Compute the plan from current health — OBSERVE only, executes nothing. */
export async function getSelfHealPlan(): Promise<SelfHealResult> {
  const enabled = selfHealEnabled();
  try {
    const snap = await collectOpsHealth();
    return { enabled, plan: planSelfHeal(snap.doctor.findings, enabled).map(toRow), executed: [] };
  } catch {
    return { enabled, plan: [], executed: [] };
  }
}

/** Execute ONE safe action by id (the human-approved path, or the auto cycle).
 *  Refuses dangerous actions outright. Audit-logged as an ops event. */
export async function executeHealAction(
  actionId: string,
  actor: string,
): Promise<{ ok: boolean; result?: string; error?: string }> {
  const spec = HEAL_ACTIONS.find((a) => a.id === actionId);
  if (!spec) return { ok: false, error: 'unknown_action' };
  if (spec.danger === 'dangerous') return { ok: false, error: 'dangerous_action_requires_manual_action' };
  const exec = EXECUTORS[actionId];
  if (!exec) return { ok: false, error: 'no_executor' };
  try {
    const result = await exec();
    await recordOpsEvent({ category: 'heal', name: actionId, status: 'ok', message: result, detail: { actor } });
    return { ok: true, result };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'heal_failed';
    await recordOpsEvent({ category: 'heal', name: actionId, status: 'error', severity: 'error', message: error, detail: { actor } });
    return { ok: false, error };
  }
}

/** Autonomous cycle (cron). Executes the plan's `execute` actions (only when
 *  enabled + confident), escalates dangerous ones as warn events. */
export async function runSelfHealCycle(): Promise<SelfHealResult> {
  const enabled = selfHealEnabled();
  let decisions: HealDecision[] = [];
  try {
    const snap = await collectOpsHealth();
    decisions = planSelfHeal(snap.doctor.findings, enabled);
  } catch {
    return { enabled, plan: [], executed: [] };
  }
  const executed: SelfHealResult['executed'] = [];
  for (const d of decisions) {
    if (d.mode === 'execute') {
      const r = await executeHealAction(d.action.id, 'selfheal:auto');
      executed.push({ actionId: d.action.id, result: r.result, error: r.error });
    } else if (d.mode === 'escalate') {
      await recordOpsEvent({
        category: 'heal',
        name: `escalate:${d.action.id}`,
        status: 'warn',
        severity: 'warn',
        message: `Self-heal escalation: ${d.action.label} — ${d.reason}`,
      });
    }
  }
  return { enabled, plan: decisions.map(toRow), executed };
}
