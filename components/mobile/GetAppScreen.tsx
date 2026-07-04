'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Activity, Bot, ChevronDown, Radar, ShieldCheck, Zap } from 'lucide-react';
import type { MobilePlatform } from '@/lib/utils/userAgent';
import { cn } from '@/lib/utils/cn';

const IOS_URL = process.env.NEXT_PUBLIC_IOS_APP_URL?.trim() || '';
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL?.trim() || '';

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 384 512" className={className} fill="currentColor" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C32.3 141.2 0 184.8 0 251.3c0 24.2 4.4 49.2 13.3 75 11.8 33.9 54.3 117.3 98.7 115.9 23.2-.5 39.6-16.4 69.8-16.4 29.3 0 44.5 16.4 70.4 16.4 44.8-.7 83.2-76.5 94.4-110.5-60.1-28.3-57.9-82.9-57.9-84.9zm-46-159.6c22.1-26.2 20.1-50.1 19.5-58.7-19.6 1.2-42.2 13.4-55.1 28.4-14.2 16.1-22.6 36-20.8 57.4 21.2 1.6 40.5-9.3 56.4-27.1z" />
    </svg>
  );
}

function PlayLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <path d="M48 32 296 256 48 480c-9 5-20 1-20-12V44c0-13 11-17 20-12z" fill="#34d399" />
      <path d="M48 32 296 256 364 188 80 26c-12-7-24-3-32 6z" fill="#60a5fa" />
      <path d="M48 480 296 256 364 324 80 486c-12 7-24 3-32-6z" fill="#fb7185" />
      <path d="M296 256 364 188 472 250c14 8 14 20 0 28l-108 62z" fill="#fbbf24" />
    </svg>
  );
}

/** Fade + slide in once on scroll (IntersectionObserver — cheap, GPU-friendly). */
function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-all duration-700 ease-[cubic-bezier(0.22,0.9,0.22,1)] motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

const FEATURES: { icon: typeof Activity; title: string; body: string }[] = [
  { icon: Activity, title: 'Pulse — realtime discovery', body: 'New launches, migrations and momentum the second they happen. Never miss the move.' },
  { icon: Bot, title: 'AI copilot', body: 'Instant, honest risk reads on any token or wallet. The AI grades the rug risk so you don’t have to guess.' },
  { icon: Radar, title: 'Track the smart money', body: 'Follow KOLs and winning wallets. Get alerted the moment they ape — copy the sharpest traders.' },
  { icon: Zap, title: 'One-tap trading', body: 'Solana-fast execution with the lowest friction. Quote, sign, done.' },
  { icon: ShieldCheck, title: 'Bubble maps & clusters', body: 'See who’s coordinated, how supply is held, and the real holder graph before you buy.' },
];

function StoreButton({ platform }: { platform: MobilePlatform }) {
  const isIos = platform === 'ios';
  const url = isIos ? IOS_URL : ANDROID_URL;
  const live = Boolean(url);
  const label = isIos ? 'App Store' : 'Google Play';
  const Logo = isIos ? AppleLogo : PlayLogo;

  const inner = (
    <span className="flex items-center justify-center gap-3">
      <Logo className={cn('h-7 w-7', isIos && 'text-black')} />
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
          {live ? 'Download on the' : 'Coming soon to'}
        </span>
        <span className="text-[17px] font-semibold">{label}</span>
      </span>
    </span>
  );

  if (!live) {
    return (
      <div className="w-full max-w-[300px] cursor-default rounded-2xl bg-white/90 px-6 py-3.5 text-black opacity-70">
        {inner}
      </div>
    );
  }
  return (
    <a
      href={url}
      className="w-full max-w-[300px] rounded-2xl bg-white px-6 py-3.5 text-black shadow-lg shadow-black/30 transition-transform active:scale-[0.98]"
    >
      {inner}
    </a>
  );
}

/**
 * Mobile-web landing — Pointer is a native-app-first product, so phone visitors
 * get a clean "get the app" screen instead of the full web app. Platform-aware
 * store CTA + a scroll-revealed showcase of what the app does.
 */
export function GetAppScreen({ platform }: { platform: MobilePlatform }) {
  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-bg-base text-fg-primary">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] opacity-60"
        style={{ background: 'radial-gradient(120% 80% at 50% -10%, rgb(var(--accent-primary-rgb) / 0.18), transparent 70%)' }}
      />

      {/* Hero */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <Image
          src="/branding/pointer-bird.png"
          alt="Pointer"
          width={72}
          height={72}
          priority
          className="mb-6 h-16 w-16 drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
        />
        <h1 className="text-[40px] font-bold leading-none tracking-tight">Pointer</h1>
        <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-fg-secondary">
          Where the sharpest traders are. Built for your phone — not your browser.
        </p>

        <div className="mt-9 flex w-full flex-col items-center gap-3">
          <StoreButton platform={platform} />
          <p className="text-[12px] text-fg-muted">
            {platform === 'ios'
              ? 'iPhone & iPad'
              : 'Android phones & tablets'}{' '}
            · free to download
          </p>
        </div>

        <div className="absolute bottom-7 flex flex-col items-center gap-1 text-fg-muted">
          <span className="text-[11px] uppercase tracking-wide">Scroll to explore</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </div>
      </section>

      {/* Showcase */}
      <section className="mx-auto max-w-[520px] px-6 pb-24">
        <Reveal className="mb-10 text-center">
          <h2 className="text-[26px] font-bold tracking-tight">Everything, in your pocket</h2>
          <p className="mt-2 text-[14px] text-fg-secondary">The full trading desk, rebuilt native.</p>
        </Reveal>

        <div className="flex flex-col gap-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="flex gap-4 rounded-2xl border border-border-subtle bg-bg-raised/60 p-4 backdrop-blur">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent-primary-rgb)/0.14)] text-[rgb(var(--accent-primary-rgb))]">
                  <f.icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold">{f.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-fg-secondary">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 flex flex-col items-center gap-4 text-center" delay={80}>
          <p className="max-w-[280px] text-[15px] font-medium text-fg-primary">
            Ready when you are.
          </p>
          <StoreButton platform={platform} />
          <p className="mt-2 text-[11px] text-fg-muted">© Pointer · the sharpest edge in crypto</p>
        </Reveal>
      </section>
    </main>
  );
}
