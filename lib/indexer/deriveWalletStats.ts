import type { MintSwapRow } from '@/lib/db/mintSwaps';
import type { MintWalletStatsRow } from '@/lib/db/mintWalletStats';

const EPS = 1e-9;

type Lot = { qty: number; unitUsd: number };

function fifoRealized(legs: { side: 'buy' | 'sell'; qty: number; unitUsd: number }[]): number {
  const lots: Lot[] = [];
  let realized = 0;
  for (const t of legs) {
    if (t.side === 'buy') {
      lots.push({ qty: t.qty, unitUsd: t.unitUsd });
      continue;
    }
    let sellLeft = t.qty;
    let cost = 0;
    while (sellLeft > EPS && lots.length > 0) {
      const lot = lots[0]!;
      const take = Math.min(sellLeft, lot.qty);
      cost += take * lot.unitUsd;
      lot.qty -= take;
      sellLeft -= take;
      if (lot.qty <= EPS) lots.shift();
    }
    const proceeds = t.qty * t.unitUsd;
    realized += proceeds - cost;
  }
  return realized;
}

function remainingLots(
  legs: { side: 'buy' | 'sell'; qty: number; unitUsd: number }[],
): Lot[] {
  const lots: Lot[] = [];
  for (const t of legs) {
    if (t.side === 'buy') {
      lots.push({ qty: t.qty, unitUsd: t.unitUsd });
      continue;
    }
    let sellLeft = t.qty;
    while (sellLeft > EPS && lots.length > 0) {
      const lot = lots[0]!;
      const take = Math.min(sellLeft, lot.qty);
      lot.qty -= take;
      sellLeft -= take;
      if (lot.qty <= EPS) lots.shift();
    }
  }
  return lots.filter((l) => l.qty > EPS);
}

/** Derive per-wallet stats from indexed mint_swaps — no synthetic values. */
export function deriveWalletStatsFromSwaps(
  swaps: MintSwapRow[],
  opts?: { currentPriceUsd?: number | null; decimals?: number },
): MintWalletStatsRow[] {
  const decimals = opts?.decimals ?? 6;
  const byWallet = new Map<string, MintSwapRow[]>();

  for (const s of swaps) {
    const arr = byWallet.get(s.wallet) ?? [];
    arr.push(s);
    byWallet.set(s.wallet, arr);
  }

  const out: MintWalletStatsRow[] = [];

  for (const [wallet, rows] of byWallet) {
    rows.sort((a, b) => a.block_time.localeCompare(b.block_time));

    let boughtRaw = 0;
    let soldRaw = 0;
    let buySol = 0;
    let sellSol = 0;
    let buyUsd = 0;
    let sellUsd = 0;

    const legs: { side: 'buy' | 'sell'; qty: number; unitUsd: number; ts: string }[] = [];

    for (const r of rows) {
      const qtyUi = r.token_amount_ui;
      const qtyRaw = r.token_amount_raw;
      const px =
        r.price_usd != null && r.price_usd > 0
          ? r.price_usd
          : r.usd_amount != null && qtyUi > 0
            ? r.usd_amount / qtyUi
            : 0;

      if (r.side === 'buy') {
        boughtRaw += qtyRaw;
        buySol += r.sol_amount;
        buyUsd += r.usd_amount ?? r.sol_amount * (px > 0 ? px * qtyUi / r.sol_amount : 0);
      } else {
        soldRaw += qtyRaw;
        sellSol += r.sol_amount;
        sellUsd += r.usd_amount ?? r.sol_amount * (px > 0 ? px * qtyUi / r.sol_amount : 0);
      }

      if (px > 0) {
        legs.push({ side: r.side, qty: qtyUi, unitUsd: px, ts: r.block_time });
      }
    }

    const realized = fifoRealized(legs);
    const lots = remainingLots(legs);
    const remainingUi = lots.reduce((s, l) => s + l.qty, 0);
    const remainingRaw = remainingUi * 10 ** decimals;
    const costBasis = lots.reduce((s, l) => s + l.qty * l.unitUsd, 0);

    const spot = opts?.currentPriceUsd;
    const unrealized =
      spot != null && spot > 0 && remainingUi > EPS
        ? remainingUi * spot - costBasis
        : null;

    const boughtUi = boughtRaw / 10 ** decimals;
    const soldUi = soldRaw / 10 ** decimals;

    out.push({
      mint: rows[0]!.mint,
      wallet,
      bought_token_raw: boughtRaw,
      sold_token_raw: soldRaw,
      buy_sol: buySol,
      sell_sol: sellSol,
      buy_usd: buyUsd,
      sell_usd: sellUsd,
      avg_buy_usd: boughtUi > EPS ? buyUsd / boughtUi : null,
      avg_sell_usd: soldUi > EPS ? sellUsd / soldUi : null,
      realized_pnl_usd: realized,
      unrealized_pnl_usd: unrealized,
      remaining_token_raw: remainingRaw,
      remaining_token_ui: remainingUi,
      first_trade_at: rows[0]?.block_time ?? null,
      last_trade_at: rows[rows.length - 1]?.block_time ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  return out;
}
