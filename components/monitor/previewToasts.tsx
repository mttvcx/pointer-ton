'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowDownRight, ArrowUpRight, Hash, Rocket, ShoppingCart } from 'lucide-react';
import { openDeployForTweet } from '@/lib/launch/openLaunchModal';
import type { TweetLaunchInput } from '@/lib/launch/types';
import { CloseButton } from '@/components/ui/CloseButton';
import { readToastSurface } from '@/lib/ui/toastColor';
import { cn } from '@/lib/utils/cn';

function tokenHref(mint: string): string {
  return `/token/${encodeURIComponent(mint)}`;
}

const CARD_BASE =
  'flex w-[320px] items-start gap-2.5 rounded-lg border p-3 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.85)] transition-colors';

type CaMention = { channel: string; server: string; token: string; ticker: string; ca: string };

const DEMO_MENTIONS: CaMention[] = [
  { server: 'Alpha Group', channel: 'alpha-calls', token: 'Retardio', ticker: 'RETARDIO', ca: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN' },
  { server: 'Degen Lounge', channel: 'ca-drops', token: 'Fartcoin', ticker: 'FART', ca: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump' },
  { server: 'Sniper Squad', channel: 'signals', token: 'Moo Deng', ticker: 'MOODENG', ca: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY' },
  { server: 'Inner Circle', channel: 'gems', token: 'Chill Guy', ticker: 'CHILL', ca: 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump' },
];

function shortCa(ca: string): string {
  return `${ca.slice(0, 4)}…${ca.slice(-4)}`;
}

let caSeq = 0;

/** Discord CA-mention toast (sample) — card links to the token; keeps Buy/Launch. */
export function fireCaMentionToast() {
  const m = DEMO_MENTIONS[caSeq % DEMO_MENTIONS.length]!;
  caSeq += 1;
  const s = readToastSurface();
  toast.custom(
    (id) => (
      <div
        className={cn(CARD_BASE, s.custom ? 'hover:brightness-105' : 'border-white/[0.12] bg-bg-raised text-white hover:border-white/[0.2]')}
        style={s.custom ? { background: s.bg, color: s.fg, borderColor: s.border } : undefined}
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#5865F2]/20 text-[#8b95ff]">
          <Hash className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Link href={tokenHref(m.ca)} onClick={() => toast.dismiss(id)} className="block cursor-pointer">
            <p className="text-[11px] opacity-60">
              <span className="font-semibold opacity-90">{m.server}</span> · #{m.channel}
              <span className="ml-1 rounded bg-current/10 px-1 text-[8.5px] uppercase tracking-wide">sample</span>
            </p>
            <p className="mt-0.5 truncate text-[12.5px] font-semibold">
              CA for {m.token} <span className="opacity-60">${m.ticker}</span>
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-accent-primary">{shortCa(m.ca)}</p>
          </Link>
          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toast.dismiss(id);
              }}
              className="btn-press inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-signal-bull/15 py-1 text-[10.5px] font-bold text-signal-bull hover:bg-signal-bull/25"
            >
              <ShoppingCart className="h-3 w-3" strokeWidth={2.5} /> Buy
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const tweet: TweetLaunchInput = {
                  id: `discord-${m.ca}`,
                  authorHandle: m.server,
                  text: `CA for ${m.token} $${m.ticker} — ${m.ca}`,
                  imageUrls: [],
                };
                openDeployForTweet(`discord-${m.ca}`, tweet, null);
                toast.dismiss(id);
              }}
              className="btn-press inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-accent-primary/[0.14] py-1 text-[10.5px] font-bold text-accent-primary hover:bg-accent-primary/25"
            >
              <Rocket className="h-3 w-3" strokeWidth={2.5} /> Launch
            </button>
            <CloseButton size="sm" label="Dismiss" onClick={() => toast.dismiss(id)} />
          </div>
        </div>
      </div>
    ),
    { duration: 9000 },
  );
}

type Trade = { handle: string; side: 'buy' | 'sell'; token: string; ticker: string; sol: number; mc: string; mint: string };

const DEMO_TRADES: Trade[] = [
  { handle: 'cupsey', side: 'buy', token: 'Retardio', ticker: 'RETARDIO', sol: 4.2, mc: '$1.2M', mint: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN' },
  { handle: 'orangie', side: 'sell', token: 'Fartcoin', ticker: 'FART', sol: 2.8, mc: '$820K', mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump' },
  { handle: 'euris', side: 'buy', token: 'Moo Deng', ticker: 'MOODENG', sol: 6.5, mc: '$3.4M', mint: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY' },
  { handle: 'waddles', side: 'sell', token: 'Chill Guy', ticker: 'CHILL', sol: 1.1, mc: '$410K', mint: 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump' },
];

let tradeSeq = 0;

/** Tracked-wallet trade toast (sample) — the whole card links to the token page. */
export function fireTradeToast() {
  const t = DEMO_TRADES[tradeSeq % DEMO_TRADES.length]!;
  tradeSeq += 1;
  const isBuy = t.side === 'buy';
  const s = readToastSurface();
  toast.custom(
    (id) => (
      <div
        className={cn(CARD_BASE, s.custom ? 'hover:brightness-105' : 'border-white/[0.12] bg-bg-raised text-white hover:border-white/[0.2]')}
        style={s.custom ? { background: s.bg, color: s.fg, borderColor: s.border } : undefined}
      >
        <Link
          href={tokenHref(t.mint)}
          onClick={() => toast.dismiss(id)}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5"
        >
          <span
            className={cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
              isBuy ? 'bg-signal-bull/15 text-signal-bull' : 'bg-signal-bear/15 text-signal-bear',
            )}
          >
            {isBuy ? <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} /> : <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] opacity-60">
              Tracked wallet
              <span className="ml-1 rounded bg-current/10 px-1 text-[8.5px] uppercase tracking-wide">sample</span>
            </span>
            <span className="mt-0.5 block truncate text-[12.5px] font-semibold">
              @{t.handle}{' '}
              <span className={isBuy ? 'text-signal-bull' : 'text-signal-bear'}>{isBuy ? 'bought' : 'sold'}</span>{' '}
              <span className="opacity-60">${t.ticker}</span>
            </span>
            <span className="mt-0.5 block text-[10px] opacity-60">
              {t.sol} SOL · {t.mc} MC · now
            </span>
          </span>
        </Link>
        <CloseButton size="sm" label="Dismiss" onClick={() => toast.dismiss(id)} />
      </div>
    ),
    { duration: 9000 },
  );
}
