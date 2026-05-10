import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getPnlCardByShareToken,
  incrementPnlCardViewByShareToken,
} from '@/lib/db/pnlCards';
import { parsePnlCardData } from '@/lib/pnl/pnlCardModel';
import { APP_NAME, getPublicOrigin } from '@/lib/utils/constants';
import { explorerUrlSolanaTx } from '@/lib/chains/explorerUrls';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatPriceUsd, formatRelativeTime, formatUsd } from '@/lib/utils/formatters';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ shareToken: string }> };

function httpsImageForOg(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    if (new URL(url).protocol === 'https:') return url;
  } catch {
    /* ignore */
  }
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareToken } = await params;
  const row = await getPnlCardByShareToken(shareToken);
  const data = row ? parsePnlCardData(row.card_data) : null;
  const origin = getPublicOrigin();

  if (!data) {
    return {
      metadataBase: new URL(origin),
      title: 'Share card',
    };
  }

  const sym = data.symbol ?? shortenAddress(data.mint, 4);
  const pnl =
    data.side === 'sell' && data.displayRealizedPnlUsd != null
      ? ` - realized ${formatUsd(data.displayRealizedPnlUsd)}`
      : '';
  const title = `${sym} ${data.side}${pnl}`;
  const description = `${data.side.toUpperCase()} ${sym} on ${APP_NAME}.`;
  const ogImage = httpsImageForOg(data.imageUrl) ?? `${origin}/branding/pointer-mark.png`;

  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      title: `${sym} on ${APP_NAME}`,
      description,
      type: 'website',
      url: `${origin}/share/${encodeURIComponent(shareToken)}`,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${sym} on ${APP_NAME}`,
      description,
      images: [ogImage],
    },
  };
}

export default async function PnlSharePage({ params }: PageProps) {
  const { shareToken } = await params;
  if (!shareToken || shareToken.length > 64) notFound();

  await incrementPnlCardViewByShareToken(shareToken);
  const row = await getPnlCardByShareToken(shareToken);
  if (!row) notFound();

  const d = parsePnlCardData(row.card_data);
  if (!d) notFound();

  const bgClass =
    row.background_type === 'gradient'
      ? 'bg-gradient-to-br from-accent-primary/25 via-bg-base to-bg-base'
      : row.background_type === 'image' && row.background_url
        ? ''
        : '';

  const style: CSSProperties | undefined =
    row.background_type === 'image' && row.background_url
      ? {
          backgroundImage: `linear-gradient(rgba(10,11,14,0.92),rgba(10,11,14,0.92)),url(${row.background_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : undefined;

  const tokenUi =
    d.amountToken != null && Number.isFinite(d.amountToken) ? (
      <span>{formatNumber(d.amountToken, { decimals: Math.min(6, d.decimals) })}</span>
    ) : null;

  const showPnl =
    d.side === 'sell' &&
    d.displayRealizedPnlUsd != null &&
    Number.isFinite(d.displayRealizedPnlUsd);

  return (
    <main
      className={cn(
        'flex min-h-screen flex-col items-center justify-center px-4 py-10',
        bgClass || 'bg-bg-base',
      )}
      style={style}
    >
      <div className="w-full max-w-md rounded-lg border border-border-default bg-bg-base/95 p-6 shadow-xl ring-1 ring-white/[0.06]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {d.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.imageUrl}
                alt=""
                width={52}
                height={52}
                className="h-[52px] w-[52px] rounded-md object-cover ring-1 ring-border-subtle"
              />
            ) : (
              <span className="h-[52px] w-[52px] rounded-md bg-bg-hover ring-1 ring-border-subtle" />
            )}
            <div className="min-w-0">
              <h1 className="truncate tabular-nums text-lg font-semibold text-fg-primary">
                {d.symbol ?? shortenAddress(d.mint, 6)}
              </h1>
              {d.name ? (
                <p className="truncate text-xs text-fg-secondary">{d.name}</p>
              ) : null}
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
              d.side === 'buy'
                ? 'bg-signal-bull/15 text-signal-bull ring-signal-bull/30'
                : 'bg-signal-bear/15 text-signal-bear ring-signal-bear/30',
            )}
          >
            {d.side}
          </span>
        </div>

        <dl className="mt-5 space-y-2 border-t border-border-subtle pt-4 tabular-nums text-sm tabular-nums">
          {d.amountSol != null && Number.isFinite(d.amountSol) ? (
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">TON (est.)</dt>
              <dd className="text-fg-primary">{formatNumber(d.amountSol, { decimals: 4 })}</dd>
            </div>
          ) : null}
          {tokenUi ? (
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Token</dt>
              <dd className="text-fg-primary">{tokenUi}</dd>
            </div>
          ) : null}
          {d.priceUsdAtFill != null && Number.isFinite(d.priceUsdAtFill) ? (
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Fill (USD)</dt>
              <dd className="text-fg-primary">{formatPriceUsd(d.priceUsdAtFill)}</dd>
            </div>
          ) : null}
          {showPnl ? (
            <div className="flex justify-between gap-3">
              <dt className="text-fg-muted">Realized (portfolio)</dt>
              <dd
                className={cn(
                  'font-semibold',
                  (d.displayRealizedPnlUsd ?? 0) >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                )}
              >
                {formatUsd(d.displayRealizedPnlUsd!)}
                {d.displayRealizedPnlSol != null && Number.isFinite(d.displayRealizedPnlSol) ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-fg-muted">
                    {formatNumber(d.displayRealizedPnlSol, { decimals: 4 })} TON
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-3 text-[10px] leading-snug text-fg-muted">
          PnL figures are from the trader&apos;s Pointer portfolio snapshot when the card was created,
          not an on-chain proof.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
          <Link
            href={`/token/${encodeURIComponent(d.mint)}`}
            className="rounded-md bg-accent-primary px-3 py-1.5 font-medium text-fg-inverse transition hover:bg-accent-glow"
          >
            Open in {APP_NAME}
          </Link>
          <a
            href={explorerUrlSolanaTx(d.txSignature)}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border-subtle px-3 py-1.5 text-fg-secondary transition hover:border-border-default hover:text-fg-primary"
          >
            Tx {shortenAddress(d.txSignature, 4)}
          </a>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border-subtle pt-3 text-[10px] text-fg-muted">
          <span>{formatRelativeTime(d.submittedAt)}</span>
          <span className="tabular-nums tabular-nums">{row.view_count} views</span>
        </div>
      </div>

      <p className="mt-8 text-center font-sans text-xs text-fg-muted">{APP_NAME}</p>
    </main>
  );
}
