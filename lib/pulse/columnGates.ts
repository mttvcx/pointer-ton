import type { AppChainId } from '@/lib/chains/appChain';
import { tokenMatchesAppChain } from '@/lib/chains/evmTokenChain';
import { getPulseBondingRingState, PULSE_NEAR_MIGRATE_PCT } from '@/lib/tokens/bondingProgress';
import { PULSE_THRESHOLDS, type PulseColumnId } from '@/lib/utils/constants';
import type { Tables } from '@/lib/supabase/types';
import type { PulseTokenBundle } from '@/types/tokens';

type TokenRow = Tables<'tokens'>;

/** Row-level migration signals (no snapshot enrichment). */
export function tokenIsPulseMigrated(token: TokenRow): boolean {
  if (token.migrated_at != null) return true;
  if (token.bonding_progress != null && token.bonding_progress >= 100) return true;
  const raw = token.raw_metadata;
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    if ((raw as Record<string, unknown>).pumpComplete === true) return true;
  }
  return false;
}

function tokenCreatedMs(token: TokenRow): number | null {
  const ms = new Date(token.created_at).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** NEW column: recent launches still on the bonding curve (not graduated). */
export function tokenMatchesPulseNewRow(token: TokenRow): boolean {
  if (tokenIsPulseMigrated(token)) return false;
  const createdMs = tokenCreatedMs(token);
  if (createdMs == null) return false;
  return Date.now() - createdMs <= PULSE_THRESHOLDS.newMaxAgeMinutes * 60_000;
}

/** Client-side column gate — mirrors server listPulseFeedTokens heuristics (best-effort). */
export function tokenMatchesPulseColumn(
  token: TokenRow,
  column: PulseColumnId,
  chain: AppChainId,
): boolean {
  if (!tokenMatchesAppChain(token, chain)) return false;

  if (column === 'new') {
    return tokenMatchesPulseNewRow(token);
  }

  if (column === 'migrated') {
    return token.migrated_at != null;
  }

  if (tokenIsPulseMigrated(token)) return false;
  const createdMs = tokenCreatedMs(token);
  if (createdMs == null) return false;
  if (Date.now() - createdMs > PULSE_THRESHOLDS.stretchMaxAgeHours * 3_600_000) return false;
  const bp = token.bonding_progress;
  return bp != null && Number.isFinite(bp) && bp >= PULSE_NEAR_MIGRATE_PCT;
}

/** Bundle gate — includes Dex / pump enrichment not yet persisted on `tokens`. */
export function bundleMatchesPulseColumn(
  bundle: PulseTokenBundle,
  column: PulseColumnId,
  chain: AppChainId,
): boolean {
  if (!tokenMatchesPulseColumn(bundle.token, column, chain)) return false;
  if (column === 'new' && getPulseBondingRingState(bundle).migrated) return false;
  return true;
}
