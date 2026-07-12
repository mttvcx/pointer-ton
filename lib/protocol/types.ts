import type { AppChainId } from '@/lib/chains/appChain';
import type { MigrationDestination } from '@/lib/utils/constants';

/** Canonical snake_case protocol ids persisted on `tokens.protocol_id`. */
export type CanonicalProtocolId =
  | 'pump_fun'
  | 'pump_fun_mayhem'
  | 'bonk'
  | 'bags'
  | 'printr'
  | 'moonshot'
  | 'heaven'
  | 'dynamic_bc'
  | 'pumpswap'
  | 'raydium'
  | 'meteora'
  | 'pancakeswap'
  | 'uniswap'
  | 'uniswap_v2'
  | 'uniswap_v3'
  | 'uniswap_v4'
  | 'noxa'
  | 'eth'
  | 'bsc'
  | 'base'
  | 'robinhood'
  | 'ton';

export type TokenKind =
  | 'bonding_curve'
  | 'graduated'
  | 'amm_pool'
  | 'offchain'
  | 'native_jetton'
  | 'erc20'
  | 'spl'
  | 'unknown';

export type LaunchType =
  | 'fair_launch'
  | 'bonding_curve'
  | 'dex_pool'
  | 'creator_token'
  | 'offchain_launch'
  | 'migrated'
  | 'unknown';

export type MigrationState = 'pre_migration' | 'migrated' | 'post_migration' | 'unknown';

export type ClassificationSource =
  | 'helius_webhook_program'
  | 'helius_das_authority'
  | 'helius_das_search'
  | 'helius_das_hydrate'
  | 'helius_das_uri'
  | 'migration_program'
  | 'gecko_dex'
  | 'dexscreener_dex'
  | 'launch_pad_legacy'
  | 'tonapi_jetton'
  | 'metadata_structured'
  | 'backfill'
  | 'unknown';

export type TokenClassification = {
  protocol_id: CanonicalProtocolId | null;
  protocol_family: string | null;
  chain_id: AppChainId;
  token_kind: TokenKind;
  launch_type: LaunchType;
  migration_state: MigrationState;
  dex_id: string | null;
  classification_source: ClassificationSource;
  source_confidence: number;
};

export type ClassifierInput = {
  mint: string;
  launch_pad?: string | null;
  raw_metadata?: unknown;
  bonding_progress?: number | null;
  migrated_at?: string | null;
  migrated_to?: MigrationDestination | string | null;
  /** Solana on-chain program id from webhook. */
  solana_program_id?: string | null;
  /** Authority-mapped launch pad from DAS poll. */
  das_authority_pad?: string | null;
  /** Ingest path hint — drives default confidence tier. */
  ingest_hint?: ClassificationSource;
  /** Parsed Gecko Terminal network slug. */
  gecko_network?: 'eth' | 'bsc' | 'base' | null;
  /** Gecko pool row (includes dex relationship when present). */
  gecko_pool?: unknown;
  dexscreener_dex_id?: string | null;
  existing?: Partial<TokenClassification & { source_confidence?: number | null }> | null;
};

/** Minimum confidence for Pulse protocol filter matching. */
export const PROTOCOL_FILTER_MIN_CONFIDENCE = 0.5;
