/** Approximate durable-nonce rent (shown in Enable Blitz — paid to the network, not Pointer). */
export const BLITZ_NONCE_SETUP_SOL = 0.0073;

export type TradeFeeExtra = {
  jitoTipLamports?: number;
  priorityFeeLamports?: number;
  autoFee?: boolean;
  maxFeeSol?: number;
  landing?: 'jito' | 'rpc';
};

const BLITZ_MIN_JITO_TIP_LAMPORTS = 400_000;
const BLITZ_MIN_PRIORITY_FEE_LAMPORTS = 250_000;
const BLITZ_MIN_MAX_FEE_SOL = 0.12;

/** Pointer’s Turbo equivalent — Jito landing + boosted prio/tip with auto-fee on. */
export function resolveBlitzTradeExtras(
  blitzEnabled: boolean,
  presetExtra: TradeFeeExtra = {},
): TradeFeeExtra {
  if (!blitzEnabled) return presetExtra;
  return {
    ...presetExtra,
    landing: 'jito',
    jitoTipLamports: Math.max(presetExtra.jitoTipLamports ?? 0, BLITZ_MIN_JITO_TIP_LAMPORTS),
    priorityFeeLamports: Math.max(
      presetExtra.priorityFeeLamports ?? 0,
      BLITZ_MIN_PRIORITY_FEE_LAMPORTS,
    ),
    autoFee: true,
    maxFeeSol: Math.max(presetExtra.maxFeeSol ?? 0, BLITZ_MIN_MAX_FEE_SOL),
  };
}

export function isBlitzWallet(address: string | null | undefined, enabled: string[]): boolean {
  if (!address) return false;
  return enabled.includes(address);
}

/** Split landing from fee fields for quote API bodies. */
export function buildBlitzAwareFees(
  blitzEnabled: boolean,
  presetFees: TradeFeeExtra,
): { fees: Omit<TradeFeeExtra, 'landing'>; landing: 'jito' | 'rpc' | undefined } {
  const resolved = resolveBlitzTradeExtras(blitzEnabled, presetFees);
  const { landing, ...fees } = resolved;
  return { fees, landing };
}
