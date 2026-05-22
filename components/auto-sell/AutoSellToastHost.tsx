'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Check, Loader2, X } from 'lucide-react';
import { explorerUrlSolanaTx } from '@/lib/chains/explorerUrls';
import { cn } from '@/lib/utils/cn';
import { useAutoSellToastStore, type AutoSellToastItem } from '@/store/autoSellToasts';

const DISMISS_MS = 8000;

function ToastBody({
  item,
  isPending,
  isSuccess,
  isFailed,
  isSkipped,
}: {
  item: AutoSellToastItem;
  isPending: boolean;
  isSuccess: boolean;
  isFailed: boolean;
  isSkipped: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <StatusIcon
        isPending={isPending}
        isSuccess={isSuccess}
        isFailed={isFailed}
        isSkipped={isSkipped}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[13px] font-medium leading-snug',
            isPending ? 'text-white/55' : 'text-white/90',
          )}
        >
          {item.title}
        </p>
        {item.subtitle ? (
          <p className="mt-0.5 text-[11px] leading-snug text-white/45">{item.subtitle}</p>
        ) : null}
        {isSuccess && item.txSignature ? (
          <a
            data-tx-link
            href={explorerUrlSolanaTx(item.txSignature)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[11px] text-rose-400/90 underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {item.txSignature.slice(0, 8)}…{item.txSignature.slice(-4)} · Solscan
          </a>
        ) : null}
        {isFailed && item.error ? (
          <p className="mt-1 text-[11px] leading-snug text-red-400/90">{item.error}</p>
        ) : null}
      </div>
    </div>
  );
}

function StatusIcon({
  isPending,
  isSuccess,
  isFailed,
  isSkipped,
}: {
  isPending: boolean;
  isSuccess: boolean;
  isFailed: boolean;
  isSkipped: boolean;
}) {
  return (
    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-white/45" aria-hidden />
      ) : isSuccess ? (
        <Check className="h-4 w-4 text-rose-400" aria-hidden />
      ) : isFailed ? (
        <X className="h-4 w-4 text-red-400" aria-hidden />
      ) : (
        <span className="text-[13px]" aria-hidden>
          {isSkipped ? '⏸' : '⚠'}
        </span>
      )}
    </div>
  );
}

function ToastCard({ item }: { item: AutoSellToastItem }) {
  const dismiss = useAutoSellToastStore((s) => s.dismiss);

  useEffect(() => {
    const t = window.setTimeout(() => dismiss(item.id), DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [dismiss, item.id]);

  const isPending = item.status === 'pending';
  const isSuccess = item.status === 'success';
  const isFailed = item.status === 'failed';
  const isSkipped = item.status === 'skipped';
  const tokenHref = item.mint ? `/token/${encodeURIComponent(item.mint)}` : null;

  const panel = (
    <div className="min-w-[280px] rounded-xl border border-rose-400/20 bg-[#0e0e10] p-3 shadow-2xl shadow-black/60">
      <ToastBody
        item={item}
        isPending={isPending}
        isSuccess={isSuccess}
        isFailed={isFailed}
        isSkipped={isSkipped}
      />
    </div>
  );

  if (!tokenHref) return panel;

  return (
    <Link
      href={tokenHref}
      className="block rounded-xl outline-none ring-accent-primary/40 focus-visible:ring-2"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a[data-tx-link]')) e.preventDefault();
      }}
    >
      {panel}
    </Link>
  );
}

export function AutoSellToastHost() {
  const items = useAutoSellToastStore((s) => s.items);
  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-auto fixed bottom-28 right-4 z-[319] flex flex-col gap-2"
      aria-live="polite"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
