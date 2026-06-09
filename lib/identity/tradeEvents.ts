import type { AppChainId } from '@/lib/chains/appChain';
import { resolveWalletIdentity } from '@/lib/identity/identityService';
import { normalizeWalletAddress } from '@/lib/identity/normalize';
import type { TradeIdentityEvent } from '@/lib/identity/types';

export type MintTradeHydrateRow = {
  wallet_address?: string | null;
  chain_wallet?: string | null;
  side: string;
  submitted_at: string;
  price_usd?: number | null;
  price_usd_at_fill?: number | null;
  amount_usd?: number | null;
  tx_signature?: string | null;
};

function resolveTradeWallet(row: MintTradeHydrateRow): string | null {
  const candidates = [row.wallet_address, row.chain_wallet];
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const t = c.trim();
    if (t.length > 0) return t;
  }
  return null;
}

const eventsByToken = new Map<string, TradeIdentityEvent[]>();

function tokenKey(chain: AppChainId, tokenAddress: string): string {
  return `${chain}:${tokenAddress.trim()}`;
}

/** Register a known-wallet trade marker (chart overlay / activity strip). */
export function registerTradeIdentityEvent(
  ev: Omit<TradeIdentityEvent, 'id' | 'avatarUrl' | 'displayName' | 'badges' | 'identityId'> & {
    id?: string;
  },
): TradeIdentityEvent {
  const resolved = resolveWalletIdentity({
    chain: ev.chain,
    address: ev.walletAddress,
  });
  const full: TradeIdentityEvent = {
    id: ev.id ?? `tie_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    chain: ev.chain,
    tokenAddress: ev.tokenAddress,
    walletAddress: ev.walletAddress,
    identityId: resolved.identityId,
    side: ev.side,
    timestamp: ev.timestamp,
    priceUsd: ev.priceUsd,
    amountUsd: ev.amountUsd,
    amountToken: ev.amountToken,
    txHash: ev.txHash,
    pnlAfter: ev.pnlAfter,
    source: ev.source,
    avatarUrl: resolved.avatarUrl,
    displayName: resolved.manualOverride ? resolved.displayName : resolved.displayName,
    badges: resolved.badges,
  };
  const key = tokenKey(ev.chain, ev.tokenAddress);
  const list = eventsByToken.get(key) ?? [];
  list.push(full);
  list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  eventsByToken.set(key, list.slice(0, 500));
  return full;
}

export function getTokenIdentityTradeEvents(params: {
  chain: AppChainId;
  tokenAddress: string;
  from?: string;
  to?: string;
}): TradeIdentityEvent[] {
  const key = tokenKey(params.chain, params.tokenAddress);
  let list = [...(eventsByToken.get(key) ?? [])];
  if (params.from) {
    list = list.filter((e) => e.timestamp >= params.from!);
  }
  if (params.to) {
    list = list.filter((e) => e.timestamp <= params.to!);
  }
  return list.filter((e) => e.identityId != null || e.displayName != null);
}

export type HydrateMintTradesResult = {
  events: TradeIdentityEvent[];
  skippedInvalidWallet: number;
};

/** Hydrate trade rows from mint / chain trades API shape. */
export function hydrateTradeEventsFromMintTrades(
  chain: AppChainId,
  tokenAddress: string,
  trades: MintTradeHydrateRow[],
): TradeIdentityEvent[] {
  return hydrateTradeEventsFromMintTradesDetailed(chain, tokenAddress, trades).events;
}

export function hydrateTradeEventsFromMintTradesDetailed(
  chain: AppChainId,
  tokenAddress: string,
  trades: MintTradeHydrateRow[],
): HydrateMintTradesResult {
  const out: TradeIdentityEvent[] = [];
  let skippedInvalidWallet = 0;

  for (const t of trades) {
    const wallet = resolveTradeWallet(t);
    if (!wallet) {
      skippedInvalidWallet += 1;
      continue;
    }

    const { valid } = normalizeWalletAddress(chain, wallet);
    if (!valid) {
      skippedInvalidWallet += 1;
      continue;
    }

    const side = t.side === 'sell' ? 'sell' : 'buy';
    const resolved = resolveWalletIdentity({ chain, address: wallet });
    if (!resolved.identityId && resolved.displayName === resolved.shortAddress) continue;

    const priceUsd = t.price_usd_at_fill ?? t.price_usd ?? null;
    out.push({
      id: `trade_${t.tx_signature ?? t.submitted_at}`,
      chain,
      tokenAddress,
      walletAddress: wallet,
      identityId: resolved.identityId,
      side,
      timestamp: t.submitted_at,
      priceUsd,
      amountUsd: t.amount_usd ?? null,
      amountToken: null,
      txHash: t.tx_signature ?? null,
      pnlAfter: null,
      source: 'trades',
      avatarUrl: resolved.avatarUrl,
      displayName: resolved.displayName,
      badges: resolved.badges,
    });
  }

  if (skippedInvalidWallet > 0 && process.env.NODE_ENV === 'development') {
    console.debug('[hydrateTradeEventsFromMintTrades] skipped invalid wallet rows', {
      skippedInvalidWallet,
      total: trades.length,
    });
  }

  return { events: out, skippedInvalidWallet };
}
