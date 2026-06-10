import type { MintSwapEventKind } from '@/lib/indexer/types';
import type { MintSwapRow } from '@/lib/db/mintSwaps';

/** SOL received on a remove-liq desk row (filters dust / normal sells). */
const MIN_REMOVE_LIQ_SOL = 50;

/**
 * Resolve desk event kind for an indexed swap row.
 * DB may lack event_kind column or rows may predate remove-liq parser fixes.
 */
export function inferSwapEventKind(row: Pick<
  MintSwapRow,
  'event_kind' | 'source' | 'side' | 'sol_amount' | 'token_amount_ui' | 'pool_address'
>): MintSwapEventKind {
  const stored = row.event_kind;
  if (stored === 'remove_liq' || stored === 'add_liq') return stored;

  const src = row.source?.toLowerCase() ?? '';
  if (src.includes('remove_liq') || src.includes('withdraw')) return 'remove_liq';
  if (src.includes('add_liq')) return 'add_liq';

  if (row.side === 'sell' && row.sol_amount >= 100) {
    return 'remove_liq';
  }

  if (
    row.side === 'sell' &&
    row.sol_amount >= MIN_REMOVE_LIQ_SOL &&
    row.token_amount_ui <= 0.01
  ) {
    return 'remove_liq';
  }

  return 'swap';
}
