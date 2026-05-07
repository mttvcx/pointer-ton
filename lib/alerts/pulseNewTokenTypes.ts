import type { LaunchpadId } from '@/lib/utils/constants';

/** Input for global Pulse "new token" notifications and alert-rule fan-out. */
export interface PulseNewTokenAlertInput {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  launchpad?: LaunchpadId | null;
  /** How the mint was discovered: das_authority | das_search | das_hydrate | helius_webhook */
  source: 'das_authority' | 'das_search' | 'das_hydrate' | 'helius_webhook';
  creator_wallet?: string | null;
  /** Helius / RPC signature when known (webhook path). */
  tx_signature?: string | null;
  /** Initial SOL in bonding curve when known (webhook / ingest). */
  initial_liquidity_sol?: number | null;
}
