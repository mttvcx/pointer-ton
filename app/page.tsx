'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  ChevronDown,
  Layers,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { usePointerAuth, readLandingEnterPending, clearLandingEnterPending, readLandingRequireSignIn, clearLandingRequireSignIn, setLandingEnterPending } from '@/lib/auth/pointerAuth';
import { LandingSignInModal } from '@/components/auth/LandingSignInModal';
import { LandingAmbientBackdrop } from '@/components/landing/LandingAmbientBackdrop';
import { toast } from 'sonner';
import { dismissAuthToast, toastAuthenticated, toastAuthenticating } from '@/lib/auth/authToasts';
import { usePrivy } from '@privy-io/react-auth';
import { cn } from '@/lib/utils/cn';
import { APP_NAME } from '@/lib/utils/constants';

/** Drop hero loops into /public/landing/ and set these env vars when ready. */
const HERO_VIDEO_SRC = process.env.NEXT_PUBLIC_LANDING_HERO_VIDEO_URL?.trim() || '';
const HERO_VIDEO_LEFT_SRC =
  process.env.NEXT_PUBLIC_LANDING_HERO_VIDEO_LEFT_URL?.trim() || '';
const HERO_VIDEO_RIGHT_SRC =
  process.env.NEXT_PUBLIC_LANDING_HERO_VIDEO_RIGHT_URL?.trim() || '';

type FeatureTabId = 'pulse' | 'desk' | 'copilot' | 'wallets';

type FeatureTab = {
  id: FeatureTabId;
  title: string;
  subtitle: string;
  tagline: string;
  detail: string;
  sideCards: { label: string; sub: string }[];
  poweredBy: string;
};

const FEATURE_TABS: FeatureTab[] = [
  {
    id: 'pulse',
    title: 'Live Pulse rail',
    subtitle: 'Pulse',
    tagline: 'Three columns. Zero noise.',
    detail: 'NEW · Final Stretch · Migrated, streaming straight from Helius. Quick-buy without leaving the rail.',
    sideCards: [
      { label: 'Sol-first', sub: 'Pump.fun · Bonk · Moonshot · Heaven' },
      { label: 'Quick-buy', sub: 'One-click presets, USDC or SOL' },
      { label: 'No filler', sub: 'Honest empty states when cold' },
    ],
    poweredBy: 'Helius · DexScreener',
  },
  {
    id: 'desk',
    title: 'Token desk',
    subtitle: 'Token desk',
    tagline: 'Every fill. Every dev.',
    detail: 'Live trades next to the chart. Top traders ranked by realized PnL. Holders, dev tokens, hover dossier — all keyboard-fast.',
    sideCards: [
      { label: 'FIFO PnL', sub: 'Realized + unrealized' },
      { label: 'Dev cross-link', sub: 'Other tokens by the same creator' },
      { label: 'Hover dossier', sub: 'Wallet intel inline' },
    ],
    poweredBy: 'Jupiter · Helius',
  },
  {
    id: 'copilot',
    title: 'AI co-pilot',
    subtitle: 'AI co-pilot',
    tagline: 'One keystroke. Plain English.',
    detail: 'Ask why a wallet is dumping or what a dev has shipped before. Sourced answers in under a second.',
    sideCards: [
      { label: 'Token briefs', sub: 'Liquidity, holders, history' },
      { label: 'Wallet briefs', sub: 'PnL streak, related labels' },
      { label: 'Alert narration', sub: 'Why this trigger fired' },
    ],
    poweredBy: 'Pointer LLM stack',
  },
  {
    id: 'wallets',
    title: 'Wallet intel',
    subtitle: 'Wallet tracker',
    tagline: 'Track. Label. Catch streaks.',
    detail: 'Tag any wallet. Get notified on buys and sells. Hover any address on Pulse for a 12-row dossier.',
    sideCards: [
      { label: 'Rolling PnL', sub: '7D / 30D realized' },
      { label: 'Push notifs', sub: 'Buy / sell triggers' },
      { label: 'Share cards', sub: 'One-click PnL flex' },
    ],
    poweredBy: 'Privy · Helius',
  },
];

const INTEGRATIONS = [
  { src: '/logos/protocols/pumpfun.png', alt: 'Pump.fun' },
  { src: '/logos/protocols/bonk.png', alt: 'Bonk' },
  { src: '/logos/protocols/moonshot.png', alt: 'Moonshot' },
  { src: '/logos/protocols/jupiter.png', alt: 'Jupiter' },
  { src: '/logos/protocols/raydium.png', alt: 'Raydium' },
  { src: '/logos/protocols/meteora.png', alt: 'Meteora' },
  { src: '/logos/protocols/orca.png', alt: 'Orca' },
  { src: '/logos/protocols/heaven.png', alt: 'Heaven' },
  { src: '/logos/protocols/launchlab.png', alt: 'LaunchLab' },
  { src: '/logos/protocols/printr.png', alt: 'Printr' },
  { src: '/logos/protocols/believe.png', alt: 'Believe', fallback: '/logos/protocols/bags.png' },
  { src: '/logos/protocols/usdc.png', alt: 'USDC' },
];

const FAQ_ITEMS = [
  {
    q: 'What is Pointer?',
    a: 'A Solana memecoin terminal. Live Pulse, real desk data, AI co-pilot, one-click execution.',
  },
  {
    q: 'How do I sign in?',
    a: 'Privy. Continue with Google, X, email, or any Solana wallet. No password to remember.',
  },
  {
    q: 'Is the wallet custodial?',
    a: 'No. Privy is Turnkey-backed and non-custodial. You can also link your own Phantom, Solflare, or Backpack at any time.',
  },
  {
    q: 'How is Pointer different from Axiom / Padre / BullX?',
    a: 'The AI co-pilot is first-class, not a sidebar afterthought. Empty states are honest. Pulse falls back to DexScreener + Jupiter when OHLC snapshots are cold.',
  },
  {
    q: 'When does multi-chain ship?',
    a: 'Sol-first today. TON kept for the original audience. BNB / Base / Hyperliquid perps are wired in the codebase and rolling out as liquidity routing locks.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { ready } = usePointerAuth();
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  const [signInOpen, setSignInOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FeatureTabId>('pulse');
  // When a sign-in is mid-flight (OAuth just returned to `/`, or auth is about to
  // resolve) we show a full-screen "Signing you in…" gate instead of the marketing
  // page — otherwise the ~2s Privy session-restore looks like a failed login.
  const [entering, setEntering] = useState(false);

  /** OAuth return — show the entering gate + loading toast until Privy restores. */
  useEffect(() => {
    if (!readLandingEnterPending()) return;
    setEntering(true);
    toastAuthenticating();
  }, []);

  /** Redirect once Privy auth completes (popup, OTP, or OAuth return to `/`). */
  useEffect(() => {
    if (!privyReady || !privyAuthenticated) return;

    const pendingEnter = readLandingEnterPending();
    const requireFreshSignIn = readLandingRequireSignIn();
    if (requireFreshSignIn && !pendingEnter) return;

    setEntering(true); // keep the gate up through the navigation, no marketing flash
    clearLandingEnterPending();
    clearLandingRequireSignIn();
    setSignInOpen(false);
    dismissAuthToast();
    toastAuthenticated();
    router.push('/pulse');
  }, [privyReady, privyAuthenticated, router]);

  /** OAuth hung — drop the gate + toast after 45s so the user isn't stuck forever. */
  useEffect(() => {
    if (!readLandingEnterPending()) return;
    const t = window.setTimeout(() => {
      if (!privyAuthenticated) {
        setEntering(false);
        clearLandingEnterPending();
        toast.error('Sign-in timed out', {
          description: 'Close any OAuth popup, refresh, and try Google again.',
        });
      }
    }, 45_000);
    return () => window.clearTimeout(t);
  }, [privyAuthenticated]);

  const handlePrimaryCta = useCallback(() => {
    if (privyAuthenticated) {
      clearLandingRequireSignIn();
      router.push('/pulse');
      return;
    }
    setLandingEnterPending();
    setSignInOpen(true);
  }, [privyAuthenticated, router]);

  const ctaLabel = 'Start Trading';

  if (entering) {
    return <SigningInGate />;
  }

  return (
    <main className="relative isolate min-h-screen overflow-x-hidden bg-bg-base text-fg-primary">
      <LandingAmbientBackdrop />

      <TopNav onPrimary={handlePrimaryCta} ctaLabel={ctaLabel} ready={ready} />

      <Hero onPrimary={handlePrimaryCta} ctaLabel={ctaLabel} ready={ready} />

      <section className="relative z-10 flex min-h-[85vh] w-full items-center px-6 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto w-full max-w-[88rem]">
          <ProductVideoFrame />
        </div>
      </section>

      <section className="relative z-10 flex min-h-screen w-full flex-col justify-center px-6 py-20 text-center sm:px-10 sm:py-28">
        <div className="mx-auto w-full max-w-[88rem]">
        <SectionHeading
          eyebrow="The terminal"
          title={
            <>
              Built for{' '}
              <span className="bg-gradient-to-r from-accent-primary via-accent-glow to-accent-primary bg-clip-text text-transparent">
                live trading
      </span>
              .
            </>
          }
        />
        <FeatureTabSwitcher activeTab={activeTab} onChange={setActiveTab} />
        <div className="mt-10 sm:mt-14">
          <FeatureTabPanel activeTab={activeTab} />
        </div>
        </div>
      </section>

      <section className="relative z-10 flex min-h-[70vh] w-full flex-col justify-center px-6 py-20 text-center sm:px-10 sm:py-28">
        <div className="mx-auto w-full max-w-[88rem]">
        <SectionHeading
          eyebrow="Integrations"
          title="Every launchpad, every router, one rail."
        />
        <IntegrationsStrip />
        </div>
      </section>

      <section className="relative z-10 w-full px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto w-full max-w-[88rem]">
        <ArchitectureSection />
        </div>
      </section>

      <section className="relative z-10 w-full px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto w-full max-w-3xl text-center">
        <SectionHeading eyebrow="FAQ" title="Quick answers." />
        <FaqAccordion />
        </div>
      </section>

      <section className="relative z-10 w-full px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto w-full max-w-[88rem]">
        <FinalCta onPrimary={handlePrimaryCta} ctaLabel={ctaLabel} ready={ready} />
        </div>
      </section>

      <LandingSignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

      <LandingFooter />
    </main>
  );
}

/* ---------------------------------------------------------------------------
 * Signing-in gate — shown while an OAuth/login is resolving so the ~2s Privy
 * session-restore never looks like a logged-out marketing page.
 * ------------------------------------------------------------------------- */
function SigningInGate() {
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center gap-5 overflow-hidden bg-bg-base px-6 text-center text-fg-primary">
      <LandingAmbientBackdrop />
      <div className="relative z-10 flex flex-col items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
        <img
          src="/branding/pointer-bird.png"
          alt=""
          width={64}
          height={64}
          className="h-14 w-auto animate-pulse object-contain drop-shadow-[0_6px_24px_rgb(var(--accent-primary-rgb)/0.5)]"
          draggable={false}
        />
        <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <Loader2 className="h-4 w-4 animate-spin text-accent-glow" strokeWidth={2.5} />
          Signing you in…
        </div>
        <p className="max-w-xs text-[13px] leading-relaxed text-fg-muted">
          Setting up your session — you&apos;ll land in the terminal in a second.
        </p>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------------------
 * Top nav — wordmark left; Join as creator + Start Trading right only
 * ------------------------------------------------------------------------- */
function TopNav({
  onPrimary,
  ctaLabel,
  ready,
}: {
  onPrimary: () => void;
  ctaLabel: string;
  ready: boolean;
}) {
  return (
    <header className="relative z-30 mx-auto flex w-full max-w-[88rem] items-center justify-between px-6 py-6 sm:px-10 sm:py-7">
      <Link href="/" className="inline-flex items-center gap-3.5 select-none">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
        <img
          src="/branding/pointer-bird.png"
          alt=""
          width={48}
          height={48}
          className="h-10 w-auto object-contain sm:h-12"
          draggable={false}
        />
        <span className="text-[22px] font-semibold leading-none tracking-tight sm:text-[26px]">pointer.</span>
      </Link>
      <nav className="flex items-center gap-3">
        <Link
          href="/portal"
          className={cn(
            'btn-press focus-ring inline-flex h-10 shrink-0 items-center rounded-full px-5 text-[14px] font-semibold sm:h-11 sm:px-6',
            'bg-gradient-to-b from-[#6b77f7] to-[#5865F2] text-white',
            'shadow-[0_4px_14px_-4px_rgba(88,101,242,0.55),inset_0_1px_0_rgb(255_255_255/0.16)]',
            'transition-[transform,filter,box-shadow] hover:brightness-110',
          )}
        >
          Join as creator
        </Link>
        <button
          type="button"
          onClick={onPrimary}
          disabled={!ready}
          className={cn(
            'btn-press focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-5 text-[14px] font-semibold text-fg-inverse sm:h-11 sm:px-6',
            'bg-gradient-to-b from-accent-glow to-accent-primary',
            'shadow-[0_4px_14px_-4px_rgb(var(--accent-primary-rgb)/0.65),inset_0_1px_0_rgb(255_255_255/0.18)]',
            'transition-[transform,filter,box-shadow] hover:brightness-110 hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {ctaLabel}
        </button>
      </nav>
    </header>
  );
}

/* ---------------------------------------------------------------------------
 * Hero — centered brand mark, tight headline, single CTA, "Backed by" slot
 * ------------------------------------------------------------------------- */
function Hero({
  onPrimary,
  ctaLabel,
  ready,
}: {
  onPrimary: () => void;
  ctaLabel: string;
  ready: boolean;
}) {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl overflow-visible px-5 pt-10 pb-16 text-center sm:px-8 sm:pt-20 sm:pb-20">
      <HeroFlankVideos />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center">
        {/* Centered brand mark — Axiom-style large mark above the H1 */}
        <div className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img
            src="/branding/pointer-bird.png"
            alt=""
            width={96}
            height={96}
            className="h-full w-auto object-contain drop-shadow-[0_6px_20px_rgb(0_0_0/0.45)]"
            draggable={false}
          />
        </div>

        <h1 className="mt-7 text-balance text-[44px] font-semibold leading-[1.04] tracking-tight sm:text-[64px] md:text-[76px]">
          Where the{' '}
          <span className="bg-gradient-to-b from-accent-glow to-accent-primary bg-clip-text text-transparent">
            sharpest
          </span>{' '}
          traders are.
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-[20px] leading-snug text-fg-secondary sm:text-[26px]">
          50% cashback, among the highest in the market.
        </p>

        <button
          type="button"
          onClick={onPrimary}
          disabled={!ready}
          className={cn(
            'btn-press focus-ring group/cta mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-[15px] font-semibold text-fg-inverse',
            'bg-gradient-to-b from-accent-glow to-accent-primary',
            'shadow-[0_14px_40px_-12px_rgb(var(--accent-primary-rgb)/0.8),inset_0_1px_0_rgb(255_255_255/0.2)]',
            'transition-[transform,filter,box-shadow] hover:brightness-110 hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {ctaLabel}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover/cta:translate-x-0.5"
            strokeWidth={2.5}
            aria-hidden
          />
        </button>

        {/* Backed-by slot — placeholder for partner logo */}
        <div className="mt-10 flex flex-col items-center gap-2.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-fg-muted">
            Backed by
          </span>
          <BackedByPlaceholder />
        </div>
      </div>
    </section>
  );
}

/** Axiom-style tilted video cards flanking the hero — drop in separate loops later. */
function HeroFlankVideos() {
  return (
    <>
      <HeroFlankVideo slot="left" src={HERO_VIDEO_LEFT_SRC} tilt={-8} sway="lg" delay={0} />
      <HeroFlankVideo slot="right" src={HERO_VIDEO_RIGHT_SRC} tilt={8} sway="md" delay={-6} />
    </>
  );
}

function HeroFlankVideo({
  slot,
  src,
  tilt,
  sway,
  delay,
}: {
  slot: 'left' | 'right';
  src: string;
  tilt: number;
  sway: 'lg' | 'md';
  delay: number;
}) {
  return (
    <div
      aria-hidden={!src}
      className={cn(
        'pointer-events-none absolute top-[42%] hidden w-[min(26vw,300px)] lg:block',
        slot === 'left' ? 'left-[1.5%] xl:left-[3%]' : 'right-[1.5%] xl:right-[3%]',
      )}
      style={{ transform: `translateY(-50%) rotate(${tilt}deg)` }}
    >
      <div
        className="will-change-transform"
        style={{
          animationName: `pointerFloat${sway.toUpperCase()}`,
          animationDuration: sway === 'lg' ? '26s' : '28s',
          animationDelay: `${delay}s`,
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        }}
      >
        <LandingVideoFrame
          src={src}
          label={slot === 'left' ? 'Feature loop A' : 'Feature loop B'}
          className="rounded-xl opacity-[0.42] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.85)]"
        />
      </div>
    </div>
  );
}

function BackedByPlaceholder() {
  return (
    <div
      className={cn(
        'flex h-10 w-44 items-center justify-center rounded-md border border-dashed border-border-subtle/80',
        'bg-bg-raised/30 backdrop-blur-sm',
      )}
      title="Backed-by logo placeholder"
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-fg-muted/60">
        partner soon
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Product video frame — animated gradient blocks behind, big 16:9 placeholder
 * (drops a real /landing/hero-loop.mp4 in when NEXT_PUBLIC_LANDING_HERO_VIDEO_URL is set)
 * ------------------------------------------------------------------------- */
function ProductVideoFrame() {
  return (
    <div className="relative">
      <LandingVideoFrame
        src={HERO_VIDEO_SRC}
        label="Product loop"
        className="rounded-3xl shadow-[0_60px_120px_-40px_rgba(0,0,0,0.85)]"
        frameClassName="rounded-3xl"
      />
    </div>
  );
}

function LandingVideoFrame({
  src,
  label,
  className,
  frameClassName,
}: {
  src: string;
  label: string;
  className?: string;
  frameClassName?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden border border-border-strong/80 bg-bg-raised/85 backdrop-blur-sm',
        className,
      )}
    >
      <div className={cn('relative aspect-video min-h-[min(52vh,560px)] w-full', frameClassName)}>
        {src ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- decorative product loop
          <video
            src={src}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <VideoPlaceholderInner label={label} />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.05]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-base/40 to-transparent"
        />
      </div>
    </div>
  );
}

function VideoPlaceholderInner({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,rgb(var(--bg-sunken-rgb))_0%,rgb(var(--bg-base-rgb))_100%)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
      <img
        src="/branding/pointer-bird.png"
        alt=""
        width={40}
        height={40}
        className="h-10 w-auto opacity-45"
        draggable={false}
      />
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-fg-muted/80">
          {label}
        </span>
        <span className="text-[10px] text-fg-muted/50">coming soon</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Section heading — eyebrow + balanced H2 (no subhead by default; keep tight)
 * ------------------------------------------------------------------------- */
function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-glow/85 sm:text-xs">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-balance text-[36px] font-semibold leading-[1.08] tracking-tight sm:text-[48px] md:text-[56px]">
        {title}
      </h2>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Feature tabs
 * ------------------------------------------------------------------------- */
function FeatureTabSwitcher({
  activeTab,
  onChange,
}: {
  activeTab: FeatureTabId;
  onChange: (id: FeatureTabId) => void;
}) {
  return (
    <div className="mt-12 border-t border-border-subtle pt-8 sm:mt-16 sm:pt-10">
      <div className="grid w-full grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 sm:gap-x-10">
      {FEATURE_TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'group/tab relative flex flex-col items-center gap-2 px-2 pb-2 text-center transition-colors',
              active ? 'text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            <span
              className={cn(
                'absolute -top-8 left-0 right-0 h-0.5 rounded-full transition-colors sm:-top-10',
                active ? 'bg-fg-primary' : 'bg-border-subtle/50 group-hover/tab:bg-border-default',
              )}
            />
            <span className="text-[15px] font-semibold tracking-tight sm:text-[17px]">{tab.subtitle}</span>
            <span className="max-w-[12rem] text-[12px] leading-snug text-fg-muted sm:text-[13px]">{tab.tagline}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function FeatureTabPanel({ activeTab }: { activeTab: FeatureTabId }) {
  const tab = useMemo(
    () => FEATURE_TABS.find((t) => t.id === activeTab) ?? FEATURE_TABS[0]!,
    [activeTab],
  );
  return (
    <div className="relative">
      <div className="grid min-h-[min(780px,72vh)] gap-6 lg:grid-cols-[1.12fr_0.88fr] lg:items-stretch">
        <article
          key={tab.id}
          className="relative flex min-h-[520px] flex-col overflow-hidden rounded-3xl border border-border-strong bg-bg-raised/90 p-6 text-left shadow-[0_40px_80px_-40px_rgba(0,0,0,0.75)] backdrop-blur-sm animate-in fade-in slide-in-from-bottom-1 duration-500 sm:p-8 lg:min-h-full lg:p-10"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-primary/40 bg-accent-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-glow">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              {tab.subtitle}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border-subtle bg-bg-sunken/60 px-3 py-1 text-[11px] font-medium text-fg-muted">
              Powered by {tab.poweredBy}
            </span>
          </div>
          <h3 className="mt-6 text-balance text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px] lg:text-[38px]">
            {tab.title}
          </h3>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-secondary sm:text-[17px] lg:text-[18px]">{tab.detail}</p>
          <div className="mt-auto flex min-h-[280px] flex-1 flex-col pt-8 sm:min-h-[320px]">
            <FeatureMockSwitch active={tab.id} />
          </div>
        </article>

        <aside className="flex flex-col gap-4 lg:gap-5">
          {tab.sideCards.map((c) => (
            <div
              key={c.label}
              className="group flex flex-1 flex-col justify-center rounded-3xl border border-border-subtle bg-bg-raised/55 p-6 backdrop-blur-sm transition-colors hover:border-accent-primary/40 sm:p-7"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[18px] font-semibold tracking-tight text-fg-primary sm:text-[20px]">
                  {c.label}
                </span>
                <ArrowUpRight
                  className="h-4 w-4 text-fg-muted transition-colors group-hover:text-accent-glow"
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-fg-secondary sm:text-[15px]">{c.sub}</p>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

function FeatureMockSwitch({ active }: { active: FeatureTabId }) {
  switch (active) {
    case 'pulse':
      return <PulsePreviewMock />;
    case 'desk':
      return <TokenDeskMock />;
    case 'copilot':
      return <CopilotMock />;
    case 'wallets':
      return <WalletIntelMock />;
  }
}

/* ----- Pulse preview mock (kept inside the tab card, not as hero) ----- */
function PulsePreviewMock() {
  const rows = [
    { sym: 'KISHU', name: 'kishu inu reborn', age: '34s', mc: '$3.4K', pct: 32 },
    { sym: 'WAGMI', name: 'we all gonna make it', age: '1m', mc: '$2.1K', pct: 18 },
    { sym: 'FOMO', name: 'fear of missing out', age: '2m', mc: '$1.7K', pct: -4 },
  ];
  return (
    <div className="h-full min-h-[240px] overflow-hidden rounded-2xl border border-border-subtle bg-bg-raised">
      <div className="flex items-center justify-between border-b border-border-subtle/60 bg-bg-sunken/60 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-signal-bull/30 bg-signal-bull/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-signal-bull">
          <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
          New
        </span>
        <span className="text-[12px] font-mono text-fg-muted">live</span>
      </div>
      <ul className="divide-y divide-border-subtle/40">
        {rows.map((r) => (
          <li key={r.sym} className="flex items-center gap-3 px-4 py-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-bg-sunken text-[11px] font-bold tracking-tight text-fg-secondary">
              {r.sym.slice(0, 3)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[15px] font-semibold tracking-tight text-fg-primary">
                  {r.sym}
                </span>
                <span className="truncate text-[13px] text-fg-muted">{r.name}</span>
              </div>
              <div className="mt-1 flex gap-3 text-[12px] tabular-nums text-fg-muted">
                <span>{r.age}</span>
                <span>MC {r.mc}</span>
              </div>
            </div>
            <span
              className={cn(
                'rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums',
                r.pct >= 0 ? 'bg-signal-bull/10 text-signal-bull' : 'bg-signal-bear/10 text-signal-bear',
              )}
            >
              {r.pct >= 0 ? '+' : ''}
              {r.pct}%
            </span>
            <button
              type="button"
              className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full border border-accent-primary/40 bg-accent-primary/10 px-3 text-[12px] font-semibold tracking-tight text-accent-glow transition-colors hover:bg-accent-primary/20"
            >
              <Zap className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              .01
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TokenDeskMock() {
  return (
    <div className="grid gap-3 overflow-hidden rounded-xl border border-border-subtle bg-bg-raised p-3 sm:grid-cols-[1.3fr_1fr]">
      <div className="rounded-lg border border-border-subtle bg-bg-sunken/60 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-semibold tracking-tight text-fg-primary">
              $KISHU / USD
            </span>
            <span className="text-[10px] text-fg-muted">5m</span>
          </div>
          <span className="rounded-md bg-signal-bull/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-signal-bull">
            +32.41%
          </span>
        </div>
        <SparklineGlow />
        <div className="mt-2 flex items-center gap-2 text-[10px] tabular-nums text-fg-muted">
          <span>O <span className="text-fg-secondary">$0.0041</span></span>
          <span>H <span className="text-fg-secondary">$0.0058</span></span>
          <span>L <span className="text-fg-secondary">$0.0039</span></span>
          <span>C <span className="text-signal-bull">$0.0054</span></span>
        </div>
      </div>
      <div className="rounded-lg border border-border-subtle bg-bg-sunken/60 p-2">
        <div className="flex items-center justify-between px-1 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
            Trades
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-fg-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal-bull" /> live
          </span>
        </div>
        <ul className="divide-y divide-border-subtle/40 font-mono text-[11px] tabular-nums">
          {[
            { who: 'sanu...x4F', side: 'buy', sol: '0.42', usd: '$88.20' },
            { who: 'apex...mD2', side: 'sell', sol: '1.18', usd: '$247.80' },
            { who: 'quan...8jR', side: 'buy', sol: '0.21', usd: '$44.10' },
            { who: 'frog...kPP', side: 'buy', sol: '0.08', usd: '$16.80' },
          ].map((t, i) => {
            const buy = t.side === 'buy';
            return (
              <li key={i} className="flex items-center gap-2 py-1.5">
                <span
                  className={cn(
                    'w-9 shrink-0 text-[10px] font-semibold uppercase',
                    buy ? 'text-signal-bull' : 'text-signal-bear',
                  )}
                >
                  {t.side}
                </span>
                <span className="text-fg-secondary">{t.who}</span>
                <span className="ml-auto text-fg-primary">{t.sol} SOL</span>
                <span className="w-14 text-right text-fg-muted">{t.usd}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SparklineGlow() {
  return (
    <svg className="mt-2 w-full" viewBox="0 0 320 80" preserveAspectRatio="none" height={80}>
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--signal-bull-rgb) / 0.45)" />
          <stop offset="100%" stopColor="rgb(var(--signal-bull-rgb) / 0)" />
        </linearGradient>
      </defs>
      <path
        d="M0 60 L20 55 L40 58 L60 50 L80 52 L100 42 L120 38 L140 44 L160 30 L180 24 L200 28 L220 18 L240 22 L260 14 L280 18 L300 8 L320 12 L320 80 L0 80 Z"
        fill="url(#sparkfill)"
      />
      <path
        d="M0 60 L20 55 L40 58 L60 50 L80 52 L100 42 L120 38 L140 44 L160 30 L180 24 L200 28 L220 18 L240 22 L260 14 L280 18 L300 8 L320 12"
        fill="none"
        stroke="rgb(var(--signal-bull-rgb))"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CopilotMock() {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-raised">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-bg-sunken/60 px-3 py-2">
        <Bot className="h-3.5 w-3.5 text-accent-glow" strokeWidth={2} aria-hidden />
        <span className="text-[11px] font-semibold tracking-tight text-fg-primary">
          Co-pilot · $KISHU
        </span>
        <span className="ml-auto text-[10px] font-mono text-fg-muted">/ to focus</span>
      </div>
      <div className="space-y-2 p-3 text-[12px] leading-relaxed">
        <div className="flex justify-end">
          <span className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent-primary/15 px-3 py-1.5 text-fg-primary">
            Why is this dumping?
          </span>
        </div>
        <div className="flex">
          <span className="max-w-[88%] rounded-2xl rounded-bl-sm border border-border-subtle bg-bg-sunken/60 px-3 py-2 text-fg-secondary">
            Two tracked KOL wallets sold{' '}
            <span className="font-semibold text-fg-primary">$31.4k</span> in the last 4 minutes. Dev
            still holds 4.2%. Liquidity unchanged.{' '}
            <span className="text-accent-glow">Show top sellers →</span>
          </span>
        </div>
        <div className="flex">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-sunken/60 px-2.5 py-1 text-[10px] text-fg-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-glow" /> Thinking…
          </span>
        </div>
      </div>
    </div>
  );
}

function WalletIntelMock() {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-raised">
      <div className="flex items-start gap-3 border-b border-border-subtle bg-bg-sunken/60 p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-base text-[11px] font-bold text-fg-secondary">
          SA
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-semibold tracking-tight text-fg-primary">sanuxo</span>
            <span className="rounded border border-accent-primary/40 bg-accent-primary/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-accent-glow">
              KOL
            </span>
            <span className="rounded border border-signal-bull/40 bg-signal-bull/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-signal-bull">
              Smart
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-fg-muted">9WzDXw…AWWM</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 text-[11px]">
        {[
          { k: '7D PnL', v: '+$28.4k', tone: 'bull' as const },
          { k: '30D PnL', v: '+$54.1k', tone: 'bull' as const },
          { k: '7D tokens', v: '23' },
          { k: 'Win rate', v: '64%' },
          { k: 'Tracked by', v: '186' },
          { k: 'Rolling volume', v: '$2.1M' },
        ].map((row) => (
          <div
            key={row.k}
            className="flex items-baseline justify-between border-b border-border-subtle/40 pb-1.5"
          >
            <span className="text-fg-muted">{row.k}</span>
            <span
              className={cn(
                'font-semibold tabular-nums text-fg-primary',
                row.tone === 'bull' && 'text-signal-bull',
              )}
            >
              {row.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Integrations strip
 * ------------------------------------------------------------------------- */
function IntegrationsStrip() {
  return (
    <div className="mt-12 rounded-3xl border border-border-subtle bg-bg-raised/55 p-8 backdrop-blur-sm sm:mt-14 sm:p-10">
      <div className="grid grid-cols-3 items-center gap-6 sm:grid-cols-4 md:grid-cols-6">
        {INTEGRATIONS.map((logo) => (
          <div
            key={logo.alt}
            className="flex h-16 items-center justify-center rounded-xl border border-transparent bg-bg-sunken/40 px-4 transition-colors hover:border-accent-primary/30 sm:h-[4.5rem]"
            title={logo.alt}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static protocol mark */}
            <img
              src={logo.src}
              alt={logo.alt}
              className="max-h-9 max-w-[130px] object-contain opacity-70 transition-opacity hover:opacity-95 sm:max-h-10"
              draggable={false}
              loading="lazy"
              onError={(e) => {
                if (logo.fallback) {
                  (e.target as HTMLImageElement).src = logo.fallback;
                } else {
                  (e.target as HTMLImageElement).style.display = 'none';
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Architecture
 * ------------------------------------------------------------------------- */
function ArchitectureSection() {
  return (
    <div>
      <SectionHeading
        eyebrow="Architecture"
        title={
          <>
            Non-custodial.{' '}
            <span className="bg-gradient-to-b from-accent-glow to-accent-primary bg-clip-text text-transparent">
              Honest by design.
            </span>
          </>
        }
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-2 lg:gap-6">
        <ArchitectureCard
          icon={ShieldCheck}
          title="Non-custodial wallet"
          body="Privy + Turnkey-style key management. Link your own Phantom, Solflare, or Backpack at any time."
          callout={['Embedded · Phantom · Solflare · Backpack', 'Privy session, no password ever asked']}
        />
        <ArchitectureCard
          icon={Layers}
          title="Integrations layer"
          body="Pulse and the desk pull from Helius, DexScreener, Jupiter, GeckoTerminal, and the launchpad webhooks directly. Zero filler."
          callout={['Helius DAS · webhooks', 'DexScreener spot + history', 'Jupiter swaps + price API']}
        />
      </div>
    </div>
  );
}

function ArchitectureCard({
  icon: Icon,
  title,
  body,
  callout,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
  callout: string[];
}) {
  return (
    <article className="relative overflow-hidden rounded-3xl border border-border-subtle bg-bg-raised/65 p-8 backdrop-blur-sm sm:p-10">
      <Icon className="h-6 w-6 text-accent-glow" strokeWidth={1.75} aria-hidden />
      <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-fg-primary sm:text-[24px]">{title}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-fg-secondary sm:text-[16px]">{body}</p>
      <ul className="mt-5 space-y-2 text-[13px] text-fg-muted sm:text-[14px]">
        {callout.map((c) => (
          <li key={c} className="flex items-center gap-2">
            <span className="h-1 w-1 shrink-0 rounded-full bg-accent-glow" />
            {c}
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ---------------------------------------------------------------------------
 * FAQ
 * ------------------------------------------------------------------------- */
function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <div className="mt-10 divide-y divide-border-subtle overflow-hidden rounded-2xl border border-border-subtle bg-bg-raised/55 backdrop-blur-sm">
      {FAQ_ITEMS.map((item, i) => {
        const open = openIdx === i;
        return (
          <button
            key={item.q}
            type="button"
            onClick={() => setOpenIdx(open ? null : i)}
            aria-expanded={open}
            className="block w-full px-5 py-4 text-left transition-colors hover:bg-bg-hover/40"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-[14px] font-semibold tracking-tight text-fg-primary">
                {item.q}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-fg-muted transition-transform',
                  open && 'rotate-180 text-accent-glow',
                )}
                strokeWidth={2}
                aria-hidden
              />
            </div>
            {open ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-fg-secondary animate-in fade-in slide-in-from-top-1 duration-200">
                {item.a}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Final CTA
 * ------------------------------------------------------------------------- */
function FinalCta({
  onPrimary,
  ctaLabel,
  ready,
}: {
  onPrimary: () => void;
  ctaLabel: string;
  ready: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border-strong bg-bg-raised/85 px-6 py-14 text-center backdrop-blur-sm sm:px-12 sm:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(var(--accent-primary-rgb)/0.06)_0%,transparent_55%)]" />
      <h2 className="text-balance text-[26px] font-semibold leading-tight tracking-tight sm:text-[36px]">
        Open pointer.{' '}
        <span className="bg-gradient-to-b from-accent-glow to-accent-primary bg-clip-text text-transparent">
          Trade smarter.
        </span>
      </h2>
      <div className="mt-7 flex items-center justify-center">
        <button
          type="button"
          onClick={onPrimary}
          disabled={!ready}
          className={cn(
            'btn-press focus-ring group/cta inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-[15px] font-semibold text-fg-inverse',
            'bg-gradient-to-b from-accent-glow to-accent-primary',
            'shadow-[0_14px_40px_-12px_rgb(var(--accent-primary-rgb)/0.8),inset_0_1px_0_rgb(255_255_255/0.2)]',
            'transition-[transform,filter,box-shadow] hover:brightness-110 hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {ctaLabel}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover/cta:translate-x-0.5"
            strokeWidth={2.5}
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Footer
 * ------------------------------------------------------------------------- */
function LandingFooter() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-[88rem] border-t border-border-subtle px-6 py-8 sm:px-10 sm:py-10">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <span className="flex items-center gap-2 text-[12px] text-fg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img
            src="/branding/pointer-bird.png"
            alt=""
            width={18}
            height={18}
            className="h-4 w-auto opacity-80"
            draggable={false}
          />
          <span className="font-semibold text-fg-secondary">pointer.</span>
          <span className="text-fg-muted/70">© 2026 {APP_NAME}. All rights reserved.</span>
        </span>
        <div className="flex items-center gap-5 text-[13px] font-medium text-fg-secondary">
          <Link href="/pulse" prefetch className="transition-colors hover:text-fg-primary">
            Docs
          </Link>
          <a
            href="https://x.com"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-fg-primary"
            aria-label="X (Twitter)"
          >
            X
          </a>
          <a
            href="https://discord.com"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-fg-primary"
          >
            Discord
          </a>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-3 text-[11px] text-fg-muted/70">
        <span className="cursor-default">Privacy Policy</span>
        <span aria-hidden>·</span>
        <span className="cursor-default">Terms of Service</span>
      </div>
    </footer>
  );
}
