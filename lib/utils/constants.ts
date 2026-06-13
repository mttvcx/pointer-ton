/**
 * Centralized constants. Anything that might rotate (model IDs, fee nanotons,
 * cache TTLs, fee defaults) lives here so feature code never inlines a magic
 * number that's painful to find later.
 */

/* --------------------------------- chain ---------------------------------- */

export const CHAIN = 'ton' as const;

export const SOL_DECIMALS = 9;
export const USDC_DECIMALS = 6;

/* ---------------------------------- fees ---------------------------------- */

/** Phase 1 single-tier fee in basis points. {@link getFeeBpsForUser} is the
 * source of truth at runtime; this is only the default when no user context
 * exists (e.g. unauthenticated quote previews). */
export const DEFAULT_PLATFORM_FEE_BPS = 100;

/** Default Jito tip applied when no per-trade override is supplied. */
export const DEFAULT_JITO_TIP_LAMPORTS = 100_000;

/** Compute unit limit window. Jupiter swaps usually settle in 200K-600K CU;
 * we leave headroom for ATA creation + tip ix. */
export const COMPUTE_UNIT_LIMIT_MIN = 600_000;
export const COMPUTE_UNIT_LIMIT_MAX = 1_400_000;

/** Default slippage shown in the buy/sell panel. */
export const DEFAULT_SLIPPAGE_BPS = 500; // 5%

/** Quick-buy preset chips (native TON notionals) — default; trading presets override per user. */
export const BUY_PRESETS_SOL = [0.1, 0.5, 1, 5] as const;

/** Default instant-trade / Pulse quick-buy presets when spending USDC (Solana). */
export const BUY_PRESETS_USDC = [25, 50, 100, 800] as const;

/** Wrapped HYPE (Jupiter-listed; legacy mint id). */
export const HYPE_MINT = '98sMhvDwXj1RQi5c5Mndm3vPe9cBqPrbLaufMXFNMh5g';

/** Confirmation polling. */
export const SUBMIT_TIMEOUT_MS = 60_000;
export const SIGNATURE_POLL_INTERVAL_MS = 1_500;

/* ---------------------------------- AI ----------------------------------- */

/** Phase 1 daily quota in USD per user. {@link getAIQuotaForUser} is the
 * source of truth. */
export const DEFAULT_AI_DAILY_QUOTA_USD = 0.3;

/** Sliding-window rate limit per user. */
export const AI_RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
export const AI_RATE_LIMIT_MAX_CALLS = 50;

/** Legacy per-pipeline TTL (Redis `ai:{pipeline}:{hash}` backfill). */
export const AI_CACHE_TTL = {
  explainToken: 90,
  explainWallet: 600,
  tooltip: 86_400,
  narrateAlert: 86_400,
  parseTrackerRule: 1800,
  launchPackage: 7 * 86_400,
} as const;

/** Shared global scan cache TTLs (seconds). See `lib/ai/scanCacheKeys.ts`. */
export const AI_SCAN_CACHE_TTL = {
  token_scan: 600, // 10 min
  copilot: 900, // 15 min
  wallet_intel: 3600, // 1 h
  tooltip: 86_400, // 24 h
  narrative: 1800, // 30 min
  twitter_scan: 6 * 3600, // 6 h
  tracker_parse: 1800,
  launch_package: 7 * 86_400, // 7 d — tweet content is immutable
} as const;

/** MC drift invalidation thresholds (fraction). */
export const AI_SCAN_MC_INVALIDATION = {
  token_scan: 0.2,
  copilot: 0.25,
  narrative: 0.2,
} as const;

/** Admin cost estimate: avg output tokens per saved scan × Sonnet input pricing. */
export const AI_SCAN_AVG_SAVED_OUTPUT_TOKENS = 450;

/** Anthropic / Gemini / OpenAI model IDs. Centralized so a model rotation
 * is one line. Override via env if a newer ID ships mid-development. */
export const MODELS = {
  geminiFlash: process.env.GEMINI_FLASH_MODEL ?? 'gemini-2.5-flash',
  haiku: process.env.ANTHROPIC_HAIKU_MODEL ?? 'claude-haiku-4-5',
  sonnet: process.env.ANTHROPIC_SONNET_MODEL ?? 'claude-sonnet-4-6',
  embedding: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
} as const;

/** Best-effort per-1M-token pricing in USD. Used by `lib/ai/cost.ts` to
 * estimate spend for cascade calls. Update when providers change pricing. */
export const MODEL_PRICING_USD_PER_MTOK = {
  geminiFlash: { input: 0.075, output: 0.3 },
  haiku: { input: 1, output: 5 },
  sonnet: { input: 3, output: 15 },
  embedding: { input: 0.02, output: 0 },
} as const;

/* ------------------------------- pulse feed ------------------------------- */

export const PULSE_COLUMNS = ['new', 'stretch', 'migrated'] as const;
export type PulseColumnId = (typeof PULSE_COLUMNS)[number];

/** Static header accent dot (40% opacity); matches Pulse column identity. */
export const PULSE_COLUMN_ACCENT_DOT: Record<PulseColumnId, string> = {
  new: 'bg-signal-bull/40',
  stretch: 'bg-signal-warn/40',
  migrated: 'bg-amber-400/50',
};

/** Heuristics defining each Pulse column. */
export const PULSE_THRESHOLDS = {
  /** Wider than the original 30m — so a Pulse without cron activity still
   *  shows fresh tokens. The original narrow window assumed continuous
   *  production ingestion; founder beta runs without cron. */
  newMaxAgeMinutes: 240,
  /** Stretch column: tokens younger than this with bonding curve ≥ {@link PULSE_NEAR_MIGRATE_PCT}. */
  stretchMaxAgeHours: 48,
  stretchMinHolders: 50,
  stretchMinLiquidityUsd: 2_000,
  migratedFromPad: ['pump.fun'] as const,
} as const;

/**
 * Helius `searchAssets` rejects `tokenType` without `ownerAddress`. When
 * `PULSE_DAS_POLL_OWNER_WALLET` is unset, polling uses this bootstrap wallet
 * (from Helius docs) so first-run Pulse is non-empty. Override the env var for
 * production discovery (e.g. a high-activity wallet or your indexer).
 */
export const PULSE_DAS_FALLBACK_POLL_OWNER =
  '86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY';

/* --------------------------- launchpad program IDs ------------------------ */

/** Program IDs for the launchpads we parse in `lib/helius/parsers.ts`.
 * Pulled from public docs; verify before going to mainnet for fees. */
export const LAUNCHPAD_PROGRAM_IDS = {
  pumpFun: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  bags: 'BSfTAhiifGCG9wftxQp7DjPkBkwjFxNsoEjr3iJYhyR8',
  printr: 'Pr1NTtR67xZJaR5JG7nT4CMhGwDFqpzN5JhtXXn8nEM',
  moonshot: 'MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG',
  /** Raydium LaunchLab / LetsBonk. */
  bonk: 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj',
  heaven: 'HEAVENoP2qxoeuF8Dj2oT1GHEnu49U5mJYkdeC8BAX2o',
  /** Meteora DBC — Believe and other partners launch here. */
  believeDbc: 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN',
} as const;

/** Post-bonding-curve AMM programs (migration destinations). */
export const MIGRATION_PROGRAM_IDS = {
  pumpSwap: 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
  raydiumAmmV4: '675kPX9MHTjS2zt1qfrNYNYeZyzaE6XsPsK6uxR9z',
  raydiumClmm: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqGJ',
  meteoraDammV2: 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG',
  meteoraDlmm: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
} as const;

export type MigrationDestination = 'pumpswap' | 'raydium' | 'meteora';

export const MIGRATION_PROGRAM_TO_DEST: Record<string, MigrationDestination> = {
  [MIGRATION_PROGRAM_IDS.pumpSwap]: 'pumpswap',
  [MIGRATION_PROGRAM_IDS.raydiumAmmV4]: 'raydium',
  [MIGRATION_PROGRAM_IDS.raydiumClmm]: 'raydium',
  [MIGRATION_PROGRAM_IDS.meteoraDammV2]: 'meteora',
  [MIGRATION_PROGRAM_IDS.meteoraDlmm]: 'meteora',
};

export const LAUNCHPAD_LABELS = {
  'pump.fun': 'pump.fun',
  bonk: 'Bonk',
  bags: 'Bags',
  printr: 'Printr',
  moonshot: 'Moonshot',
  heaven: 'Heaven',
  'dynamic-bc': 'Dynamic BC',
  /** Ethereum mainnet new-pool discovery (Gecko Terminal ingest). */
  eth: 'Ethereum',
  /** BNB Chain meme / new-pool discovery (Gecko Terminal ingest). */
  bsc: 'BNB Chain',
  /** Base chain meme / new-pool discovery (Gecko Terminal ingest). */
  base: 'Base',
  unknown: 'Unknown',
} as const;
export type LaunchpadId = keyof typeof LAUNCHPAD_LABELS;

/**
 * Mint / metadata authority addresses for each launchpad. Used by the Pulse
 * DAS poller via `getAssetsByAuthority(...sortBy: created desc)` to surface
 * freshly minted tokens directly. Program IDs above can't be used as
 * authorities - DAS would return zero results.
 *
 * Map keys are `LaunchpadId` values so the poller can re-attribute the
 * `launch_pad` column even when the parser's URI heuristic misses.
 */
export const LAUNCHPAD_AUTHORITIES: Record<LaunchpadId, string | null> = {
  'pump.fun': 'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM',
  /** Raydium LaunchLab program auth PDA (`["auth"]`). */
  bonk: '7eHQzMaFT5jt8cVaPQ5jvGV2hLnaPyfod4B8gM3f4VZQ',
  /** Moonit program auth PDA (`["auth"]`). */
  moonshot: '5uMUuq7TqUFNGSGaveeEtEXfV24uJfmpLq3QZzyNFyx8',
  /** Bags program auth PDA (`["auth"]`). */
  bags: 'BuBXGz7rkTfp9CoSAR6kJudwLZ1saE2WsQPxGcrJ5tfu',
  printr: null,
  heaven: null,
  'dynamic-bc': null,
  eth: null,
  bsc: null,
  base: null,
  unknown: null,
};

/* ---------------------------------- urls ---------------------------------- */

export const HELIUS_SENDER_URL =
  process.env.HELIUS_SENDER_URL ?? 'https://sender.helius-rpc.com/fast';

/** Jupiter swap API v1 (quote-api.jup.ag/v6 DNS is dead — use lite or api.jup.ag). */
export const JUPITER_QUOTE_URL =
  process.env.JUPITER_QUOTE_URL ?? 'https://lite-api.jup.ag/swap/v1/quote';
export const JUPITER_SWAP_URL =
  process.env.JUPITER_SWAP_URL ?? 'https://lite-api.jup.ag/swap/v1/swap';

/** Legacy Solana JSON-RPC (Helius) for Pulse / webhooks / ingest only — not the primary TON RPC. */
export function getHeliusRpcUrl(): string {
  const key = process.env.HELIUS_API_KEY?.trim();
  if (key) {
    return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  }
  const override = process.env.SOLANA_RPC_URL?.trim();
  if (override) return override;
  throw new Error(
    'HELIUS_API_KEY missing — required for Solana RPC (https://mainnet.helius-rpc.com). Set HELIUS_API_KEY in .env.local.',
  );
}

/* --------------------------------- misc ---------------------------------- */

export const APP_NAME = 'Pointer';
export const APP_TAGLINE = 'The meme terminal — Solana-first, with an AI co-pilot.';

/** Canonical origin (no trailing slash). Used for OG URLs and share links in metadata. */
export function getPublicOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

/** Single tier id Phase 1 ships with. Schema supports many. */
export const DEFAULT_TIER_ID = 'default';

/** Source-of-truth labels for `user_points.source`. */
export const POINTS_SOURCES = {
  trade: 'trade',
  aiCall: 'ai_call',
  trackedWalletAdd: 'tracked_wallet_add',
} as const;
