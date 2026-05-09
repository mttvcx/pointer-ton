import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activity, ExternalLink } from 'lucide-react';
import { EntityLocker } from '@/components/ai/EntityLocker';
import { CopyButton } from '@/components/shared/CopyButton';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatStrip, type StatItem } from '@/components/shared/StatStrip';
import { getWalletStats } from '@/lib/db/wallets';
import {
  getRecentSignaturesForAddress,
  getSolBalanceLamports,
} from '@/lib/solana/recent-activity';
import {
  explorerAddressUrl,
  explorerTxUrl,
  isValidPublicKey,
  shortenAddress,
} from '@/lib/utils/addresses';
import {
  formatCompactUsd,
  formatNumber,
  formatRelativeTime,
  lamportsToSol,
} from '@/lib/utils/formatters';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const short =
    address.length > 12 ? `${address.slice(0, 4)}\u2026${address.slice(-4)}` : address;
  return { title: `Wallet ${short}` };
}

export default async function WalletDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  if (!isValidPublicKey(address)) {
    notFound();
  }

  const [balanceLamports, stats, activity] = await Promise.all([
    getSolBalanceLamports(address).catch(() => null),
    getWalletStats(address),
    getRecentSignaturesForAddress(address, 25).catch(() => []),
  ]);

  const statItems: StatItem[] = [
    {
      label: 'TON balance',
      value:
        balanceLamports != null
          ? `${formatNumber(lamportsToSol(balanceLamports), { decimals: 4 })} TON`
          : '\u2014',
    },
    {
      label: 'PnL 30d',
      value: formatCompactUsd(stats?.pnl_usd_30d),
      tone:
        stats?.pnl_usd_30d != null
          ? stats.pnl_usd_30d >= 0
            ? 'bull'
            : 'bear'
          : 'default',
    },
    {
      label: 'PnL 7d',
      value: formatCompactUsd(stats?.pnl_usd_7d),
      tone:
        stats?.pnl_usd_7d != null
          ? stats.pnl_usd_7d >= 0
            ? 'bull'
            : 'bear'
          : 'default',
    },
    {
      label: 'Win rate 30d',
      value:
        stats?.win_rate_30d != null
          ? `${stats.win_rate_30d.toFixed(1)}%`
          : '\u2014',
    },
    {
      label: 'Trades 30d',
      value:
        stats?.trades_30d != null
          ? formatNumber(stats.trades_30d, { decimals: 0 })
          : '\u2014',
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EntityLocker type="wallet" id={address} />

      <div className="border-b border-border-subtle bg-bg-base/60 px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.02em] text-fg-muted">
              Wallet
            </p>
            <h1 className="mt-0.5 tabular-nums text-base font-semibold tabular-nums text-fg-primary sm:text-lg">
              {shortenAddress(address, 6)}
            </h1>
            <div className="mt-0.5">
              <CopyButton
                value={address}
                toastLabel="Wallet address copied"
                label="Copy wallet address"
                className="tabular-nums text-[11px] text-fg-secondary hover:text-fg-primary"
              >
                <span className="break-all">{address}</span>
              </CopyButton>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Link
              href={`/trackers?wallet=${encodeURIComponent(address)}`}
              prefetch={false}
              className="focus-ring rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 text-[11px] font-medium text-fg-secondary transition hover:border-border-default hover:text-fg-primary"
              title="Add this address to your wallet trackers"
            >
              Track this wallet
            </Link>
            <Link
              href="/wallets"
              prefetch={false}
              className="focus-ring rounded-md border border-accent-primary/35 bg-accent-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-accent-primary transition hover:bg-accent-primary/15"
            >
              Create / manage wallets
            </Link>
            <a
              href={explorerAddressUrl(address)}
              target="_blank"
              rel="noreferrer"
              className="focus-ring inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 text-[11px] font-medium text-accent-primary transition hover:border-accent-primary/40"
            >
              TON explorer
              <ExternalLink className="h-3 w-3 opacity-80" />
            </a>
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-[1400px] text-[10px] text-fg-muted sm:px-4">
          <strong className="font-medium text-fg-secondary">Trading wallets:</strong> embedded or linked TON wallets are
          created on the{' '}
          <Link href="/wallets" className="text-accent-primary hover:underline">
            Wallets
          </Link>{' '}
          page—not on this public address view.
        </p>
      </div>

      <div className="mx-auto w-full max-w-[1400px] space-y-3 px-3 py-3">
        <StatStrip items={statItems} />

        {stats ? (
          <p className="text-[10px] text-fg-muted">
            Aggregates updated {formatRelativeTime(stats.computed_at)} - feeds and webhooks
            backfill in later steps.
          </p>
        ) : null}

        <section className="border-b border-border-subtle p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.02em] text-fg-muted">
              <Activity className="h-3 w-3" />
              Recent signatures
            </h2>
            <span className="rounded border border-border-subtle bg-bg-base px-1.5 py-px tabular-nums text-[10px] tabular-nums text-fg-secondary">
              {activity.length}
            </span>
          </div>

          {activity.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No recent signatures"
              description="The RPC returned no recent activity for this account."
            />
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3 text-right">Slot</th>
                    <th className="py-2 pr-3">Result</th>
                    <th className="py-2">Signature</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums text-xs text-fg-primary">
                  {activity.map((row) => (
                    <tr
                      key={row.signature}
                      className="group border-b border-border-subtle/80 transition hover:bg-bg-hover"
                    >
                      <td className="py-2 pr-3 text-fg-secondary">
                        {row.blockTime != null
                          ? formatRelativeTime(new Date(row.blockTime * 1000))
                          : '\u2014'}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatNumber(row.slot, { decimals: 0 })}
                      </td>
                      <td className="py-2 pr-3">
                        {row.err ? (
                          <span className="rounded bg-signal-bear/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-signal-bear ring-1 ring-inset ring-signal-bear/30">
                            fail
                          </span>
                        ) : (
                          <span className="rounded bg-signal-bull/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-signal-bull ring-1 ring-inset ring-signal-bull/30">
                            ok
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1">
                          <a
                            href={explorerTxUrl(row.signature)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent-primary transition hover:underline"
                          >
                            {shortenAddress(row.signature, 5)}
                          </a>
                          <CopyButton
                            value={row.signature}
                            iconOnly
                            label="Copy signature"
                            iconClassName="opacity-0 group-hover:opacity-100"
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
