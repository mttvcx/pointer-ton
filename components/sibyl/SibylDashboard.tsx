'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SibylAnswer } from '@/sibyl/types';
import { SibylAnswerView } from '@/components/sibyl/SibylAnswerView';
import { SibylUpgradeModal } from '@/components/sibyl/SibylUpgradeModal';
import { SibylSettingsModal } from '@/components/sibyl/SibylSettingsModal';
import { sibylSerif } from '@/components/sibyl/fonts';
import { clearChats, exportChats, getChat, importChats, listChats, newChatId, saveChat, type StoredChat, type StoredMsg } from '@/components/sibyl/chatStore';
import { usePointerAuth } from '@/lib/auth/pointerAuth';

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
    '--s-menu': 'rgba(20,20,27,0.96)',
    '--s-accent': '#a5a0ff',
  },
  light: {
    '--s-bg': '#f4f4f6',
    '--s-fg': '#17171b',
    '--s-muted': 'rgba(23,23,27,0.62)',
    '--s-faint': 'rgba(23,23,27,0.42)',
    '--s-panel': 'rgba(0,0,0,0.035)',
    '--s-panel-2': 'rgba(0,0,0,0.06)',
    '--s-border': 'rgba(0,0,0,0.12)',
    '--s-glass': 'rgba(255,255,255,0.72)',
    '--s-menu': 'rgba(255,255,255,0.98)',
    '--s-accent': '#6a5cff',
  },
};

/* media-glass = the dark liquid glass used for chrome floating over the video. */
const SCOPE_CSS = `
.sibyl-mark{-webkit-mask:url(/sibyl/mark.png) center/contain no-repeat;mask:url(/sibyl/mark.png) center/contain no-repeat;background-color:currentColor;display:block}
.s-panel{background:var(--s-panel)}
.s-panel2{background:var(--s-panel-2)}
.s-glass{background:var(--s-glass);-webkit-backdrop-filter:blur(26px) saturate(1.4);backdrop-filter:blur(26px) saturate(1.4)}
.media-glass{background:var(--s-glass);-webkit-backdrop-filter:blur(26px) saturate(1.5);backdrop-filter:blur(26px) saturate(1.5);border:1px solid var(--s-border)}
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
.ph-faint::placeholder{color:var(--s-faint)}
@keyframes sibylPixel{0%,100%{opacity:.1}50%{opacity:1}}
@keyframes sibylRise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.rise{animation:sibylRise .35s ease both}
.shimmer{background:linear-gradient(90deg,rgba(255,255,255,0.4) 20%,rgba(255,255,255,0.98) 50%,rgba(255,255,255,0.4) 80%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:sibylSweep 1.7s linear infinite}
@keyframes sibylSweep{to{background-position:-200% 0}}
.menu-glass{background:var(--s-menu);-webkit-backdrop-filter:blur(18px) saturate(1.2);backdrop-filter:blur(18px) saturate(1.2);border:1px solid var(--s-border)}
/* popover entrance — springs up from its trigger (origin set per-menu) */
.pop{animation:sibylPop .22s cubic-bezier(.16,1,.3,1) both}
@keyframes sibylPop{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:none}}
/* modal backdrop + panel */
.fade-in{animation:sibylFadeIn .3s ease both}
@keyframes sibylFadeIn{from{opacity:0}to{opacity:1}}
.modal-in{animation:sibylModalIn .36s cubic-bezier(.16,1,.3,1) both}
@keyframes sibylModalIn{from{opacity:0;transform:scale(.965) translateY(16px)}to{opacity:1;transform:none}}
/* staggered children — menu rows / plan cards cascade in */
.stagger>*{animation:sibylFadeUp .38s cubic-bezier(.2,.85,.25,1) both}
.stagger>*:nth-child(1){animation-delay:.03s}
.stagger>*:nth-child(2){animation-delay:.06s}
.stagger>*:nth-child(3){animation-delay:.09s}
.stagger>*:nth-child(4){animation-delay:.12s}
.stagger>*:nth-child(5){animation-delay:.15s}
.stagger>*:nth-child(6){animation-delay:.18s}
.stagger>*:nth-child(7){animation-delay:.21s}
.stagger>*:nth-child(8){animation-delay:.24s}
@keyframes sibylSlideIn{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}
.slide-in{animation:sibylSlideIn .42s cubic-bezier(.2,.8,.2,1) both}
@keyframes sibylFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.fade-up{animation:sibylFadeUp .55s cubic-bezier(.2,.8,.2,1) both}
/* voice — a ripple that blooms outward from the centre, on repeat */
@keyframes sibylWave{0%{opacity:.08;transform:scaleY(.5)}45%{opacity:1;transform:scaleY(1)}100%{opacity:.08;transform:scaleY(.5)}}
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
    <div className="media-glass rise flex w-full max-w-[560px] flex-col gap-2.5 rounded-2xl px-4 py-3.5 s-fg">
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-4 animate-spin rounded-full border-[1.6px] s-border border-t-white/85" />
        <span className="shimmer text-[13px] font-medium">{plan.title}…</span>
      </div>

      {plan.searched ? (
        <div className="flex items-center gap-1.5 text-[11.5px] s-faint">
          <I d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" className="h-3.5 w-3.5" />
          Searched <span className="s-muted">{plan.searched}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {plan.sources.map((s, k) => (
          <span
            key={s}
            className={`rounded-full border px-2 py-0.5 text-[10.5px] transition-all duration-500 ${k < activeSources ? 's-border s-panel2 s-fg' : 's-border s-faint'}`}
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
              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] s-border border-t-white/80" />
            )}
            <span className={k < i ? 's-faint' : 's-fg'}>{s}…</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Voice-mode overlay: white pulse rippling outward through a pixel grid. */
/** A single account-menu row — renders as a link when `href` is set, else a button. */
function MenuItem({ icon, children, onClick, href, sub }: { icon: React.ReactNode; children: React.ReactNode; onClick?: () => void; href?: string; sub?: boolean }) {
  const cls = `flex w-full items-center gap-2.5 rounded-lg px-2.5 text-left s-fg transition h-panel2 ${sub ? 'py-1.5 text-[12px] s-muted h-fg' : 'py-2 text-[12.5px]'}`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={cls}>
        <span className="shrink-0 s-muted">{icon}</span>
        <span className="flex-1 truncate">{children}</span>
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      <span className="shrink-0 s-muted">{icon}</span>
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

function VoicePulse({ onClose }: { onClose: () => void }) {
  const cols = 56;
  const rows = 4;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxD = Math.hypot(cx, cy);
  return (
    <div className="media-glass mx-auto flex max-w-[760px] items-center gap-4 rounded-2xl px-4 py-3.5 s-fg">
      <span className="sibyl-mark h-5 w-5 s-fg" />
      <div className="flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden py-2" aria-hidden>
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="flex flex-1 flex-col justify-center gap-[3px]">
            {Array.from({ length: rows }).map((__, r) => {
              // Delay purely by distance from centre → the pulse blooms outward as a ripple.
              const d = Math.hypot(c - cx, r - cy);
              return (
                <span
                  key={r}
                  className="h-[3px] w-full rounded-[1px] bg-[color:var(--s-fg)]"
                  style={{ animation: 'sibylWave 1.6s cubic-bezier(.4,0,.2,1) infinite', animationDelay: `${(d / maxD) * 1.15}s`, opacity: 0.08, transformOrigin: 'center', willChange: 'transform,opacity' }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <span className="whitespace-nowrap text-[12px] s-muted">Listening…</span>
      <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full s-panel2 text-[13px] s-fg transition h-panel2">✕</button>
    </div>
  );
}

export function SibylDashboard({ initialChatId }: { initialChatId?: string } = {}) {
  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ modelMock: boolean; liveProviders: number; memory: { scans: number; entities: number; resolved: number } | null } | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [menu, setMenu] = useState<null | 'model' | 'account' | 'upgrade' | 'plus' | 'plan'>(null);
  const [theme, setTheme] = useState<ThemeChoice>('dark');
  const [systemDark, setSystemDark] = useState(true);
  const [voice, setVoice] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; cap: number; remaining: number | null; tokenUsage: string } | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [acctSub, setAcctSub] = useState<null | 'help' | 'learn'>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const restoreRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [videoMounted, setVideoMounted] = useState(!initialChatId);

  // Auth bridges automatically: Sibyl lives inside the app's PrivyProvider, so a
  // session started anywhere in Pointer (same browser) is already authenticated here.
  const { authenticated, user, signIn, logout, getAccessToken } = usePointerAuth();
  const acctName =
    user?.google?.name ||
    user?.email?.address ||
    (user?.twitter?.username ? `@${user.twitter.username}` : '') ||
    (user?.id ? `${user.id.slice(0, 4)}…${user.id.slice(-4)}` : 'Guest');
  const acctSubtitle = authenticated ? 'Free plan · account' : 'Free plan · sign in';

  useEffect(() => {
    // Some browsers need an explicit play() even for muted autoplay.
    videoRef.current?.play().catch(() => {});
  }, []);

  // Load the requested chat (direct link / refresh) + hydrate the history list.
  useEffect(() => {
    setChats(listChats());
    if (initialChatId) {
      const c = getChat(initialChatId);
      if (c) setMessages(c.messages as Msg[]);
    }
  }, [initialChatId]);

  // Keep the URL ↔ chat in sync on back/forward.
  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/\/sibyl\/chat\/([^/]+)/);
      if (m && m[1]) {
        setChatId(m[1]);
        setMessages((getChat(m[1])?.messages ?? []) as Msg[]);
      } else {
        setChatId(null);
        setMessages([]);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
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
  // Entry = bare /sibyl, untouched → grass hero + no sidebar. ANY open chat (even a
  // fresh empty "New chat") engages: sidebar stays, no grass reset.
  const isEntry = !chatId && messages.length === 0;

  useEffect(() => {
    if (!isEntry) {
      const t = setTimeout(() => setVideoMounted(false), 1200); // fully remove after the fade
      return () => clearTimeout(t);
    }
    setVideoMounted(true); // back on the bare entry → bring the grass back
    return undefined;
  }, [isEntry]);

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

  const persist = (id: string, msgs: Msg[], fallbackTitle: string) => {
    const title = (msgs.find((m) => m.role === 'user')?.text ?? fallbackTitle).slice(0, 80);
    saveChat({ id, title, messages: msgs as StoredMsg[], ts: Date.now() });
    setChats(listChats());
  };

  const newChat = () => {
    const id = newChatId();
    setChatId(id);
    setMessages([]);
    setInput('');
    setMenu(null);
    window.history.pushState({}, '', `/sibyl/chat/${id}`);
  };

  const openChat = (id: string) => {
    setChatId(id);
    setMessages((getChat(id)?.messages ?? []) as Msg[]);
    setMenu(null);
    window.history.pushState({}, '', `/sibyl/chat/${id}`);
  };

  const refreshUsage = async () => {
    try {
      const token = await getAccessToken().catch(() => null);
      const res = await fetch('/api/sibyl/usage', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const d = (await res.json()) as { used: number; cap: number; remaining: number | null; tokenUsage: string };
      setUsage({ used: d.used, cap: d.cap, remaining: d.remaining, tokenUsage: d.tokenUsage });
    } catch {
      /* ignore */
    }
  };

  // Refresh the daily meter on load and whenever auth flips (attribution changes).
  useEffect(() => {
    void refreshUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const backupChats = () => {
    try {
      const blob = new Blob([exportChats()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sibyl-chats-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* ignore */
    }
    setMenu(null);
  };

  const onRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const n = importChats(String(reader.result ?? ''));
      setChats(listChats());
      if (n === 0) window.alert('That file didn’t contain any Sibyl chats.');
    };
    reader.readAsText(f);
  };

  const clearAllChats = () => {
    if (!window.confirm('Delete every saved chat in this browser? This can’t be undone.')) return;
    clearChats();
    setChats([]);
    setMenu(null);
    setSettingsOpen(false);
    setChatId(null);
    setMessages([]);
    window.history.pushState({}, '', '/sibyl');
  };

  const send = async (q: string) => {
    const query = q.trim();
    if (!query || loading) return;
    // First message on the bare entry → mint a chat + move to its URL (no grass reset).
    let id = chatId;
    if (!id) {
      id = newChatId();
      setChatId(id);
      window.history.pushState({}, '', `/sibyl/chat/${id}`);
    }
    setInput('');
    setVoice(false);
    setAttachment(null);
    setMessages((m) => [...m, { id: nid(), role: 'user', text: query }]);
    setLoading(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const res = await fetch('/api/sibyl/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query }),
      });
      if (res.status === 429) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        setMessages((m) => [...m, { id: nid(), role: 'sibyl', text: err.message ?? 'Daily scan limit reached. Upgrade for more.' }]);
        setUpgradeOpen(true);
        void refreshUsage();
        return;
      }
      const data = (await res.json()) as { answer?: SibylAnswer; usage?: { used: number; cap: number; remaining: number | null } };
      if (data.usage) setUsage((u) => ({ used: data.usage!.used, cap: data.usage!.cap, remaining: data.usage!.remaining, tokenUsage: u?.tokenUsage ?? '' }));
      setMessages((m) => [...m, data.answer ? { id: nid(), role: 'sibyl', answer: data.answer } : { id: nid(), role: 'sibyl', text: 'Sibyl hit an error. Try again.' }]);
    } catch {
      setMessages((m) => [...m, { id: nid(), role: 'sibyl', text: 'Network error.' }]);
    } finally {
      setLoading(false);
      setMessages((cur) => {
        persist(id!, cur, query);
        return cur;
      });
    }
  };

  const scans = useMemo(() => messages.filter((m) => m.role === 'user'), [messages]);
  const statusLine = status == null ? '' : status.modelMock ? `${status.liveProviders} live data · mock model` : `${status.liveProviders} providers live`;

  return (
    <div className="sibyl-scope fixed inset-0 overflow-hidden antialiased" style={{ ...vars } as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: SCOPE_CSS }} />
      <input ref={restoreRef} type="file" accept="application/json,.json" className="hidden" onChange={onRestoreFile} />
      <SibylUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} currentTier="FREE" />
      <SibylSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onTheme={setThemeChoice}
        statusLine={statusLine}
        memory={status?.memory ?? null}
        onBackup={backupChats}
        onRestore={() => restoreRef.current?.click()}
        onClear={clearAllChats}
        onUpgrade={() => { setSettingsOpen(false); setUpgradeOpen(true); }}
        authenticated={authenticated}
        accountName={acctName}
        onSignIn={() => { void signIn(); }}
        onLogout={() => { void logout(); }}
      />

      {/* base + ambient video (dark theme only — fades out + unmounts once a scan starts) */}
      <div className="absolute inset-0" style={{ background: 'var(--s-bg)' }} aria-hidden />
      {videoMounted && effectiveDark ? (
        <>
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: isEntry ? 1 : 0, transition: 'opacity 1100ms ease-out', pointerEvents: 'none' }}
            src="/sibyl/background.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden
          />
          <div className="absolute inset-0" style={{ opacity: isEntry ? 1 : 0, transition: 'opacity 1100ms ease-out', pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.12) 32%, rgba(0,0,0,0.5) 100%)' }} aria-hidden />
        </>
      ) : null}

      <div className="relative z-10 flex h-full">
        {/* LEFT — sidebar (only once a chat has started; slides in) */}
        {!isEntry ? (
        <aside className="slide-in s-glass s-border hidden w-[250px] shrink-0 flex-col border-r p-3.5 s-fg md:flex">
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <span className="sibyl-mark s-accent h-7 w-7" />
            <div className="leading-none">
              <div className={`${sibylSerif.className} text-[18px] leading-none s-fg`}>Sibyl</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] s-faint">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span>powered by</span>
                <img src="/branding/pointer-bird-transparent.png" alt="" className="h-2.5 w-2.5 object-contain opacity-80" />
                <span className="font-semibold tracking-tight s-fg">pointer.</span>
              </div>
            </div>
          </div>

          <button type="button" onClick={newChat} className="mt-3.5 flex items-center gap-2 rounded-xl border s-border s-panel2 py-2 pl-3 text-[12.5px] font-medium s-fg transition h-panel2">
            <IconPlus /> New chat
          </button>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] s-faint">History</div>
            {chats.length === 0 ? (
              <div className="px-1 py-1 text-[11px] s-faint">No history yet.</div>
            ) : (
              chats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openChat(c.id)}
                  className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-[12px] transition h-panel2 ${c.id === chatId ? 's-fg s-panel2' : 's-muted h-fg'}`}
                >
                  {c.title}
                </button>
              ))
            )}
          </div>

          <div className="relative mt-2 space-y-1.5 border-t s-border pt-3">
            {menu === 'account' ? (
              <div className="menu-glass pop absolute bottom-[calc(100%+8px)] left-0 w-full origin-bottom rounded-2xl p-1.5 shadow-2xl">
                {/* header */}
                <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full s-panel2 s-muted"><IconUser /></span>
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-[12.5px] font-medium s-fg">{acctName}</div>
                    <div className="text-[10px] s-faint">{authenticated ? 'Free plan · signed in' : 'Free plan'}</div>
                  </div>
                </div>
                <div className="my-1 h-px s-border" />

                <MenuItem icon={<I d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" className="h-4 w-4" />} onClick={() => { setUpgradeOpen(true); setMenu(null); }}>Purchase credits</MenuItem>
                <MenuItem icon={<IconUpgrade />} onClick={() => { setUpgradeOpen(true); setMenu(null); }}>Upgrade plan</MenuItem>

                <div className="my-1 h-px s-border" />

                <MenuItem icon={<I d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" className="h-4 w-4" />} onClick={backupChats}>Backup chat history</MenuItem>
                <MenuItem icon={<I d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" className="h-4 w-4" />} onClick={() => { restoreRef.current?.click(); setMenu(null); }}>Restore chat history</MenuItem>
                <MenuItem icon={<IconGear />} onClick={() => { setSettingsOpen(true); setMenu(null); }}>Settings</MenuItem>

                <div className="my-1 h-px s-border" />

                {/* Help & feedback submenu */}
                <button type="button" onClick={() => setAcctSub(acctSub === 'help' ? null : 'help')} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] s-fg transition h-panel2">
                  <I d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" className="h-4 w-4" />
                  <span className="flex-1">Help &amp; feedback</span>
                  <span className={`s-faint transition ${acctSub === 'help' ? 'rotate-90' : ''}`}>›</span>
                </button>
                {acctSub === 'help' ? (
                  <div className="stagger ml-3 border-l s-border pl-2">
                    <MenuItem sub icon={<I d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z" className="h-4 w-4" />} onClick={() => setMenu(null)}>Documentation</MenuItem>
                    <MenuItem sub icon={<I d="m8 2 1.5 1.5M16 2l-1.5 1.5M12 8v4M8 21h8M12 16v5M4.5 10.5 3 12M19.5 10.5 21 12M12 3a6 6 0 0 0-6 6c0 2.5 1.5 4 3 5h6c1.5-1 3-2.5 3-5a6 6 0 0 0-6-6Z" className="h-4 w-4" />} onClick={() => setMenu(null)}>Report a bug</MenuItem>
                    <MenuItem sub icon={<I d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" className="h-4 w-4" />} onClick={() => setMenu(null)}>Request a feature</MenuItem>
                  </div>
                ) : null}

                {/* Learn more submenu */}
                <button type="button" onClick={() => setAcctSub(acctSub === 'learn' ? null : 'learn')} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] s-fg transition h-panel2">
                  <I d="M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0ZM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" className="h-4 w-4" />
                  <span className="flex-1">Learn more</span>
                  <span className={`s-faint transition ${acctSub === 'learn' ? 'rotate-90' : ''}`}>›</span>
                </button>
                {acctSub === 'learn' ? (
                  <div className="stagger ml-3 border-l s-border pl-2">
                    <MenuItem sub href="https://pointer.trade" icon={<I d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" className="h-4 w-4" />}>Pointer home</MenuItem>
                    <MenuItem sub href="https://discord.gg" icon={<I d="M8 12a1 1 0 1 0 0-.01M16 12a1 1 0 1 0 0-.01M7 5.5c4-1.5 6-1.5 10 0M7 18.5c4 1.5 6 1.5 10 0M7 5.5 5 8v8l2 2.5M17 5.5 19 8v8l-2 2.5" className="h-4 w-4" />}>Discord</MenuItem>
                    <MenuItem sub href="https://x.com" icon={<I d="M4 4l16 16M20 4 4 20" className="h-4 w-4" />}>X / Twitter</MenuItem>
                  </div>
                ) : null}

                <div className="my-1 h-px s-border" />

                {authenticated ? (
                  <MenuItem icon={<I d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" className="h-4 w-4" />} onClick={() => { void logout(); setMenu(null); }}>Log out</MenuItem>
                ) : (
                  <>
                    <MenuItem icon={<I d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" className="h-4 w-4" />} onClick={() => { void signIn(); setMenu(null); }}>Sign in</MenuItem>
                    <MenuItem icon={<I d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" className="h-4 w-4" />} onClick={() => { void signIn(); setMenu(null); }}>Create account</MenuItem>
                  </>
                )}
              </div>
            ) : null}

            {usage && usage.cap > 0 ? (
              <div className="px-1 pb-0.5">
                <div className="flex items-center justify-between text-[10px] s-faint">
                  <span>{Math.max(0, usage.cap - usage.used)} of {usage.cap} scans left today</span>
                  {usage.tokenUsage ? <span className="s-faint">{usage.tokenUsage}</span> : null}
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full s-panel2">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((usage.used / usage.cap) * 100))}%`, background: 'var(--s-accent)' }} />
                </div>
              </div>
            ) : null}

            <button type="button" onClick={() => setUpgradeOpen(true)} className="s-accent flex w-full items-center justify-center gap-1.5 rounded-full border s-border s-panel2 py-2 text-[12px] font-medium transition h-panel2">
              <IconUpgrade /> Upgrade plan
            </button>

            <button type="button" data-menu-trigger onClick={() => setMenu(menu === 'account' ? null : 'account')} className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition h-panel2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full s-panel2 s-muted">
                <IconUser />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[12.5px] font-medium s-fg">{acctName}</div>
                <div className="text-[10px] s-faint">{acctSubtitle}</div>
              </div>
              <span className="s-faint">
                <IconGear />
              </span>
            </button>
          </div>
        </aside>
        ) : null}

        {/* CENTER — top bar + chat + input */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* top bar: plan + ecosystem */}
          <div className="flex items-center justify-between px-4 py-2.5 s-fg md:px-8">
            <button type="button" onClick={() => setUpgradeOpen(true)} className="media-glass rounded-full px-3 py-1.5 text-[11.5px] font-medium s-fg transition h-fg">
              Free plan · <span className="s-accent">Upgrade</span>
            </button>
            <nav className="flex items-center gap-1">
              {ECOSYSTEM.map((e, k) => (
                <a
                  key={e.label}
                  href={e.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: k === 0 ? 'var(--s-fg)' : 'var(--s-muted)' }}
                  className={`rounded-full px-3 py-1.5 text-[12px] transition h-panel2 ${k === 0 ? 'font-medium' : ''}`}
                >
                  {e.label}
                </a>
              ))}
            </nav>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-10">
            <div className="mx-auto flex max-w-[760px] flex-col gap-6">
              {messages.length === 0 && !loading ? (
                <div className="mt-[10vh] text-center s-fg">
                  <span className="sibyl-mark fade-up mx-auto mb-6 h-14 w-14 s-fg drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]" style={{ animationDelay: '0ms' }} />
                  <h1 className={`${sibylSerif.className} fade-up text-[46px] leading-[1.05] tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)]`} style={{ animationDelay: '90ms' }}>Delegate any crypto question.</h1>
                  <p className="fade-up mx-auto mt-3 max-w-[440px] text-[13.5px] leading-relaxed s-muted drop-shadow-[0_1px_12px_rgba(0,0,0,0.5)]" style={{ animationDelay: '170ms' }}>
                    Tokens, wallets, KOLs, narratives, terminal fees. Sibyl runs the specialists, pulls the chain + CT data, and comes back with a verdict.
                  </p>
                  <div className="mx-auto mt-8 grid max-w-[560px] grid-cols-1 gap-2 sm:grid-cols-2">
                    {DELEGATIONS.map((e, i) => (
                      <button key={e} type="button" onClick={() => send(e)} className="media-glass fade-up group rounded-xl px-3.5 py-2.5 text-left text-[12.5px] s-muted transition h-fg h-panel2" style={{ animationDelay: `${260 + i * 45}ms` }}>
                        <span className="mr-1.5 s-faint transition group-hover:text-[color:var(--s-accent)]">→</span>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="media-glass self-end rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px] s-fg">
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
                  <div className="mb-2 flex w-fit items-center gap-2 rounded-lg s-panel2 px-2.5 py-1 text-[11px] s-fg">
                    <IconUpload /> {attachment}
                    <button type="button" onClick={() => setAttachment(null)} className="s-faint h-fg">✕</button>
                  </div>
                ) : null}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                  style={isEntry ? { animationDelay: '340ms' } : undefined}
                  className={`media-glass flex items-center gap-2 rounded-2xl px-2.5 py-2 ${isEntry ? 'fade-up' : ''}`}
                >
                  {/* + menu */}
                  <div className="relative shrink-0">
                    <button type="button" data-menu-trigger onClick={() => setMenu(menu === 'plus' ? null : 'plus')} className="flex h-8 w-8 items-center justify-center rounded-lg s-muted transition h-panel2 h-fg" title="Add files or tools">
                      <IconPlus />
                    </button>
                    {menu === 'plus' ? (
                      <div className="menu-glass pop stagger absolute bottom-[calc(100%+8px)] left-0 w-[220px] origin-bottom-left space-y-0.5 rounded-xl p-1.5 shadow-2xl">
                        <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] s-fg transition h-panel2">
                          <IconUpload /> Upload files or images
                        </button>
                        <button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] s-fg transition h-panel2">
                          <span className="flex items-center gap-2.5"><IconPlug /> Connectors</span>
                          <span className="text-[9px] uppercase tracking-wide s-faint">soon</span>
                        </button>
                        <button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] s-fg transition h-panel2">
                          <span className="flex items-center gap-2.5"><IconFolder /> Spaces</span>
                          <span className="text-[9px] uppercase tracking-wide s-faint">soon</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*,.pdf,.csv,.txt" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? null)} />

                  {/* model selector */}
                  <div className="relative shrink-0">
                    <button type="button" data-menu-trigger onClick={() => setMenu(menu === 'model' ? null : 'model')} className="flex items-center gap-1.5 rounded-lg s-panel2 px-2.5 py-1.5 text-[12px] font-medium s-fg transition h-panel2">
                      <span className="sibyl-mark s-accent h-3.5 w-3.5" />
                      Sibyl 7.0
                      <span className="text-[9px] s-faint">▾</span>
                    </button>
                    {menu === 'model' ? (
                      <div className="menu-glass pop stagger absolute bottom-[calc(100%+8px)] left-0 w-[236px] origin-bottom-left space-y-0.5 rounded-xl p-1.5 shadow-2xl">
                        {MODELS.map((mo) => (
                          <div key={mo.id} className={`flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 ${mo.locked ? 'opacity-55' : 's-panel2'}`}>
                            <div>
                              <div className="text-[12.5px] font-medium s-fg">{mo.name}</div>
                              <div className="text-[10.5px] s-faint">{mo.note}</div>
                            </div>
                            <span className="mt-0.5 s-faint">{mo.locked ? <I d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM8 11V7a4 4 0 1 1 8 0v4" className="h-3 w-3" /> : <I d="M20 6 9 17l-5-5" className="h-3.5 w-3.5" />}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Analyze a token, wallet, KOL, or narrative — or paste a CA…"
                    className="ph-faint min-w-0 flex-1 bg-transparent py-1.5 text-[14px] s-fg focus:outline-none"
                  />

                  <button type="button" onClick={() => setVoice(true)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg s-muted transition h-panel2 h-fg" title="Voice mode" aria-label="Voice mode">
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
