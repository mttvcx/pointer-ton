'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SibylAnswer } from '@/sibyl/types';
import { SibylAnswerView } from '@/components/sibyl/SibylAnswerView';
import { sibylSerif } from '@/components/sibyl/fonts';

type Msg = { id: string; role: 'user' | 'sibyl'; text?: string; answer?: SibylAnswer };
type Plan = { tier: string; label: string; price: number; maxMode: string };
type ThemeChoice = 'system' | 'light' | 'dark';

/* Delegate-style crypto research tasks — Sibyl goes and finds/does what it needs. */
const DELEGATIONS = [
  'Scan this token for rug risk — paste a CA',
  'Which KOLs are holding this, and who’s still in?',
  'Is this wallet smart money? Paste an address',
  'Freshest narrative under $20M — and who started it',
  'Compare Axiom vs Photon fees this week',
  'Is Ansem in this?',
];

/* Model line — presentational brand over the real router underneath. */
const MODELS = [
  { id: 'sibyl-7', name: 'Sibyl 7.0', note: 'Flagship — full specialist fan-out', locked: false },
  { id: 'sibyl-7-pro', name: 'Sibyl 7.0 Pro', note: 'Deeper scans, adversarial verify', locked: true },
  { id: 'sibyl-deep', name: 'Sibyl Deep Research', note: 'Long-horizon, many sources', locked: true },
  { id: 'sibyl-fast', name: 'Sibyl Flash', note: 'Sub-second hover facts', locked: true },
];

const THEME_VARS: Record<'light' | 'dark', Record<string, string>> = {
  dark: {
    '--s-bg': '#0c0c0e',
    '--s-fg': '#f4f4f5',
    '--s-muted': 'rgba(244,244,245,0.55)',
    '--s-faint': 'rgba(244,244,245,0.34)',
    '--s-panel': 'rgba(255,255,255,0.035)',
    '--s-panel-2': 'rgba(255,255,255,0.07)',
    '--s-border': 'rgba(255,255,255,0.09)',
    '--s-accent': '#a5a0ff',
  },
  light: {
    '--s-bg': '#f5f5f6',
    '--s-fg': '#17171b',
    '--s-muted': 'rgba(23,23,27,0.6)',
    '--s-faint': 'rgba(23,23,27,0.42)',
    '--s-panel': '#ffffff',
    '--s-panel-2': 'rgba(0,0,0,0.045)',
    '--s-border': 'rgba(0,0,0,0.1)',
    '--s-accent': '#6a5cff',
  },
};

const SCOPE_CSS = `
.sibyl-mark{-webkit-mask:url(/sibyl/mark.png) center/contain no-repeat;mask:url(/sibyl/mark.png) center/contain no-repeat;background-color:var(--s-accent);display:block}
.s-panel{background:var(--s-panel)}
.s-panel2{background:var(--s-panel-2)}
.s-border{border-color:var(--s-border)}
.s-fg{color:var(--s-fg)}
.s-muted{color:var(--s-muted)}
.s-faint{color:var(--s-faint)}
.s-accent{color:var(--s-accent)}
.h-fg:hover{color:var(--s-fg)}
.h-panel2:hover{background:var(--s-panel-2)}
.h-op:hover{opacity:.82}
.group:hover .gh-accent{color:var(--s-accent)}
.ph-faint::placeholder{color:var(--s-faint)}
.fw-accent:focus-within{border-color:var(--s-accent)}
@keyframes sibylPixel{0%,100%{opacity:.1}50%{opacity:1}}
`;

let seq = 0;
const nid = () => `m${seq++}`;

/** Voice-mode overlay: white pulse rippling outward through a pixel grid. */
function VoicePulse({ onClose }: { onClose: () => void }) {
  const cols = 56;
  const rows = 4;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxD = Math.hypot(cx, cy);
  return (
    <div className="s-panel s-border mx-auto flex max-w-[760px] items-center gap-4 rounded-2xl border px-4 py-3.5 backdrop-blur-2xl">
      <span className="s-fg flex h-6 w-6 items-center justify-center rounded-full">
        <span className="sibyl-mark h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden py-2" aria-hidden>
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="flex flex-1 flex-col gap-[3px]">
            {Array.from({ length: rows }).map((__, r) => {
              const d = Math.hypot(c - cx, r - cy);
              return (
                <span
                  key={r}
                  className="h-[3px] w-full rounded-[1px] bg-current s-fg"
                  style={{ animation: 'sibylPixel 1.5s ease-in-out infinite', animationDelay: `${(d / maxD) * 0.9}s`, opacity: 0.1 }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <span className="s-muted whitespace-nowrap text-[12px]">Listening…</span>
      <button type="button" onClick={onClose} className="s-panel2 s-fg flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition hover:opacity-80">
        ✕
      </button>
    </div>
  );
}

export function SibylDashboard() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ modelMock: boolean; liveProviders: number; memory: { scans: number; entities: number; resolved: number } | null } | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [menu, setMenu] = useState<null | 'model' | 'settings' | 'upgrade'>(null);
  const [theme, setTheme] = useState<ThemeChoice>('dark');
  const [systemDark, setSystemDark] = useState(true);
  const [voice, setVoice] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
    <div className="sibyl-scope s-fg fixed inset-0 flex overflow-hidden antialiased" style={{ ...vars, background: 'var(--s-bg)' } as React.CSSProperties} onClick={() => setMenu(null)}>
      <style dangerouslySetInnerHTML={{ __html: SCOPE_CSS }} />

      {/* LEFT — sidebar */}
      <aside className="s-border relative z-10 hidden w-[248px] shrink-0 flex-col border-r p-3 md:flex" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-1 py-2">
          <span className="sibyl-mark h-7 w-7" />
          <div>
            <div className={`${sibylSerif.className} s-fg text-[18px] leading-none`}>Sibyl</div>
            <div className="s-faint mt-0.5 text-[9px] uppercase tracking-[0.2em]">by pointer</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMessages([])}
          className="s-panel s-border s-fg mt-3 flex items-center gap-2 rounded-xl border py-2 pl-3 text-[12.5px] font-medium transition h-panel2"
        >
          <span className="s-muted text-[15px] leading-none">+</span> New chat
        </button>

        {/* history */}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <div className="s-faint px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]">History</div>
          {scans.length === 0 ? (
            <div className="s-faint px-1 py-1 text-[11px]">No history yet.</div>
          ) : (
            scans
              .slice()
              .reverse()
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => send(s.text!)}
                  className="s-muted block w-full truncate rounded-lg px-2 py-1.5 text-left text-[12px] transition h-panel2 h-fg"
                >
                  {s.text}
                </button>
              ))
          )}
        </div>

        {/* bottom controls */}
        <div className="s-border relative mt-2 space-y-0.5 border-t pt-2">
          {menu === 'settings' ? (
            <div className="s-panel s-border absolute bottom-[calc(100%+6px)] left-0 w-full space-y-2.5 rounded-xl border p-3 shadow-2xl backdrop-blur-2xl">
              <div className="s-faint text-[10px] font-semibold uppercase tracking-[0.12em]">Appearance</div>
              <div className="s-panel2 grid grid-cols-3 gap-0.5 rounded-lg p-0.5">
                {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setThemeChoice(t)}
                    className={`rounded-md py-1 text-[11px] font-medium capitalize transition ${theme === t ? 's-panel s-fg shadow' : 's-muted h-fg'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="s-faint flex items-center gap-1.5 text-[10px]">
                <span className={`h-1.5 w-1.5 rounded-full ${status?.modelMock === false ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {statusLine}
              </div>
              {status?.memory ? (
                <div className="s-faint text-[10px]">
                  🧠 {status.memory.scans.toLocaleString()} scans · {status.memory.entities.toLocaleString()} entities · {status.memory.resolved.toLocaleString()} graded
                </div>
              ) : null}
            </div>
          ) : null}

          <SideRow icon="⤴" label="Upgrade plan" accent onClick={() => setMenu(menu === 'upgrade' ? null : 'upgrade')} />
          {menu === 'upgrade' ? (
            <div className="s-panel s-border absolute bottom-[calc(100%+6px)] left-0 w-full space-y-1 rounded-xl border p-2.5 shadow-2xl backdrop-blur-2xl">
              {plans.map((p) => (
                <div key={p.tier} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px]">
                  <span className="s-fg font-medium">{p.label}</span>
                  <span className="s-muted tabular-nums">{p.price === 0 ? 'Free' : `$${p.price}/mo`}</span>
                </div>
              ))}
            </div>
          ) : null}
          <SideRow icon="⚙" label="Settings" onClick={() => setMenu(menu === 'settings' ? null : 'settings')} />
          <SideRow icon="◐" label="Sign in" onClick={() => {}} />
        </div>
      </aside>

      {/* CENTER — chat */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-10">
          <div className="mx-auto flex max-w-[760px] flex-col gap-6">
            {messages.length === 0 ? (
              <div className="mt-[9vh] text-center">
                <span className="sibyl-mark mx-auto mb-6 h-12 w-12 opacity-90" />
                <h1 className={`${sibylSerif.className} s-fg text-[44px] leading-[1.05] tracking-tight`}>Delegate any crypto question.</h1>
                <p className="s-muted mx-auto mt-3 max-w-[440px] text-[13.5px] leading-relaxed">
                  Tokens, wallets, KOLs, narratives, terminal fees. Sibyl runs the specialists, pulls the chain + CT data, and comes back with a verdict — not a wall of text.
                </p>
                <div className="mx-auto mt-8 grid max-w-[560px] grid-cols-1 gap-2 sm:grid-cols-2">
                  {DELEGATIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => send(e)}
                      className="s-panel s-border s-muted group rounded-xl border px-3.5 py-2.5 text-left text-[12.5px] transition h-fg h-panel2"
                    >
                      <span className="s-faint mr-1.5 transition gh-accent">→</span>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="s-panel2 s-fg self-end rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px]">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="s-panel s-border rounded-2xl border p-5 backdrop-blur-2xl">
                  {m.answer ? <SibylAnswerView answer={m.answer} /> : <div className="s-muted text-[13px]">{m.text}</div>}
                </div>
              ),
            )}
            {loading ? (
              <div className="s-muted flex items-center gap-2.5 text-[12px]">
                <span className="s-border h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderTopColor: 'var(--s-accent)' }} />
                <span className="animate-pulse">Sibyl is running the specialists…</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* input / voice */}
        <div className="px-4 pb-6 pt-2 md:px-10" onClick={(e) => e.stopPropagation()}>
          {voice ? (
            <VoicePulse onClose={() => setVoice(false)} />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="s-panel s-border mx-auto flex max-w-[760px] items-center gap-2 rounded-2xl border px-2.5 py-2 backdrop-blur-2xl transition fw-accent"
              style={{ boxShadow: '0 8px 40px -20px rgba(0,0,0,0.5)' }}
            >
              <button type="button" className="s-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[17px] transition h-fg" title="Attach / paste">
                +
              </button>

              {/* model selector */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMenu(menu === 'model' ? null : 'model')}
                  className="s-panel2 s-fg flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition hover:opacity-90"
                >
                  <span className="sibyl-mark h-3.5 w-3.5" />
                  Sibyl 7.0
                  <span className="s-faint text-[9px]">▾</span>
                </button>
                {menu === 'model' ? (
                  <div className="s-panel s-border absolute bottom-[calc(100%+8px)] left-0 w-[236px] space-y-0.5 rounded-xl border p-1.5 shadow-2xl backdrop-blur-2xl">
                    {MODELS.map((mo) => (
                      <div key={mo.id} className={`flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 ${mo.locked ? 'opacity-55' : 's-panel2'}`}>
                        <div>
                          <div className="s-fg text-[12.5px] font-medium">{mo.name}</div>
                          <div className="s-faint text-[10.5px]">{mo.note}</div>
                        </div>
                        <span className="s-faint mt-0.5 text-[10px]">{mo.locked ? '🔒' : '✓'}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Analyze a token, wallet, KOL, or narrative — or paste a CA…"
                className="s-fg min-w-0 flex-1 bg-transparent py-1.5 text-[14px] ph-faint focus:outline-none"
              />

              <button type="button" onClick={() => setVoice(true)} className="s-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition h-fg" title="Voice mode" aria-label="Voice mode">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              </button>

              {/* arrow submit — only when text is entered */}
              {input.trim() ? (
                <button
                  type="submit"
                  disabled={loading}
                  className="s-accent-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black transition disabled:opacity-40"
                  style={{ background: 'var(--s-accent)' }}
                  aria-label="Send"
                >
                  <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="#0c0c0e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              ) : null}
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function SideRow({ icon, label, accent, onClick }: { icon: string; label: string; accent?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[12.5px] font-medium transition h-panel2 ${accent ? 's-accent' : 's-muted'}`}
    >
      <span className="w-4 text-center text-[13px]">{icon}</span>
      {label}
    </button>
  );
}
