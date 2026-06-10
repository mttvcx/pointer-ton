import type { MintSwapRow } from '@/lib/db/mintSwaps';
import { filterDeskTradeSwaps } from '@/lib/indexer/deskTradeSwaps';
import { buildMintTopTraders } from '@/lib/trading/mintTopTraders';

/** Rank wallets from buy/sell swaps only (FIFO realized PnL). */
export function buildChainTopTradersFromSwaps(
  swaps: MintSwapRow[],
  limit: number,
): ReturnType<typeof buildMintTopTraders> {
  const tradeSwaps = filterDeskTradeSwaps(swaps);
  const walletToUser = new Map<string, string>();
  const trades = tradeSwaps.map((s, i) => {
    walletToUser.set(s.wallet, s.wallet);
    return {
      user_id: s.wallet,
      side: s.side,
      amount_token: s.token_amount_ui,
      price_usd_at_fill: s.price_usd,
      confirmed_at: s.block_time,
      submitted_at: s.block_time,
      _idx: i,
    };
  });

  return buildMintTopTraders({
    trades,
    userIdToWallet: walletToUser,
    cutoffMs: 0,
    limit,
  });
}
