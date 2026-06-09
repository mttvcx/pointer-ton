/**
 * Deterministic holder “desk row” enrichment for Axiom-parity tables until richer
 * on-chain snapshots and funding-graph APIs exist.
 */

import { formatCompactNumber, formatCompactUsd } from '@/lib/format';

function fnv1a(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type HolderDeskSynthFunding = {
  venue: string | null;
  ageSinceFund: string | null;
  solFunding: string | null;
  txCount: number | null;
  /** Wallets funded from the same source (Shared Funding popover). */
  sharedFundedCount: number;
};

export type SharedFundingPopoverRow = {
  address: string;
  ageSinceFund: string;
  solAmount: string;
  walletCount: number;
};

const SHARED_FUND_AGE_POOL = ['1y', '2mo', '9d', '22d', '4h', '12m', '7mo', '16d', '5mo'] as const;

/** Live-mode placeholder — no invented desk numbers until chain indexer ships. */
export const EMPTY_HOLDER_DESK_SYNTH: HolderDeskSynth = {
  solBalance: 0,
  lastActive: '\u2014',
  boughtUsd: '\u2014',
  boughtTokensCompact: '\u2014',
  buyTxCount: 0,
  avgBuyUsd: null,
  soldUsd: '\u2014',
  soldTokensCompact: '\u2014',
  sellTxCount: 0,
  avgSellUsd: null,
  uPnlUsd: '\u2014',
  uPnlUsdRaw: 0,
  remainingUsd: '\u2014',
  pctLine: 0,
  funding: null,
  heldAge: '\u2014',
};

export const EMPTY_DESK_FUNDING: HolderDeskSynthFunding = {
  venue: null,
  ageSinceFund: null,
  solFunding: null,
  txCount: null,
  sharedFundedCount: 0,
};

export type HolderDeskSynth = {
  solBalance: number;
  lastActive: string;
  boughtUsd: string;
  boughtTokensCompact: string;
  buyTxCount: number;
  avgBuyUsd: string | null;
  soldUsd: string;
  soldTokensCompact: string;
  sellTxCount: number;
  avgSellUsd: string | null;
  /** Pre-formatted display string, e.g. "+$1.8K". */
  uPnlUsd: string;
  /** Raw numeric for PnlCell sign detection. */
  uPnlUsdRaw: number;
  remainingUsd: string;
  pctLine: number;
  funding: HolderDeskSynthFunding | null;
  heldAge: string;
};

const FUNDING_BRANDS: {
  venue: string;
  ageSinceFund: string;
}[] = [
  { venue: 'Binance', ageSinceFund: '1y' },
  { venue: 'Coinbase', ageSinceFund: '7mo' },
  { venue: 'OKX', ageSinceFund: '9d' },
  { venue: 'MEXC', ageSinceFund: '22d' },
  { venue: 'Changenow', ageSinceFund: '4h' },
  { venue: 'Bridge', ageSinceFund: '12m' },
  { venue: 'OTC Desk', ageSinceFund: '2y' },
];

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function fakeFundingWallet(seed: string): string {
  const h = fnv1a(seed);
  let s = '';
  for (let i = 0; i < 44; i++) s += BASE58[(h + i * 7919) % BASE58.length];
  return s;
}

const LAST_POOL = ['44s', '58s', '2m', '7m', '1h', '4h', '1d', '6d', '15d', '3mo'] as const;
const HELD_POOL = ['2d', '7d', '16d', '22d', '7mo', '1y', '11mo'] as const;

/** Deterministic demo funding row for any wallet on a mint (holders + top traders). */
export function buildDeskFundingSynth(wallet: string, mint: string): HolderDeskSynthFunding {
  const h = fnv1a(`${wallet}|${mint}|fund`);
  const fundBase = FUNDING_BRANDS[h % FUNDING_BRANDS.length]!;
  const walletFunded = h % 3 === 0;
  const solFundingNum = Number((((h >>> 9) % 4200) / 100 + 0.12).toFixed(2));
  const txCount = 1 + (h % 14);
  const sharedFundedCount = 1 + ((h >>> 11) % 12);

  return {
    venue: walletFunded
      ? fakeFundingWallet(`${wallet}|${mint}|fund`)
      : fundBase.venue,
    ageSinceFund: fundBase.ageSinceFund,
    solFunding: formatCompactNumber(solFundingNum),
    txCount,
    sharedFundedCount,
  };
}

/** Deterministic shared-funding wallet rows for the funding-column hover popover. */
export function buildSharedFundingPopoverRows(
  seed: string,
  fundedCount: number,
  totalSol: string,
): SharedFundingPopoverRow[] {
  const h = fnv1a(`${seed}|shared-pop`);
  const rowCount = Math.min(Math.max(1, fundedCount), 5);
  const rows: SharedFundingPopoverRow[] = [];

  for (let i = 0; i < rowCount; i++) {
    const hi = fnv1a(`${seed}|shared-pop|${i}`);
    const solNum = Number((((hi >>> 5) % 42000) / 100 + (i === 0 ? 0.5 : 0.02)).toFixed(i === 0 ? 1 : 2));
    rows.push({
      address: fakeFundingWallet(`${seed}|shared-row|${i}`),
      ageSinceFund: SHARED_FUND_AGE_POOL[(h + i) % SHARED_FUND_AGE_POOL.length]!,
      solAmount: i === 0 ? totalSol : formatCompactNumber(solNum),
      walletCount: 1 + ((hi >>> 9) % 4),
    });
  }

  return rows;
}

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

  const spotUsd =
    ((h2 % 8000) + 400) / 1e11 + ((h % 5000) + 200) / 1e14 + 1e-9;

  const qty = Number.isFinite(params.qtyUi) && params.qtyUi > 0 ? params.qtyUi : (h % 9000) / 10;
  const remainingUsdNum = Math.max(1, qty * spotUsd);

  const buyMult = 1 + ((h >>> 13) % 85) / 100;
  const boughtTokensCompactNum = Math.max(qty * buyMult, qty * 1.02);
  const buyTxCount = 1 + (h % 9);
  const soldShare = ((h >>> 7) % 75) / 100;
  const soldTokensCompactNum = Math.max(0, boughtTokensCompactNum * soldShare);
  const sellTxCount = soldTokensCompactNum > boughtTokensCompactNum * 0.02 ? 1 + ((h >>> 5) % 6) : 0;

  const avgBuyUsdNum = spotUsd * (0.92 + ((h >>> 15) % 15) / 100);
  const avgSellUsdNum = sellTxCount > 0 ? spotUsd * (1.02 + ((h >>> 17) % 18) / 100) : null;

  const boughtUsdNum = boughtTokensCompactNum * avgBuyUsdNum;
  const soldUsdNum = soldTokensCompactNum * (avgSellUsdNum ?? spotUsd);

  const costBasis = qty * avgBuyUsdNum;
  const uPnlUsdRaw = remainingUsdNum - costBasis + (((h >>> 3) % 800) - 320) * 4;

  const pctLine =
    params.pctSupply != null && Number.isFinite(params.pctSupply)
      ? Math.min(100, Math.max(2, params.pctSupply))
      : Math.min(100, ((h >>> 19) % 5200) / 100 + 8);

  const funding = buildDeskFundingSynth(params.wallet, params.mint);

  return {
    solBalance,
    lastActive,
    boughtUsd: formatCompactUsd(boughtUsdNum),
    boughtTokensCompact: formatCompactNumber(boughtTokensCompactNum),
    buyTxCount,
    avgBuyUsd: avgBuyUsdNum != null ? formatCompactUsd(avgBuyUsdNum) : null,
    soldUsd: formatCompactUsd(soldUsdNum),
    soldTokensCompact: formatCompactNumber(soldTokensCompactNum),
    sellTxCount,
    avgSellUsd: avgSellUsdNum != null ? formatCompactUsd(avgSellUsdNum) : null,
    uPnlUsd: `${uPnlUsdRaw >= 0 ? '+' : ''}${formatCompactUsd(uPnlUsdRaw)}`,
    uPnlUsdRaw,
    remainingUsd: formatCompactUsd(remainingUsdNum),
    pctLine,
    funding,
    heldAge,
  };
}
