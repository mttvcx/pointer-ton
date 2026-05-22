import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activity, ExternalLink } from 'lucide-react';
import { EntityLocker } from '@/components/ai/EntityLocker';
import { CopyButton } from '@/components/shared/CopyButton';
import { StatStrip, type StatItem } from '@/components/shared/StatStrip';
import { explorerUrlForAccount } from '@/lib/chains/explorerUrls';
import { inferMintKind } from '@/lib/chains/mintKind';
import { getWalletStats } from '@/lib/db/wallets';
import { getSolBalanceLamports } from '@/lib/solana/recent-activity';
import { WalletSolActivityPanel } from '@/components/wallet/WalletSolActivityPanel';
import { getTonBalanceNano } from '@/lib/ton/tonCenter';
import { isValidPublicKey, shortenAddress } from '@/lib/utils/addresses';
import {
  formatCompactUsd,
  formatNumber,
  formatRelativeTime,
  lamportsToSol,
} from '@/lib/utils/formatters';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

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

  if (kind === 'sol') {
    let balStr = '\u2014';
    try {
      const lamports = await getSolBalanceLamports(address);
      balStr = `${formatNumber(lamportsToSol(lamports), { decimals: 4 })} SOL`;
    } catch {
      balStr = '\u2014';
    }
    balancePrimary = { label: 'SOL balance', value: balStr };
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
              href={`/wallets?wallet=${encodeURIComponent(address)}`}
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
            </div>
            <div className="mt-4">
              <WalletSolActivityPanel address={address} />
            </div>
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
