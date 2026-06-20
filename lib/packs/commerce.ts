import 'server-only';

import { PACKS_LIVE_COMMERCE_ENABLED } from '@/lib/packs/mode';
import { isPacksTreasuryConfigured } from '@/lib/packs/treasury';

/**
 * Real pack commerce is active only when the operator has BOTH flipped the
 * `PACKS_LIVE_COMMERCE_ENABLED` flag AND configured a treasury signer. Until
 * then, opens run on the simulated ledger (no charge, no on-chain delivery).
 */
export function liveCommerceActive(): boolean {
  return PACKS_LIVE_COMMERCE_ENABLED && isPacksTreasuryConfigured();
}
