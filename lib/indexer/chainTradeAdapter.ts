import type { MintSwapRow } from '@/lib/db/mintSwaps';
import { inferSwapEventKind } from '@/lib/indexer/inferSwapEventKind';
import type { ChainDeskTrade } from '@/lib/indexer/types';

/** Map indexed swap row → desk trades table shape. */
export function mintSwapToDeskTrade(row: MintSwapRow): ChainDeskTrade | null {
  const wallet = row.wallet?.trim();
  if (!wallet) return null;

  const eventKind = inferSwapEventKind(row);

  return {
    id: `chain-${row.id}`,
    user_id: wallet,
    mint: row.mint,
    side: row.side,
    amount_in_raw: String(row.token_amount_raw),
    amount_out_raw: String(row.token_amount_raw),
    amount_sol: row.sol_amount,
    amount_token: row.token_amount_ui,
    price_usd_at_fill: row.price_usd,
    tx_signature: row.signature,
    fee_paid_lamports: null,
    platform_fee_lamports: null,
    priority_fee_lamports: null,
    jito_tip_lamports: null,
    status: 'confirmed',
    failure_reason: null,
    submitted_at: row.block_time,
    confirmed_at: row.block_time,
    chain_wallet: wallet,
    wallet_address: wallet,
    source: 'chain_indexer',
    event_kind: eventKind,
    market_cap_usd_at_fill: row.market_cap_usd,
  };
}
