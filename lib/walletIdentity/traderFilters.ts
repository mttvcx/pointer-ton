import type { MintTopTraderRow } from '@/lib/trading/mintTopTraders';
import { getRecognizedWallet } from '@/lib/walletIdentity/mockRecognizedWallets';
import type { ResolvedWalletDisplay } from '@/lib/hooks/useWalletLabels';

export type TraderDeskFilter =
  | 'all'
  | 'kol'
  | 'tracking'
  | 'renamed'
  | 'smart_money'
  | 'fresh'
  | 'snipers'
  | 'dev_linked'
  | 'high_pnl'
  | 'still_holding';

export const TRADER_FILTER_OPTIONS: { id: TraderDeskFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'kol', label: 'KOL' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'renamed', label: 'Renamed' },
  { id: 'smart_money', label: 'Smart' },
  { id: 'fresh', label: 'Fresh' },
  { id: 'snipers', label: 'Snipers' },
  { id: 'dev_linked', label: 'Dev' },
  { id: 'high_pnl', label: 'High PnL' },
  { id: 'still_holding', label: 'Holding' },
];

const EPS = 1e-6;

export function traderRowMatchesFilter(params: {
  row: MintTopTraderRow;
  creatorWallet: string | null;
  tracked: boolean;
  labelDisp: ResolvedWalletDisplay | null;
  filter: TraderDeskFilter;
}): boolean {
  const { row, creatorWallet, tracked, labelDisp, filter } = params;
  if (filter === 'all') return true;

  const rec = getRecognizedWallet(row.wallet_address);
  const renamed = Boolean(labelDisp?.labeled);

  switch (filter) {
    case 'kol':
      return Boolean(rec?.badges.includes('kol'));
    case 'tracking':
      return tracked;
    case 'renamed':
      return renamed;
    case 'smart_money':
      return (rec?.badges.includes('smart_money') ?? false) || rec?.category === 'smart_money';
    case 'fresh': {
      if (!row.first_trade_at) return false;
      const t = Date.now() - new Date(row.first_trade_at).getTime();
      return t < 86400000 * 5;
    }
    case 'snipers':
      return Boolean(rec?.badges.includes('sniper')) || rec?.category === 'sniper';
    case 'dev_linked':
      return Boolean(creatorWallet && creatorWallet === row.wallet_address);
    case 'high_pnl':
      return row.realized_pnl_usd >= 2500;
    case 'still_holding':
      return row.buy_token_qty - row.sell_token_qty > EPS;
    default:
      return true;
  }
}

/** Holder row shape used for desk pills (matches API / demo holder rows). */
export type HolderDeskPick = {
  wallet_address: string;
  pct_of_supply: number | null;
  is_dev: boolean | null;
  is_sniper: boolean | null;
};

export function holderRowMatchesFilter(params: {
  row: HolderDeskPick;
  creatorWallet: string | null;
  tracked: boolean;
  labelDisp: ResolvedWalletDisplay | null;
  filter: TraderDeskFilter;
}): boolean {
  const { row, creatorWallet, tracked, labelDisp, filter } = params;
  if (filter === 'all') return true;

  const rec = getRecognizedWallet(row.wallet_address);
  const renamed = Boolean(labelDisp?.labeled);

  switch (filter) {
    case 'kol':
      return Boolean(rec?.badges.includes('kol'));
    case 'tracking':
      return tracked;
    case 'renamed':
      return renamed;
    case 'smart_money':
      return Boolean(rec?.badges.includes('smart_money')) || rec?.category === 'smart_money';
    case 'fresh':
      return false;
    case 'snipers':
      return Boolean(row.is_sniper);
    case 'dev_linked':
      return Boolean(row.is_dev) || Boolean(creatorWallet && creatorWallet === row.wallet_address);
    case 'high_pnl':
      return (row.pct_of_supply ?? 0) >= 4;
    case 'still_holding':
      return true;
    default:
      return true;
  }
}
