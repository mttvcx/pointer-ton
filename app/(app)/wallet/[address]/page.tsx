import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activity, ExternalLink } from 'lucide-react';
import { EntityLocker } from '@/components/ai/EntityLocker';
import { CopyButton } from '@/components/shared/CopyButton';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatStrip, type StatItem } from '@/components/shared/StatStrip';
import { explorerUrlForAccount, explorerUrlSolanaTx } from '@/lib/chains/explorerUrls';
import { inferMintKind } from '@/lib/chains/mintKind';
import { getWalletStats } from '@/lib/db/wallets';
import { getSolBalanceLamports } from '@/lib/solana/recent-activity';
import { getSolWalletActivity, type SolWalletActivityItem } from '@/lib/solana/wallet-activity';
import { getTonBalanceNano } from '@/lib/ton/tonCenter';
import { isValidPublicKey, shortenAddress } from '@/lib/utils/addresses';
import {
  formatCompactUsd,
  formatNumber,
  formatRelativeTime,
  lamportsToSol,
} from '@/lib/utils/formatters';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

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

function explorerButtonLabel(kind: ReturnType<typeof inferMintKind>): string {
  if (kind === 'sol') return 'Solscan';
  if (kind === 'ton') return 'Tonviewer';
  if (kind === 'evm') return 'Explorer';
  return 'Explorer';
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

  const kind = inferMintKind(address);
  if (kind === 'unknown') {
    notFound();
  }

  const stats = await getWalletStats(address).catch(() => null);

  let balancePrimary: StatItem;
  let solActivity: SolWalletActivityItem[] = [];

  if (kind === 'sol') {
    let balStr = '\u2014';
    try {
      const lamports = await getSolBalanceLamports(address);
      balStr = `${formatNumber(lamportsToSol(lamports), { decimals: 4 })} SOL`;
    } catch {
      balStr = '\u2014';
    }
    balancePrimary = { label: 'SOL balance', value: balStr };

    try {
      solActivity = await getSolWalletActivity(address, 22);
    } catch {
      solActivity = [];
    }
  } else if (kind === 'ton') {
    const canonical = normalizeTonAddress(address) ?? address;
    const nano = await getTonBalanceNano(canonical);
    const balStr =
      nano != null ? `${formatNumber(Number(nano) / 1e9, { decimals: 4 })} TON` : '\u2014';
    balancePrimary = { label: 'TON balance', value: balStr };
  } else {
    balancePrimary = { label: 'Balance', value: '\u2014' };
  }

  const statItems: StatItem[] = [
    balancePrimary,
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

  const accountExplorer = explorerUrlForAccount(address);
  const explorerLabel = explorerButtonLabel(kind);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg-base">
      <EntityLocker type="wallet" id={address} />

      <div className="border-b border-border-subtle bg-bg-base/80 px-3 py-4 sm:px-5">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Wallet
            </p>
            <h1 className="mt-1 tabular-nums text-lg font-semibold tracking-tight text-fg-primary sm:text-xl">
              {shortenAddress(address, 6)}
            </h1>
            <div className="mt-1.5 max-w-[min(100%,42rem)]">
              <CopyButton
                value={address}
                toastLabel="Wallet address copied"
                label="Copy wallet address"
                className="tabular-nums text-[11px] text-fg-secondary hover:text-fg-primary"
              >
                <span className="break-all font-mono text-[11px] leading-relaxed text-fg-secondary">
                  {address}
                </span>
              </CopyButton>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href={`/trackers?wallet=${encodeURIComponent(address)}`}
              prefetch={false}
              className="focus-ring rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-[11px] font-medium text-fg-secondary transition hover:border-border-default hover:text-fg-primary"
              title="Add this address to your wallet trackers"
            >
              Track this wallet
            </Link>
            <Link
              href="/wallets"
              prefetch={false}
              className="focus-ring rounded-lg border border-accent-primary/35 bg-accent-primary/10 px-3 py-2 text-[11px] font-semibold text-accent-primary transition hover:bg-accent-primary/15"
            >
              Create / manage wallets
            </Link>
            <a
              href={accountExplorer}
              target="_blank"
              rel="noreferrer"
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-base px-3 py-2 text-[11px] font-medium text-accent-primary transition hover:border-accent-primary/35 hover:bg-bg-hover"
            >
              {explorerLabel}
              <ExternalLink className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
            </a>
          </div>
        </div>

        {kind === 'ton' ? (
          <p className="mx-auto mt-4 max-w-[1400px] text-[11px] leading-relaxed text-fg-muted">
            <strong className="font-medium text-fg-secondary">Trading wallets:</strong> embedded or linked
            TON wallets are created on the{' '}
            <Link href="/wallets" className="text-accent-primary hover:underline">
              Wallets
            </Link>{' '}
            page—not on this public address view.
          </p>
        ) : kind === 'sol' ? (
          <p className="mx-auto mt-4 max-w-[1400px] text-[11px] leading-relaxed text-fg-muted">
            Balances and activity load live from your configured Solana RPC (Helius). On-chain PnL
            aggregates fill as trades are indexed.
          </p>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-[1400px] space-y-5 px-3 py-5 sm:px-5">
        <StatStrip items={statItems} />

        {stats ? (
          <p className="text-[10px] text-fg-muted">
            Aggregates updated {formatRelativeTime(stats.computed_at)} — dashboard trades and wallet
            stats when available.
          </p>
        ) : null}

        {kind === 'sol' ? (
          <section>
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                <Activity className="h-3.5 w-3.5 opacity-90" strokeWidth={2} />
                Recent activity
              </h2>
              <span className="rounded-md border border-border-subtle/80 bg-bg-base/60 px-2 py-0.5 tabular-nums text-[10px] text-fg-secondary">
                {solActivity.length}
              </span>
            </div>

            {solActivity.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  description="No recent transactions from RPC — check HELIUS_API_KEY / SOLANA_RPC_URL or try again shortly."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {solActivity.map((row) => (
                  <li
                    key={row.signature}
                    className="group rounded-xl border border-border-subtle/50 bg-bg-base/50 px-4 py-3 transition-colors hover:border-border-subtle hover:bg-white/[0.035]"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold text-fg-primary">{row.label}</span>
                          {row.success ? (
                            <span className="rounded-md bg-signal-bull/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-bull ring-1 ring-inset ring-signal-bull/25">
                              Success
                            </span>
                          ) : (
                            <span className="rounded-md bg-signal-bear/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-bear ring-1 ring-inset ring-signal-bear/25">
                              Failed
                            </span>
                          )}
                        </div>
                        {row.sublabel ? (
                          <p className="text-[11px] leading-snug text-fg-muted">{row.sublabel}</p>
                        ) : null}
                        <p className="font-mono text-[10px] text-fg-muted/90">
                          Slot {formatNumber(row.slot, { decimals: 0 })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                        <span className="text-[11px] tabular-nums text-fg-secondary">
                          {row.blockTime != null
                            ? formatRelativeTime(new Date(row.blockTime * 1000))
                            : '\u2014'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <a
                            href={explorerUrlSolanaTx(row.signature)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-medium text-accent-primary transition hover:underline"
                          >
                            View tx
                          </a>
                          <CopyButton
                            value={row.signature}
                            iconOnly
                            label="Copy signature"
                            iconClassName="opacity-70 transition group-hover:opacity-100"
                          />
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : kind === 'ton' ? (
          <section className="rounded-xl border border-border-subtle/60 bg-bg-base/40 px-4 py-5">
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              <Activity className="h-3.5 w-3.5" strokeWidth={2} />
              Activity
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-fg-secondary">
              Live per-transaction history for TON isn&apos;t wired in this view yet. Open Tonviewer for
              the full ledger for this wallet.
            </p>
            <a
              href={accountExplorer}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-[11px] font-medium text-accent-primary transition hover:bg-bg-hover"
            >
              Open full history
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          </section>
        ) : (
          <section className="rounded-xl border border-border-subtle/60 bg-bg-base/40 px-4 py-5">
            <p className="text-[13px] text-fg-secondary">
              Use the explorer link above for this chain&apos;s transaction history.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
