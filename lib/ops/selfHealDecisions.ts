/**
 * Self-healing — pure decision logic (no I/O, unit-testable). Maps a Doctor
 * finding to candidate repair actions and decides, per action, whether to
 * EXECUTE, RECOMMEND (observe-only), ESCALATE, or SKIP. The executor
 * (`lib/ops/selfHeal.ts`) runs only the actions this says to execute.
 *
 * Safety contract (non-negotiable):
 *  - `dangerous` actions (anything touching funds, keys, schema, deploy rollback,
 *    mass writes) ALWAYS escalate — never auto-executed, even with the flag on.
 *  - `safe` actions execute only when (a) self-heal is enabled AND (b) Doctor
 *    confidence ≥ the action's threshold; otherwise they are recommended.
 *  - Default (flag off) is observe-only: recommend everything, execute nothing.
 */

export type HealDanger = 'safe' | 'dangerous';
export type HealMode = 'execute' | 'recommend' | 'escalate' | 'skip';

export interface HealActionSpec {
  id: string;
  label: string;
  danger: HealDanger;
  /** Minimum Doctor confidence required to auto-execute a safe action. */
  minConfidence: number;
  /** Does this action remediate the given finding id? */
  match: RegExp;
}

export const HEAL_ACTIONS: readonly HealActionSpec[] = [
  { id: 'drain-webhook-dlq', label: 'Replay webhook dead-letter queue', danger: 'safe', minConfidence: 0.6, match: /dlq|dead.?letter|webhook/i },
  { id: 'retry-failed-indexes', label: 'Retry failed mint indexes', danger: 'safe', minConfidence: 0.6, match: /indexer|index|backlog/i },
  { id: 'rebuild-pulse-cache', label: 'Rebuild stale Pulse cache', danger: 'safe', minConfidence: 0.6, match: /pulse|stale|cache/i },
  // Cutting a provider affects the live data path → treat as dangerous: recommend
  // + escalate to a human, never auto-execute.
  { id: 'cutoff-provider', label: 'Cut off an unhealthy provider', danger: 'dangerous', minConfidence: 0.9, match: /provider|helius|moralis|insightx|dexscreener|jupiter/i },
] as const;

export function matchActions(findingId: string): HealActionSpec[] {
  return HEAL_ACTIONS.filter((a) => a.match.test(findingId));
}

export type HealDecision = { action: HealActionSpec; mode: HealMode; reason: string };

export function decideSelfHeal(input: {
  findingId: string;
  confidence: number;
  enabled: boolean;
}): HealDecision[] {
  return matchActions(input.findingId).map((action) => {
    if (action.danger === 'dangerous') {
      return { action, mode: 'escalate', reason: 'High-blast-radius action — requires explicit human approval.' };
    }
    if (!input.enabled) {
      return { action, mode: 'recommend', reason: 'Self-heal is observe-only (SELFHEAL_ENABLED unset).' };
    }
    if (input.confidence < action.minConfidence) {
      return {
        action,
        mode: 'recommend',
        reason: `Confidence ${(input.confidence * 100).toFixed(0)}% < required ${(action.minConfidence * 100).toFixed(0)}%.`,
      };
    }
    return { action, mode: 'execute', reason: `Safe action, confidence ${(input.confidence * 100).toFixed(0)}% ≥ threshold.` };
  });
}

/** Roll decisions across many findings into a de-duped plan (one row per action,
 *  highest mode wins: execute > escalate > recommend). */
export function planSelfHeal(
  findings: { id: string; score?: { confidence: number } }[],
  enabled: boolean,
): HealDecision[] {
  const order: Record<HealMode, number> = { execute: 3, escalate: 2, recommend: 1, skip: 0 };
  const best = new Map<string, HealDecision>();
  for (const f of findings) {
    for (const d of decideSelfHeal({ findingId: f.id, confidence: f.score?.confidence ?? 0.5, enabled })) {
      const prev = best.get(d.action.id);
      if (!prev || order[d.mode] > order[prev.mode]) best.set(d.action.id, d);
    }
  }
  return [...best.values()];
}
