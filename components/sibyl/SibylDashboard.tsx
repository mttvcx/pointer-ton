'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SibylAnswer } from '@/sibyl/types';
import { SibylAnswerView } from '@/components/sibyl/SibylAnswerView';
import { sibylSerif } from '@/components/sibyl/fonts';

type Msg = { id: string; role: 'user' | 'sibyl'; text?: string; answer?: SibylAnswer };
type Plan = { tier: string; label: string; price: number; maxMode: string };
type ThemeChoice = 'system' | 'light' | 'dark';

const DELEGATIONS = [
  'Scan this token for rug risk — paste a CA',
  'Which KOLs are holding this, and who’s still in?',
  'Is this wallet smart money? Paste an address',
  'Freshest narrative under $20M — and who started it',
  'Compare Axiom vs Photon fees this week',
  'Is Ansem in this?',
];

const MODELS = [
  { id: 'sibyl-7', name: 'Sibyl 7.0', note: 'Flagship — full specialist fan-out', locked: false },
  { id: 'sibyl-7-pro', name: 'Sibyl 7.0 Pro', note: 'Deeper scans, adversarial verify', locked: true },
  { id: 'sibyl-deep', name: 'Sibyl Deep Research', note: 'Long-horizon, many sources', locked: true },
  { id: 'sibyl-fast', name: 'Sibyl Flash', note: 'Sub-second hover facts', locked: true },
];

const ECOSYSTEM = [
  { label: 'pointer.trade', href: 'https://pointer.trade' },
  { label: 'Financial', href: 'https://pointer.trade' },
  { label: 'Mobile', href: 'https://pointer.trade' },
  { label: 'Extension', href: 'https://pointer.trade' },
];

/** Contextual thinking plan from the raw query — drives the live trace (never names a model). */
type ThinkPlan = { title: string; searched?: string; steps: string[]; sources: string[] };
function planFor(raw: string): ThinkPlan {
  const q = (raw || '').trim();
  const isMint = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);
  const ticker = q.match(/\$([A-Za-z][A-Za-z0-9]{1,9})/)?.[1]?.toUpperCase();
  const terminal = q.match(/axiom|photon|bullx|trojan|gmgn|fomo/i)?.[0];
  const isFees = /\bfees?\b|\bvs\b|versus|compare|volume|market share|terminal|leaderboard/i.test(q) || (!!terminal && !isMint);
  const person = q.match(/\bis\s+([a-z0-9_]{2,20})\s+(?:in|holding)/i)?.[1] || q.match(/@([a-z0-9_]{2,20})/i)?.[1] || (/\bansem\b/i.test(q) ? 'ansem' : null);
  const isNarrative = /\bnarrative\b|\bmeta\b|\bstory\b|why is|trend(ing)?\b/i.test(q);

  if (isMint || ticker) {
    return {
      title: `Analyzing ${ticker ? `$${ticker}` : 'the token'}`,
      steps: ['Reading your request', 'Pulling price, MC & liquidity', 'Resolving top holders on-chain', 'Labeling wallets against the Pointer registry', 'Reading CT social velocity', 'Grading rug risk', 'Weighing the verdict'],
      sources: ['DexScreener', 'Helius', 'Pointer registry', 'CT'],
    };
  }
  if (isFees) {
    const subj = terminal ? terminal[0]!.toUpperCase() + terminal.slice(1).toLowerCase() : 'the terminals';
    return {
      title: 'Searching terminal stats',
      searched: `${subj} fees, volume & market share`,
      steps: ['Reading your request', 'Searching terminal dashboards', 'Pulling fees & volume', 'Comparing market share', 'Weighing the verdict'],
      sources: ['Dune', 'Pointer registry'],
    };
  }
  if (person) {
    return {
      title: `Checking if @${person} is in it`,
      steps: ['Reading your request', `Resolving @${person} in the KOL directory`, 'Scanning wallets in the trade', 'Cross-referencing holdings', 'Weighing the verdict'],
      sources: ['Pointer registry', 'Helius'],
    };
  }
  if (isNarrative) {
    return {
      title: 'Tracing the narrative',
      steps: ['Reading your request', 'Tracing the narrative origin', 'Measuring spread across X / TikTok / news', 'Judging early vs late', 'Weighing the verdict'],
      sources: ['CT', 'Search', 'Pointer registry'],
    };
  }
  return {
    title: 'Working on it',
    steps: ['Reading your request', 'Routing to the right specialists', 'Pulling live data', 'Weighing the verdict'],
    sources: ['DexScreener', 'Pointer registry'],
  };
}

const THEME_VARS: Record<'light' | 'dark', Record<string, string>> = {
  dark: {
    '--s-bg': '#0b0b0e',
    '--s-fg': '#f4f4f5',
    '--s-muted': 'rgba(244,244,245,0.58)',
    '--s-faint': 'rgba(244,244,245,0.36)',
    '--s-panel': 'rgba(255,255,255,0.04)',
    '--s-panel-2': 'rgba(255,255,255,0.08)',
    '--s-border': 'rgba(255,255,255,0.1)',
    '--s-glass': 'rgba(18,18,23,0.55)',
    '--s-accent': '#a5a0ff',
  },
  light: {
    '--s-bg': '#f4f4f6',
    '--s-fg': '#17171b',
    '--s-muted': 'rgba(23,23,27,0.6)',
    '--s-faint': 'rgba(23,23,27,0.42)',
    '--s-panel': 'rgba(0,0,0,0.03)',
    '--s-panel-2': 'rgba(0,0,0,0.05)',
    '--s-border': 'rgba(0,0,0,0.1)',
    '--s-glass': 'rgba(255,255,255,0.62)',
    '--s-accent': '#6a5cff',
  },
};

/* media-glass = the dark liquid glass used for chrome floating over the video. */
const SCOPE_CSS = `
.sibyl-mark{-webkit-mask:url(/sibyl/mark.png) center/contain no-repeat;mask:url(/sibyl/mark.png) center/contain no-repeat;background-color:currentColor;display:block}
.s-panel{background:var(--s-panel)}
.s-panel2{background:var(--s-panel-2)}
.s-glass{background:var(--s-glass);-webkit-backdrop-filter:blur(26px) saturate(1.4);backdrop-filter:blur(26px) saturate(1.4)}
.media-glass{background:rgba(16,16,21,0.5);-webkit-backdrop-filter:blur(26px) saturate(1.5);backdrop-filter:blur(26px) saturate(1.5);border:1px solid rgba(255,255,255,0.1)}
.s-border{border-color:var(--s-border)}
.s-fg{color:var(--s-fg)}
.s-muted{color:var(--s-muted)}
.s-faint{color:var(--s-faint)}
.s-accent{color:var(--s-accent)}
.h-fg:hover{color:var(--s-fg)}
.h-white:hover{color:#fff}
.h-panel2:hover{background:var(--s-panel-2)}
.h-wglass:hover{background:rgba(255,255,255,0.08)}
.group:hover .gh-accent{color:var(--s-accent)}
.ph-dim::placeholder{color:rgba(255,255,255,0.4)}
.ph-faint::placeholder{color:var(--s-faint)}
@keyframes sibylPixel{0%,100%{opacity:.1}50%{opacity:1}}
@keyframes sibylRise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.rise{animation:sibylRise .35s ease both}
.shimmer{background:linear-gradient(90deg,rgba(255,255,255,0.4) 20%,rgba(255,255,255,0.98) 50%,rgba(255,255,255,0.4) 80%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:sibylSweep 1.7s linear infinite}
@keyframes sibylSweep{to{background-position:-200% 0}}
.menu-glass{background:rgba(19,19,26,0.94);-webkit-backdrop-filter:blur(18px) saturate(1.2);backdrop-filter:blur(18px) saturate(1.2);border:1px solid rgba(255,255,255,0.1)}
.pop{animation:sibylPop .16s cubic-bezier(.2,.9,.3,1) both}
@keyframes sibylPop{from{opacity:0;transform:scale(.96) translateY(6px)}to{opacity:1;transform:none}}
`;

let seq = 0;
const nid = () => `m${seq++}`;

/* --------------------------------- icons ---------------------------------- */
const I = (p: { d: string; className?: string; fill?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className ?? 'h-[18px] w-[18px]'} fill={p.fill ?? 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={p.d} />
  </svg>
);
const IconPlus = () => <I d="M12 5v14M5 12h14" />;
const IconArrow = () => <I d="M5 12h14M13 6l6 6-6 6" className="h-[17px] w-[17px]" />;
const IconGear = () => (
  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IconUpgrade = () => <I d="M12 19V6M5 12l7-7 7 7" className="h-[15px] w-[15px]" />;
const IconUser = () => <I d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" className="h-[15px] w-[15px]" />;
const IconMic = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
const IconUpload = () => <I d="M12 15V3m0 0L8 7m4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" className="h-[15px] w-[15px]" />;
const IconPlug = () => <I d="M9 2v6m6-6v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5" className="h-[15px] w-[15px]" />;
const IconFolder = () => <I d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" className="h-[15px] w-[15px]" />;

/* Live, contextual "thinking" trace shown while a scan runs — never names a model. */
function ThinkingTrace({ query }: { query: string }) {
  const plan = useMemo(() => planFor(query), [query]);
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const t = setInterval(() => setI((v) => Math.min(v + 1, plan.steps.length - 1)), 720);
    return () => clearInterval(t);
  }, [plan]);
  const activeSources = Math.max(1, Math.ceil(((i + 1) / plan.steps.length) * plan.sources.length));
  return (
    <div className="media-glass rise flex w-full max-w-[560px] flex-col gap-2.5 rounded-2xl px-4 py-3.5 text-white">
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-4 animate-spin rounded-full border-[1.6px] border-white/25 border-t-white/85" />
        <span className="shimmer text-[13px] font-medium">{plan.title}…</span>
      </div>

      {plan.searched ? (
        <div className="flex items-center gap-1.5 text-[11.5px] text-white/50">
          <I d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" className="h-3.5 w-3.5" />
          Searched <span className="text-white/75">{plan.searched}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {plan.sources.map((s, k) => (
          <span
            key={s}
            className={`rounded-full border px-2 py-0.5 text-[10.5px] transition-all duration-500 ${k < activeSources ? 'border-white/20 bg-white/10 text-white/85' : 'border-white/5 text-white/25'}`}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="space-y-1 pt-0.5">
        {plan.steps.slice(0, i + 1).map((s, k) => (
          <div key={s} className="rise flex items-center gap-2 text-[12px]">
            {k < i ? (
              <span className="text-emerald-400">
                <I d="M20 6 9 17l-5-5" className="h-3.5 w-3.5" />
              </span>
            ) : (
              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/25 border-t-white/80" />
            )}
            <span className={k < i ? 'text-white/45' : 'text-white/85'}>{s}…</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Voice-mode overlay: white pulse rippling outward through a pixel grid. */
function VoicePulse({ onClose }: { onClose: () => void }) {
  const cols = 56;
  const rows = 4;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxD = Math.hypot(cx, cy);
  return (
    <div className="media-glass mx-auto flex max-w-[760px] items-center gap-4 rounded-2xl px-4 py-3.5 text-white">
      <span className="sibyl-mark h-5 w-5 text-white" />
      <div className="flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden py-2" aria-hidden>
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="flex flex-1 flex-col gap-[3px]">
            {Array.from({ length: rows }).map((__, r) => {
              const d = Math.hypot(c - cx, r - cy);
              return <span key={r} className="h-[3px] w-full rounded-[1px] bg-white" style={{ animation: 'sibylPixel 1.5s ease-in-out infinite', animationDelay: `${(d / maxD) * 0.9}s`, opacity: 0.1 }} />;
            })}
          </div>
        ))}
      </div>
      <span className="whitespace-nowrap text-[12px] text-white/60">Listening…</span>
      <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[13px] text-white transition hover:bg-white/20">✕</button>
    </div>
  );
}

export function SibylDashboard() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ modelMock: boolean; liveProviders: number; memory: { scans: number; entities: number; resolved: number } | null } | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [menu, setMenu] = useState<null | 'model' | 'settings' | 'upgrade' | 'plus' | 'plan'>(null);
  const [theme, setTheme] = useState<ThemeChoice>('dark');
  const [systemDark, setSystemDark] = useState(true);
  const [voice, setVoice] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [videoMounted, setVideoMounted] = useState(true);

  useEffect(() => {
    // Some browsers need an explicit play() even for muted autoplay.
    videoRef.current?.play().catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/sibyl/status')
      .then((r) => r.json())
      .then((d) => {
        setStatus({ modelMock: Boolean(d.modelMock), liveProviders: Number(d.liveProviders ?? 0), memory: d.memory ?? null });
        setPlans(Array.isArray(d.plans) ? d.plans : []);
      })
      .catch(() => {});
    const saved = (typeof localStorage !== 'undefined' && (localStorage.getItem('sibyl-theme') as ThemeChoice)) || 'dark';
    setTheme(saved);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const effectiveDark = theme === 'system' ? systemDark : theme === 'dark';
  const vars = effectiveDark ? THEME_VARS.dark : THEME_VARS.light;
  const started = messages.length > 0 || loading;

  useEffect(() => {
    if (started) {
      const t = setTimeout(() => setVideoMounted(false), 1200); // fully remove after the fade
      return () => clearTimeout(t);
    }
    setVideoMounted(true); // back to empty state → bring it back
    return undefined;
  }, [started]);

  // Close any open popover on an outside click (capture phase → reliable).
  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('.menu-glass') || t.closest('[data-menu-trigger]'))) return;
      setMenu(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [menu]);

  const setThemeChoice = (t: ThemeChoice) => {
    setTheme(t);
    try {
      localStorage.setItem('sibyl-theme', t);
    } catch {
      /* ignore */
    }
  };

  const send = async (q: string) => {
    const query = q.trim();
    if (!query || loading) return;
    setInput('');
    setVoice(false);
    setAttachment(null);
    setMessages((m) => [...m, { id: nid(), role: 'user', text: query }]);
    setLoading(true);
    try {
      const res = await fetch('/api/sibyl/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const data = (await res.json()) as { answer?: SibylAnswer };
      setMessages((m) => [...m, data.answer ? { id: nid(), role: 'sibyl', answer: data.answer } : { id: nid(), role: 'sibyl', text: 'Sibyl hit an error. Try again.' }]);
    } catch {
      setMessages((m) => [...m, { id: nid(), role: 'sibyl', text: 'Network error.' }]);
    } finally {
      setLoading(false);
    }
  };

  const scans = useMemo(() => messages.filter((m) => m.role === 'user'), [messages]);
  const statusLine = status == null ? '' : status.modelMock ? `${status.liveProviders} live data · mock model` : `${status.liveProviders} providers live`;

  return (
    <div className="sibyl-scope fixed inset-0 overflow-hidden antialiased" style={{ ...vars } as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: SCOPE_CSS }} />

      {/* base + ambient video (fades out + unmounts once a scan starts) */}
      <div className="absolute inset-0" style={{ background: 'var(--s-bg)' }} aria-hidden />
      {videoMounted ? (
        <>
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: started ? 0 : 1, transition: 'opacity 1100ms ease-out', pointerEvents: 'none' }}
            src="/sibyl/background.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden
          />
          <div className="absolute inset-0" style={{ opacity: started ? 0 : 1, transition: 'opacity 1100ms ease-out', pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.12) 32%, rgba(0,0,0,0.5) 100%)' }} aria-hidden />
        </>
      ) : null}

      <div className="relative z-10 flex h-full">
        {/* LEFT — sidebar */}
        <aside className="s-glass s-border hidden w-[250px] shrink-0 flex-col border-r p-3.5 text-white md:flex">
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <span className="sibyl-mark s-accent h-7 w-7" />
            <div className="leading-none">
              <div className={`${sibylSerif.className} text-[18px] leading-none text-white`}>Sibyl</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-white/45">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span>powered by</span>
                <img src="/branding/pointer-bird-transparent.png" alt="" className="h-2.5 w-2.5 object-contain opacity-80" />
                <span className="font-semibold tracking-tight text-white/80">pointer.</span>
              </div>
            </div>
          </div>

          <button type="button" onClick={() => setMessages([])} className="mt-3.5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] py-2 pl-3 text-[12.5px] font-medium text-white/90 transition hover:bg-white/[0.09]">
            <IconPlus /> New chat
          </button>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">History</div>
            {scans.length === 0 ? (
              <div className="px-1 py-1 text-[11px] text-white/35">No history yet.</div>
            ) : (
              scans.slice().reverse().map((s) => (
                <button key={s.id} type="button" onClick={() => send(s.text!)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-[12px] text-white/55 transition hover:bg-white/[0.06] hover:text-white/90">
                  {s.text}
                </button>
              ))
            )}
          </div>

          <div className="relative mt-2 space-y-1.5 border-t border-white/[0.08] pt-3">
            {menu === 'settings' ? (
              <div className="menu-glass pop absolute bottom-[calc(100%+8px)] left-0 w-full space-y-2.5 rounded-xl p-3 shadow-2xl">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">Appearance</div>
                <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-white/[0.06] p-0.5">
                  {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
                    <button key={t} type="button" onClick={() => setThemeChoice(t)} className={`rounded-md py-1 text-[11px] font-medium capitalize transition ${theme === t ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <button type="button" className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-[12px] text-white/85 transition hover:text-white">
                  <IconUser /> Sign in
                </button>
                <div className="flex items-center gap-1.5 border-t border-white/[0.08] pt-2 text-[10px] text-white/40">
                  <span className={`h-1.5 w-1.5 rounded-full ${status?.modelMock === false ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {statusLine}
                </div>
                {status?.memory ? <div className="text-[10px] text-white/40">{status.memory.scans.toLocaleString()} scans · {status.memory.entities.toLocaleString()} remembered · {status.memory.resolved.toLocaleString()} graded</div> : null}
              </div>
            ) : null}
            {menu === 'upgrade' ? (
              <div className="menu-glass pop absolute bottom-[calc(100%+8px)] left-0 w-full space-y-1 rounded-xl p-2.5 shadow-2xl">
                {plans.map((p) => (
                  <div key={p.tier} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px]">
                    <span className="font-medium text-white">{p.label}</span>
                    <span className="tabular-nums text-white/55">{p.price === 0 ? 'Free' : `$${p.price}/mo`}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <button type="button" data-menu-trigger onClick={() => setMenu(menu === 'upgrade' ? null : 'upgrade')} className="s-accent flex w-full items-center justify-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.04] py-2 text-[12px] font-medium transition hover:bg-white/[0.08]">
              <IconUpgrade /> Upgrade plan
            </button>

            <button type="button" data-menu-trigger onClick={() => setMenu(menu === 'settings' ? null : 'settings')} className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition hover:bg-white/[0.06]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70">
                <IconUser />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[12.5px] font-medium text-white">Guest</div>
                <div className="text-[10px] text-white/40">Free plan · settings</div>
              </div>
              <span className="text-white/40">
                <IconGear />
              </span>
            </button>
          </div>
        </aside>

        {/* CENTER — top bar + chat + input */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* top bar: plan + ecosystem */}
          <div className="flex items-center justify-between px-4 py-2.5 text-white md:px-8">
            <div className="relative">
              <button type="button" data-menu-trigger onClick={() => setMenu(menu === 'plan' ? null : 'plan')} className="media-glass rounded-full px-3 py-1.5 text-[11.5px] font-medium text-white/85 transition hover:text-white">
                Free plan · <span className="s-accent">Upgrade</span>
              </button>
              {menu === 'plan' ? (
                <div className="menu-glass pop absolute left-0 top-[calc(100%+6px)] w-[220px] space-y-1 rounded-xl p-2.5 shadow-2xl">
                  {plans.map((p) => (
                    <div key={p.tier} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px]">
                      <span className="font-medium text-white">{p.label}</span>
                      <span className="tabular-nums text-white/55">{p.price === 0 ? 'Free' : `$${p.price}/mo`}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <nav className="flex items-center gap-1">
              {ECOSYSTEM.map((e, k) => (
                <a key={e.label} href={e.href} target="_blank" rel="noreferrer" className={`rounded-full px-3 py-1.5 text-[12px] transition hover:bg-white/10 ${k === 0 ? 'font-medium text-white' : 'text-white/60 hover:text-white'}`}>
                  {e.label}
                </a>
              ))}
            </nav>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-10">
            <div className="mx-auto flex max-w-[760px] flex-col gap-6">
              {messages.length === 0 && !loading ? (
                <div className="mt-[10vh] text-center text-white">
                  <span className="sibyl-mark mx-auto mb-6 h-14 w-14 text-white/95 drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]" />
                  <h1 className={`${sibylSerif.className} text-[46px] leading-[1.05] tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)]`}>Delegate any crypto question.</h1>
                  <p className="mx-auto mt-3 max-w-[440px] text-[13.5px] leading-relaxed text-white/70 drop-shadow-[0_1px_12px_rgba(0,0,0,0.5)]">
                    Tokens, wallets, KOLs, narratives, terminal fees. Sibyl runs the specialists, pulls the chain + CT data, and comes back with a verdict.
                  </p>
                  <div className="mx-auto mt-8 grid max-w-[560px] grid-cols-1 gap-2 sm:grid-cols-2">
                    {DELEGATIONS.map((e) => (
                      <button key={e} type="button" onClick={() => send(e)} className="media-glass group rounded-xl px-3.5 py-2.5 text-left text-[12.5px] text-white/75 transition hover:text-white hover:bg-white/[0.06]">
                        <span className="mr-1.5 text-white/30 transition group-hover:text-[color:var(--s-accent)]">→</span>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="media-glass self-end rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px] text-white">
                    {m.text}
                  </div>
                ) : (
                  <div key={m.id} className="s-glass s-border s-fg rise rounded-2xl border p-5">
                    {m.answer ? <SibylAnswerView answer={m.answer} /> : <div className="s-muted text-[13px]">{m.text}</div>}
                  </div>
                ),
              )}
              {loading ? <ThinkingTrace query={scans.length ? (scans[scans.length - 1]!.text ?? '') : input} /> : null}
            </div>
          </div>

          {/* input / voice */}
          <div className="px-4 pb-6 pt-2 md:px-10">
            {voice ? (
              <VoicePulse onClose={() => setVoice(false)} />
            ) : (
              <div className="mx-auto max-w-[760px]">
                {attachment ? (
                  <div className="mb-2 flex w-fit items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] text-white/80">
                    <IconUpload /> {attachment}
                    <button type="button" onClick={() => setAttachment(null)} className="text-white/50 hover:text-white">✕</button>
                  </div>
                ) : null}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                  className="media-glass flex items-center gap-2 rounded-2xl px-2.5 py-2"
                >
                  {/* + menu */}
                  <div className="relative shrink-0">
                    <button type="button" data-menu-trigger onClick={() => setMenu(menu === 'plus' ? null : 'plus')} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white" title="Add files or tools">
                      <IconPlus />
                    </button>
                    {menu === 'plus' ? (
                      <div className="menu-glass pop absolute bottom-[calc(100%+8px)] left-0 w-[220px] space-y-0.5 rounded-xl p-1.5 shadow-2xl">
                        <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-white/85 transition hover:bg-white/[0.08]">
                          <IconUpload /> Upload files or images
                        </button>
                        <button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] text-white/85 transition hover:bg-white/[0.08]">
                          <span className="flex items-center gap-2.5"><IconPlug /> Connectors</span>
                          <span className="text-[9px] uppercase tracking-wide text-white/35">soon</span>
                        </button>
                        <button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] text-white/85 transition hover:bg-white/[0.08]">
                          <span className="flex items-center gap-2.5"><IconFolder /> Spaces</span>
                          <span className="text-[9px] uppercase tracking-wide text-white/35">soon</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*,.pdf,.csv,.txt" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? null)} />

                  {/* model selector */}
                  <div className="relative shrink-0">
                    <button type="button" data-menu-trigger onClick={() => setMenu(menu === 'model' ? null : 'model')} className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-white/10">
                      <span className="sibyl-mark s-accent h-3.5 w-3.5" />
                      Sibyl 7.0
                      <span className="text-[9px] text-white/40">▾</span>
                    </button>
                    {menu === 'model' ? (
                      <div className="menu-glass pop absolute bottom-[calc(100%+8px)] left-0 w-[236px] space-y-0.5 rounded-xl p-1.5 shadow-2xl">
                        {MODELS.map((mo) => (
                          <div key={mo.id} className={`flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 ${mo.locked ? 'opacity-55' : 'bg-white/[0.06]'}`}>
                            <div>
                              <div className="text-[12.5px] font-medium text-white">{mo.name}</div>
                              <div className="text-[10.5px] text-white/45">{mo.note}</div>
                            </div>
                            <span className="mt-0.5 text-white/40">{mo.locked ? <I d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM8 11V7a4 4 0 1 1 8 0v4" className="h-3 w-3" /> : <I d="M20 6 9 17l-5-5" className="h-3.5 w-3.5" />}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Analyze a token, wallet, KOL, or narrative — or paste a CA…"
                    className="ph-dim min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-white focus:outline-none"
                  />

                  <button type="button" onClick={() => setVoice(true)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white" title="Voice mode" aria-label="Voice mode">
                    <IconMic />
                  </button>

                  {input.trim() ? (
                    <button type="submit" disabled={loading} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40" style={{ background: 'var(--s-accent)' }} aria-label="Send">
                      <span className="text-black"><IconArrow /></span>
                    </button>
                  ) : null}
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
