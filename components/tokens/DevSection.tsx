'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CopyButton } from '@/components/shared/CopyButton';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { formatDuration, formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import type { DevWalletStatsRow } from '@/lib/db/wallets';
import { syntheticCreatorDev } from '@/lib/dev/demoTokenFixtures';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';

export function DevSection({
  creatorWallet,
  dev,
}: {
  creatorWallet: string | null;
  dev: DevWalletStatsRow | null;
}) {
  const uiDemo = useUiDemoMode();
  const effectiveDev = useMemo(() => {
    if (dev) return dev;
    if (uiDemo && creatorWallet) return syntheticCreatorDev(creatorWallet);
    return null;
  }, [creatorWallet, dev, uiDemo]);

  if (!creatorWallet) {
    return (
      <section className="p-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.02em] text-fg-muted">
          Creator
        </h2>
        <p className="mt-2 text-[12px] text-fg-secondary">No creator wallet linked yet.</p>
      </section>
    );
  }

  if (!effectiveDev) {
    return (
      <CreatorCard wallet={creatorWallet}>
        <p className="mt-2 text-[12px] leading-snug text-fg-secondary">
          Dev reputation aggregates appear once indexer backfill runs for this wallet.
        </p>
      </CreatorCard>
    );
  }

  const rugMed = effectiveDev.median_time_to_rug_seconds;

  return (
    <CreatorCard
      wallet={effectiveDev.wallet_address}
      title={dev ? 'Creator track record' : 'Creator track record (demo)'}
    >
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Launched" value={String(effectiveDev.tokens_launched)} />
        <Stat label="Mooned" value={String(effectiveDev.tokens_mooned)} tone="bull" />
        <Stat label="Rugged" value={String(effectiveDev.tokens_rugged)} tone="bear" />
      </dl>
      <p className="mt-3 text-[11px] leading-snug text-fg-secondary">
        {effectiveDev.tokens_active ? (
          <>
            <span className="tabular-nums text-fg-primary">{effectiveDev.tokens_active}</span> active.{' '}
          </>
        ) : null}
        {rugMed != null && rugMed > 0
          ? `Median time-to-rug: ${formatDuration(rugMed)}.`
          : 'Median time-to-rug not available yet.'}
      </p>
      {effectiveDev.total_volume_generated_usd != null ? (
        <p className="mt-1 text-[10px] text-fg-muted">
          Est. volume spawned{' '}
          <span className="tabular-nums text-fg-secondary">
            ${formatNumber(effectiveDev.total_volume_generated_usd / 1000, { decimals: 0 })}k
          </span>
          {effectiveDev.reputation_score != null ? (
            <>
              {' '}
              · rep{' '}
              <span className="tabular-nums text-fg-secondary">{effectiveDev.reputation_score}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {effectiveDev.last_launch_at ? (
        <p className="mt-1 text-[10px] text-fg-muted">
          Last launch indexed {formatRelativeTime(effectiveDev.last_launch_at)}.
        </p>
      ) : null}
    </CreatorCard>
  );
}

function CreatorCard({
  wallet,
  title = 'Creator',
  children,
}: {
  wallet: string;
  title?: string;
  children: React.ReactNode;
}) {
  const hoverProps = useEntityHover(
    useMemo(() => ({ type: 'wallet' as const, id: wallet }), [wallet]),
  );

  return (
    <section className="p-3" {...hoverProps}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.02em] text-fg-muted">
          {title}
        </h2>
      </div>
      <p className="mt-1 inline-flex items-center gap-1 tabular-nums text-[11px] tabular-nums" title={wallet}>
        <Link
          href={`/wallet/${wallet}`}
          className="text-fg-secondary transition hover:text-accent-primary"
        >
          {shortenAddress(wallet, 5)}
        </Link>
        <CopyButton value={wallet} iconOnly label="Copy creator wallet" toastLabel="Creator wallet copied" />
      </p>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'bull' | 'bear';
}) {
  const color =
    tone === 'bull'
      ? 'text-signal-bull'
      : tone === 'bear'
        ? 'text-signal-bear'
        : 'text-fg-primary';
  return (
    <div className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </div>
      <div className={`mt-0.5 tabular-nums text-sm font-semibold tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}
