'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AppChainId } from '@/lib/chains/appChain';
import { hydrateTradeEventsFromMintTrades, getTokenIdentityTradeEvents } from '@/lib/identity/tradeEvents';
import { WalletIdentityLabel } from '@/components/identity/WalletIdentityLabel';
import { explorerAccountUrlForChain } from '@/lib/chains/explorer';
import { formatCompactUsd, formatRelativeTime } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

type TradeRow = {
  wallet_address: string;
  side: string;
  submitted_at: string;
  price_usd?: number | null;
  amount_usd?: number | null;
  tx_signature?: string | null;
};

export function KnownWalletActivityStrip({
  chain,
  mint,
  className,
}: {
  chain: AppChainId;
  mint: string;
  className?: string;
}) {
  const tradesQ = useQuery({
    queryKey: ['token-trades-identity', mint],
    queryFn: async () => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/trades?limit=80`);
      if (!r.ok) return [] as TradeRow[];
      const json = (await r.json()) as { trades?: TradeRow[] };
      return json.trades ?? [];
    },
    staleTime: 30_000,
  });

  const events = useMemo(() => {
    const stored = getTokenIdentityTradeEvents({ chain, tokenAddress: mint });
    if (stored.length > 0) return stored.slice(0, 12);
    const rows = tradesQ.data ?? [];
    return hydrateTradeEventsFromMintTrades(chain, mint, rows).slice(0, 12);
  }, [chain, mint, tradesQ.data]);

  if (events.length === 0) return null;

  return (
    <section
      className={cn(
        'rounded-md border border-white/[0.08] bg-bg-sunken/40 px-2 py-2',
        className,
      )}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
        Known wallet activity
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[11px]">
          <thead>
            <tr className="text-white/35">
              <th className="pb-1 pr-2 font-medium">Time</th>
              <th className="pb-1 pr-2 font-medium">Wallet</th>
              <th className="pb-1 pr-2 font-medium">Side</th>
              <th className="pb-1 pr-2 font-medium">Amount</th>
              <th className="pb-1 font-medium">TX</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id} className="border-t border-white/[0.05]">
                <td className="py-1.5 pr-2 tabular-nums text-white/55">
                  {formatRelativeTime(ev.timestamp)}
                </td>
                <td className="py-1.5 pr-2">
                  <WalletIdentityLabel
                    chain={chain}
                    address={ev.walletAddress}
                    href={`/wallet/${ev.walletAddress}`}
                    showAddress={false}
                    maxBadges={2}
                    avatarSize={20}
                  />
                </td>
                <td
                  className={cn(
                    'py-1.5 pr-2 font-semibold uppercase',
                    ev.side === 'buy' ? 'text-emerald-400' : 'text-rose-400',
                  )}
                >
                  {ev.side}
                </td>
                <td className="py-1.5 pr-2 tabular-nums text-white/80">
                  {ev.amountUsd != null ? formatCompactUsd(ev.amountUsd) : '—'}
                </td>
                <td className="py-1.5">
                  {ev.txHash ? (
                    <a
                      href={
                        chain === 'sol'
                          ? `https://solscan.io/tx/${ev.txHash}`
                          : chain === 'eth'
                            ? `https://etherscan.io/tx/${ev.txHash}`
                            : chain === 'bnb'
                              ? `https://bscscan.com/tx/${ev.txHash}`
                              : chain === 'base'
                                ? `https://basescan.org/tx/${ev.txHash}`
                                : explorerAccountUrlForChain(ev.walletAddress, chain)
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-primary hover:underline"
                    >
                      View
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
