/**
 * Deterministic holder “desk row” enrichment for Axiom-parity tables until richer
 * on-chain snapshots and funding-graph APIs exist.
 */

function fnv1a(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type HolderFundingSynth = {
  venue: string;
  ageSinceFund: string;
  solFunding: number;
  /** Space-separated RGB triple for `rgb(...)`. */
  brandRgb: string;
};

export type HolderDeskSynth = {
  solBalance: number;
  lastActive: string;
  boughtUsd: number;
  boughtTokensCompact: number;
  buyTxCount: number;
  avgBuyUsd: number | null;
  soldUsd: number;
  soldTokensCompact: number;
  sellTxCount: number;
  avgSellUsd: number | null;
  uPnlUsd: number;
  remainingUsd: number;
  pctLine: number;
  funding: HolderFundingSynth;
  heldAge: string;
};

const FUNDING_BRANDS: Omit<HolderFundingSynth, 'solFunding'>[] = [
  { venue: 'Binance', ageSinceFund: '1y', brandRgb: '240 185 11' },
  { venue: 'Coinbase', ageSinceFund: '7mo', brandRgb: '37 99 235' },
  { venue: 'OKX', ageSinceFund: '9d', brandRgb: '250 204 21' },
  { venue: 'MEXC', ageSinceFund: '22d', brandRgb: '52 211 153' },
  { venue: 'Changenow', ageSinceFund: '4h', brandRgb: '139 92 246' },
  { venue: 'Bridge', ageSinceFund: '12m', brandRgb: '148 163 184' },
  { venue: 'OTC Desk', ageSinceFund: '2y', brandRgb: '248 113 113' },
] as const;

const LAST_POOL = ['44s', '58s', '2m', '7m', '1h', '4h', '1d', '6d', '15d', '3mo'] as const;
const HELD_POOL = ['2d', '7d', '16d', '22d', '7mo', '1y', '11mo'] as const;

export function buildHolderDeskSynth(params: {
  wallet: string;
  mint: string;
  qtyUi: number;
  pctSupply: number | null;
}): HolderDeskSynth {
  const h = fnv1a(`${params.wallet}|${params.mint}`);
  const h2 = fnv1a(`${params.mint}|${params.wallet}|ex`);

  const solBalance = Number((((h % 18500) + 50) / 100).toFixed(3));
  const lastActive = LAST_POOL[h % LAST_POOL.length]!;
  const heldAge = HELD_POOL[h2 % HELD_POOL.length]!;

  const fundBase = FUNDING_BRANDS[h % FUNDING_BRANDS.length]!;
  const funding: HolderFundingSynth = {
    ...fundBase,
    solFunding: Number((((h >>> 9) % 4200) / 100 + 0.12).toFixed(2)),
  };

  const spotUsd =
    ((h2 % 8000) + 400) / 1e11 + ((h % 5000) + 200) / 1e14 + 1e-9;

  const qty = Number.isFinite(params.qtyUi) && params.qtyUi > 0 ? params.qtyUi : (h % 9000) / 10;
  const remainingUsd = Math.max(1, qty * spotUsd);

  const buyMult = 1 + ((h >>> 13) % 85) / 100;
  const boughtTokensCompact = Math.max(qty * buyMult, qty * 1.02);
  const buyTxCount = 1 + (h % 9);
  const soldShare = ((h >>> 7) % 75) / 100;
  const soldTokensCompact = Math.max(0, boughtTokensCompact * soldShare);
  const sellTxCount = soldTokensCompact > boughtTokensCompact * 0.02 ? 1 + ((h >>> 5) % 6) : 0;

  const avgBuyUsd = spotUsd * (0.92 + ((h >>> 15) % 15) / 100);
  const avgSellUsd = sellTxCount > 0 ? spotUsd * (1.02 + ((h >>> 17) % 18) / 100) : null;

  const boughtUsd = boughtTokensCompact * avgBuyUsd;
  const soldUsd = soldTokensCompact * (avgSellUsd ?? spotUsd);

  const costBasis = qty * avgBuyUsd;
  const uPnlUsd = remainingUsd - costBasis + (((h >>> 3) % 800) - 320) * 4;

  const pctLine =
    params.pctSupply != null && Number.isFinite(params.pctSupply)
      ? Math.min(100, Math.max(2, params.pctSupply))
      : Math.min(100, ((h >>> 19) % 5200) / 100 + 8);

  return {
    solBalance,
    lastActive,
    boughtUsd,
    boughtTokensCompact,
    buyTxCount,
    avgBuyUsd,
    soldUsd,
    soldTokensCompact,
    sellTxCount,
    avgSellUsd,
    uPnlUsd,
    remainingUsd,
    pctLine,
    funding,
    heldAge,
  };
}
