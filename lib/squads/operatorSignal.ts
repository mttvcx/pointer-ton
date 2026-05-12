import type { EthosProfileSnapshot } from '@/lib/ethos/types';
import { normalizeEthosScore } from '@/lib/ethos/score';
import type { OperatorSignalLevel, PointerIdentity, RiskFlag } from '@/lib/squads/types';

export type PointerActivityTier = 'light' | 'active' | 'heavy';

export type PointerActivitySnapshot = {
  tier: PointerActivityTier;
  daysActive: number;
  tradeCount: number;
  volumeUsdApprox?: number | null;
};

export const ZERO_POINTER_ACTIVITY: PointerActivitySnapshot = {
  tier: 'light',
  daysActive: 0,
  tradeCount: 0,
  volumeUsdApprox: null,
};

export type OperatorSignal = {
  level: OperatorSignalLevel;
  /** One-line, non-absolute copy for drawers and cards. */
  summary: string;
  /** Explainable inputs — never claim precision. */
  factors: ReadonlyArray<{ label: string; detail: string }>;
};

type ComputeInput = {
  identity: PointerIdentity;
  ethos: EthosProfileSnapshot | null;
  pointerActivity: PointerActivitySnapshot;
  walletSafety: { riskFlags: RiskFlag[] };
  squadStanding: {
    squadCount: number;
    mutuals: number;
    ownerOrAdminCount: number;
  };
};

/**
 * Pointer-native composite. Ethos is one factor, not ground truth.
 */
export function computeOperatorSignal(input: ComputeInput): OperatorSignal {
  const { ethos, pointerActivity, walletSafety, squadStanding } = input;
  const risk = walletSafety.riskFlags.length;

  let score01 = 0;
  let parts = 0;

  if (ethos) {
    score01 += normalizeEthosScore(ethos.score) * 0.42;
    parts += 0.42;
  }

  const act =
    pointerActivity.tier === 'heavy'
      ? 0.95
      : pointerActivity.tier === 'active'
        ? 0.65
        : pointerActivity.tradeCount > 0
          ? 0.35
          : 0.12;
  score01 += act * 0.28;
  parts += 0.28;

  const idComplete =
    [input.identity.xUsername, input.identity.telegramId, input.identity.discordId].filter(Boolean)
      .length >= 1
      ? 0.85
      : input.identity.ethereumAddress
        ? 0.5
        : 0.15;
  score01 += idComplete * 0.12;
  parts += 0.12;

  const squad01 = Math.min(1, squadStanding.squadCount * 0.18 + squadStanding.ownerOrAdminCount * 0.08);
  score01 += squad01 * 0.1;
  parts += 0.1;

  score01 -= Math.min(0.35, risk * 0.09);
  score01 = Math.max(0, Math.min(1, score01 / Math.max(0.25, parts)));

  const level: OperatorSignalLevel =
    risk >= 3
      ? 'low'
      : score01 >= 0.72
        ? 'high'
        : score01 >= 0.42
          ? 'medium'
          : ethos == null && pointerActivity.tradeCount === 0 && risk === 0
            ? 'unknown'
            : 'low';

  const factors: { label: string; detail: string }[] = [];
  if (ethos) {
    factors.push({
      label: 'Ethos (external)',
      detail: `Score ${Math.round(ethos.score)} — credibility signal, not proof.`,
    });
  } else {
    factors.push({
      label: 'Ethos (external)',
      detail: 'Not linked or hidden — no external credibility layer applied.',
    });
  }

  factors.push({
    label: 'Pointer activity',
    detail:
      pointerActivity.tier === 'heavy'
        ? 'Heavy on-platform activity.'
        : pointerActivity.tier === 'active'
          ? 'Active trading footprint on Pointer.'
          : pointerActivity.tradeCount > 0
            ? 'Early Pointer activity.'
            : 'Limited or no on-chain activity recorded in Pointer yet.',
  });

  factors.push({
    label: 'Wallet safety',
    detail:
      risk === 0
        ? 'No elevated risk flags from Pointer heuristics.'
        : `${risk} risk signal(s) — review before trusting execution.`,
  });

  factors.push({
    label: 'Squad graph',
    detail:
      squadStanding.squadCount > 0
        ? `In ${squadStanding.squadCount} squad(s); ${squadStanding.mutuals} mutual operator(s) rough-signal.`
        : 'No squad tenure on Pointer yet.',
  });

  const summary =
    level === 'high'
      ? 'Strong multi-signal operator — still verify execution risk yourself.'
      : level === 'medium'
        ? 'Mixed signals — usable for discovery, not automatic trust.'
        : level === 'low'
          ? 'Weak or risky signal — treat as unproven.'
          : 'Insufficient public signal — identity or activity not established.';

  return { level, summary, factors };
}
