import type { AppChainId } from '@/lib/chains/appChain';
import { resolveWalletIdentity } from '@/lib/identity/identityService';
import { walletRegistryKey } from '@/lib/identity/normalize';
import type { TradeIdentityEvent } from '@/lib/identity/types';

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

/** Hydrate trade rows from mint trades API shape. */
export function hydrateTradeEventsFromMintTrades(
  chain: AppChainId,
  tokenAddress: string,
  trades: Array<{
    wallet_address: string;
    side: string;
    submitted_at: string;
    price_usd?: number | null;
    amount_usd?: number | null;
    tx_signature?: string | null;
  }>,
): TradeIdentityEvent[] {
  const out: TradeIdentityEvent[] = [];
  for (const t of trades) {
    const side = t.side === 'sell' ? 'sell' : 'buy';
    const key = walletRegistryKey(chain, t.wallet_address);
    const resolved = resolveWalletIdentity({ chain, address: t.wallet_address });
    if (!resolved.identityId && resolved.displayName === resolved.shortAddress) continue;
    out.push({
      id: `trade_${t.tx_signature ?? t.submitted_at}`,
      chain,
      tokenAddress,
      walletAddress: t.wallet_address,
      identityId: resolved.identityId,
      side,
      timestamp: t.submitted_at,
      priceUsd: t.price_usd ?? null,
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
  return out;
}
