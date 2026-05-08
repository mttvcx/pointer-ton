import type { LaunchpadId } from '@/lib/utils/constants';

/** Input for global Pulse "new token" notifications and alert-rule fan-out. */
export interface PulseNewTokenAlertInput {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  launchpad?: LaunchpadId | null;
  /** How the mint was discovered (Solana DAS / webhook or TON TonAPI paths). */
  source:
    | 'das_authority'
    | 'das_search'
    | 'das_hydrate'
    | 'helius_webhook'
    | 'tonapi_poll'
    | 'tonapi_hydrate';
  creator_wallet?: string | null;
  /** Helius / RPC signature when known (webhook path). */
  tx_signature?: string | null;
  /** Initial SOL in bonding curve when known (webhook / ingest). */
  initial_liquidity_sol?: number | null;
}
