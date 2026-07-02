'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Hash, Rocket, ShoppingCart, X } from 'lucide-react';
import { openDeployForTweet } from '@/lib/launch/openLaunchModal';
import type { TweetLaunchInput } from '@/lib/launch/types';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { useXMonitorPreviewStore } from '@/store/xMonitorPreview';
import { useXMonitorSettings } from '@/store/xMonitorSettings';

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

/**
 * Fires a Discord CA-mention toast while the monitor is open + Preview is on +
 * the Discord source is enabled. Sample flow until real Discord ingest lands.
 */
export function XMonitorCaToast() {
  const railOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');
  const peekOpen = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const preview = useXMonitorPreviewStore((s) => s.preview);
  const discordOn = useXMonitorSettings((s) => s.sources.discord);
  const seqRef = useRef(0);

  const active = (railOpen || peekOpen) && preview && discordOn;

  useEffect(() => {
    if (!active) return;
    const fire = () => {
      const m = DEMO_MENTIONS[seqRef.current % DEMO_MENTIONS.length]!;
      seqRef.current += 1;
      toast.custom(
        (id) => (
          <div className="flex w-[320px] items-start gap-2.5 rounded-lg border border-white/[0.12] bg-bg-raised p-3 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.85)]">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#5865F2]/20 text-[#8b95ff]">
              <Hash className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-fg-muted">
                <span className="font-semibold text-fg-secondary">{m.server}</span> · #{m.channel}
                <span className="ml-1 rounded bg-white/[0.06] px-1 text-[8.5px] uppercase tracking-wide text-fg-muted">sample</span>
              </p>
              <p className="mt-0.5 truncate text-[12.5px] font-semibold text-white">
                CA for {m.token} <span className="text-fg-muted">${m.ticker}</span>
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-accent-primary">{shortCa(m.ca)}</p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => toast.dismiss(id)}
                  className="btn-press inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-signal-bull/15 py-1 text-[10.5px] font-bold text-signal-bull hover:bg-signal-bull/25"
                >
                  <ShoppingCart className="h-3 w-3" strokeWidth={2.5} /> Buy
                </button>
                <button
                  type="button"
                  onClick={() => {
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
                <button
                  type="button"
                  onClick={() => toast.dismiss(id)}
                  aria-label="Dismiss"
                  className="btn-press flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-white/[0.06] hover:text-fg-primary"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        ),
        { duration: 9000 },
      );
    };
    const first = window.setTimeout(fire, 6000);
    const id = window.setInterval(fire, 16000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active]);

  return null;
}
