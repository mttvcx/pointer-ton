'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { Bell, BellOff, Hash, Rocket, ShoppingCart } from 'lucide-react';
import { openDeployForTweet } from '@/lib/launch/openLaunchModal';
import type { TweetLaunchInput } from '@/lib/launch/types';
import { CloseButton } from '@/components/ui/CloseButton';
import { readToastSurface } from '@/lib/ui/toastColor';
import { cn } from '@/lib/utils/cn';
import { useWalletTrackerMuteStore } from '@/store/walletTrackerMute';
import { toastWalletTrackedTradeDemo } from '@/lib/walletTracker/walletTrackerToast';

/** Filled red bell → click to mute this source (tracked wallet OR discord server). */
function MuteBell({ muteKey }: { muteKey: string }) {
  const muted = useWalletTrackerMuteStore((s) => s.isMuted(muteKey));
  const toggle = useWalletTrackerMuteStore((s) => s.toggleMuted);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(muteKey);
      }}
      className={cn(
        'btn-press shrink-0 rounded-md p-1 transition-colors',
        muted ? 'text-fg-muted hover:text-fg-secondary' : 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300',
      )}
      title={muted ? 'Notifications off — click to turn on' : 'Turn off notifications for this source'}
      aria-pressed={!muted}
    >
      {muted ? <BellOff className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden /> : <Bell className="h-3.5 w-3.5 fill-current" strokeWidth={2} aria-hidden />}
    </button>
  );
}

/** Small inline protocol dot — pump.fun icon, gold ring when migrated. */
function ProtocolDot({ protocol }: { protocol: string }) {
  const p = protocol.toLowerCase();
  const migrated = p === 'pump_migrated' || p === 'migrated' || p === 'raydium';
  const isPump = p === 'pump' || p === 'pumpfun' || migrated;
  return (
    <span
      className={cn(
        'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border align-middle',
        migrated ? 'border-amber-400/80 ring-1 ring-amber-400/40' : 'border-white/15',
      )}
      title={migrated ? 'pump.fun · migrated' : 'pump.fun'}
      aria-hidden
    >
      {isPump ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/icons/pumpfun.webp" alt="" width={9} height={9} className="h-2 w-2 object-contain" />
      ) : (
        <span className="text-[7px] font-bold uppercase text-fg-secondary">{p.slice(0, 1)}</span>
      )}
    </span>
  );
}

function tokenHref(mint: string): string {
  return `/token/${encodeURIComponent(mint)}`;
}

const CARD_BASE =
  'flex w-[320px] items-start gap-2.5 rounded-lg border p-3 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.85)] transition-colors';

type CaMention = { channel: string; server: string; token: string; ticker: string; ca: string; ageLabel: string; protocol: string };

const DEMO_MENTIONS: CaMention[] = [
  { server: 'Alpha Group', channel: 'alpha-calls', token: 'Retardio', ticker: 'RETARDIO', ca: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', ageLabel: '2m', protocol: 'pump' },
  { server: 'Degen Lounge', channel: 'ca-drops', token: 'Fartcoin', ticker: 'FART', ca: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', ageLabel: '38m', protocol: 'pump_migrated' },
  { server: 'Sniper Squad', channel: 'signals', token: 'Moo Deng', ticker: 'MOODENG', ca: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY', ageLabel: '5m', protocol: 'pump' },
  { server: 'Inner Circle', channel: 'gems', token: 'Chill Guy', ticker: 'CHILL', ca: 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump', ageLabel: '1h', protocol: 'pump_migrated' },
];

function shortCa(ca: string): string {
  return `${ca.slice(0, 4)}…${ca.slice(-4)}`;
}

let caSeq = 0;

/** Discord CA-mention toast (sample) — card links to the token; keeps Buy/Launch. */
export function fireCaMentionToast() {
  const m = DEMO_MENTIONS[caSeq % DEMO_MENTIONS.length]!;
  caSeq += 1;
  // Respect a muted discord source — bell off = no pings from this server.
  if (useWalletTrackerMuteStore.getState().isMuted(`discord:${m.server}`)) return;
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
          <div className="flex items-start gap-1">
            <Link href={tokenHref(m.ca)} onClick={() => toast.dismiss(id)} className="block min-w-0 flex-1 cursor-pointer">
              <p className="text-[11px] opacity-60">
                <span className="font-semibold opacity-90">{m.server}</span> · #{m.channel}
                <span className="ml-1 rounded bg-current/10 px-1 text-[8.5px] uppercase tracking-wide">sample</span>
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] font-semibold">
                CA for {m.token} <span className="opacity-60">${m.ticker}</span>
                <span className="ml-0.5 rounded bg-current/10 px-1 py-px text-[8.5px] font-semibold tabular-nums opacity-80">{m.ageLabel}</span>
                <ProtocolDot protocol={m.protocol} />
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-accent-primary">{shortCa(m.ca)}</p>
            </Link>
            {/* Filled red bell — click to mute this discord server */}
            <MuteBell muteKey={`discord:${m.server}`} />
          </div>
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
            {/* Close one → collapse the whole stack (Axiom-style). */}
            <CloseButton size="sm" label="Dismiss all" onClick={() => toast.dismiss()} />
          </div>
        </div>
      </div>
    ),
    { duration: 3000 },
  );
}

let tradeSeq = 0;

/**
 * Tracked-wallet trade toast (sample) — routes to the RICH WalletTrackerTradeToast
 * (age chip + protocol badge + mute bell), alternating buy/sell so the demo shows
 * both a pump badge and a gold "migrated" badge. Same card the real pings use.
 */
export function fireTradeToast() {
  toastWalletTrackedTradeDemo(tradeSeq % 2 === 0 ? 'buy' : 'sell');
  tradeSeq += 1;
}
