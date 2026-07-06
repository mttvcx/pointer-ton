'use client';

import { useEffect, useRef, useState } from 'react';
import type { SibylAnswer, SibylCard } from '@/sibyl/types';
import { SibylAnswerView } from '@/components/sibyl/SibylAnswerView';
import { CardRenderer } from '@/components/sibyl/SibylCards';
import { sibylSerif } from '@/components/sibyl/fonts';

type Msg = { id: string; role: 'user' | 'sibyl'; text?: string; answer?: SibylAnswer };

/* Delegate-style crypto research tasks — Sibyl goes and finds/does what it needs. */
const DELEGATIONS = [
  'Scan this token for rug risk — paste a CA',
  'Which KOLs are holding this, and who’s still in?',
  'Is this wallet smart money? Paste an address',
  'Freshest narrative under $20M — and who started it',
  'Compare Axiom vs Photon fees this week',
  'Is Ansem in this?',
];

let seq = 0;
const nid = () => `m${seq++}`;

export function SibylDashboard() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [cards, setCards] = useState<SibylCard[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ modelMock: boolean; forcedMock: boolean; liveProviders: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/sibyl/status')
      .then((r) => r.json())
      .then((d) => setStatus({ modelMock: Boolean(d.modelMock), forcedMock: Boolean(d.forcedMock), liveProviders: Number(d.liveProviders ?? 0) }))
      .catch(() => {});
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (q: string) => {
    const query = q.trim();
    if (!query || loading) return;
    setInput('');
    setMessages((m) => [...m, { id: nid(), role: 'user', text: query }]);
    setLoading(true);
    try {
      const res = await fetch('/api/sibyl/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const data = (await res.json()) as { answer?: SibylAnswer; error?: string };
      if (data.answer) {
        setMessages((m) => [...m, { id: nid(), role: 'sibyl', answer: data.answer }]);
        setCards(data.answer.cards);
      } else {
        setMessages((m) => [...m, { id: nid(), role: 'sibyl', text: 'Sibyl hit an error. Try again.' }]);
      }
    } catch {
      setMessages((m) => [...m, { id: nid(), role: 'sibyl', text: 'Network error.' }]);
    } finally {
      setLoading(false);
    }
  };

  const scans = messages.filter((m) => m.role === 'user');
  const statusLine =
    status == null ? '' : status.forcedMock ? 'offline · SIBYL_MOCK' : status.modelMock ? `${status.liveProviders} live data · mock model` : `${status.liveProviders} live providers`;

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#06070a] text-white antialiased">
      {/* layered aurora + vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(50% 44% at 12% -4%, rgba(56,139,255,0.16), transparent 62%),' +
            'radial-gradient(46% 42% at 92% 8%, rgba(139,92,246,0.14), transparent 60%),' +
            'radial-gradient(60% 55% at 50% 118%, rgba(16,185,129,0.12), transparent 60%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_90%_at_50%_-10%,transparent_55%,rgba(0,0,0,0.55))]" aria-hidden />

      {/* LEFT — history / saved scans */}
      <aside className="relative z-10 hidden w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.015] p-3.5 backdrop-blur-2xl md:flex">
        <div className="flex items-center gap-2.5 px-1 pb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
            <span className={`${sibylSerif.className} text-[17px] leading-none text-white`}>S</span>
          </div>
          <div>
            <div className={`${sibylSerif.className} text-[17px] leading-none text-white`}>Sibyl</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-white/35">by pointer</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setCards([]);
          }}
          className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] py-2 text-[12px] font-medium text-white/85 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:bg-white/[0.08]"
        >
          + New scan
        </button>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Saved scans</div>
          {scans.length === 0 ? (
            <div className="px-1 py-2 text-[11px] text-white/30">Nothing yet.</div>
          ) : (
            scans
              .slice()
              .reverse()
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => send(s.text!)}
                  className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-[12px] text-white/60 transition hover:bg-white/[0.05] hover:text-white/90"
                >
                  {s.text}
                </button>
              ))
          )}
        </div>
        <div className="flex items-center gap-1.5 pt-2 text-[10px] text-white/35">
          <span className={`h-1.5 w-1.5 rounded-full ${status?.modelMock === false ? 'bg-emerald-400' : 'bg-amber-400/80'}`} />
          {statusLine}
        </div>
      </aside>

      {/* CENTER — chat */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-10">
          <div className="mx-auto flex max-w-[760px] flex-col gap-6">
            {messages.length === 0 ? (
              <div className="mt-[8vh] text-center">
                <h1 className={`${sibylSerif.className} text-[46px] leading-[1.05] tracking-tight text-white`}>
                  Delegate any crypto question.
                </h1>
                <p className="mx-auto mt-3 max-w-[440px] text-[13.5px] leading-relaxed text-white/45">
                  Tokens, wallets, KOLs, narratives, terminal fees. Sibyl runs the specialists, pulls the chain + CT data, and comes back with a verdict — not a wall of text.
                </p>
                <div className="mx-auto mt-8 grid max-w-[560px] grid-cols-1 gap-2 sm:grid-cols-2">
                  {DELEGATIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => send(e)}
                      className="group rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-left text-[12.5px] text-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                    >
                      <span className="mr-1.5 text-white/25 transition group-hover:text-sky-300">→</span>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="self-end rounded-2xl rounded-br-md border border-white/10 bg-white/[0.07] px-4 py-2.5 text-[13.5px] text-white/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                  {m.text}
                </div>
              ) : (
                <div
                  key={m.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_20px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
                >
                  {m.answer ? <SibylAnswerView answer={m.answer} /> : <div className="text-[13px] text-white/60">{m.text}</div>}
                </div>
              ),
            )}
            {loading ? (
              <div className="flex items-center gap-2.5 text-[12px] text-white/45">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/25 border-t-sky-300" />
                <span className="animate-pulse">Sibyl is running the specialists…</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* input */}
        <div className="px-4 pb-5 pt-2 md:px-10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="mx-auto flex max-w-[760px] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_40px_-16px_rgba(0,0,0,0.7)] backdrop-blur-2xl transition focus-within:border-sky-400/40 focus-within:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(56,139,255,0.25),0_10px_40px_-16px_rgba(0,0,0,0.7)]"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Analyze a token, wallet, KOL, or narrative — or paste a CA…"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-white placeholder:text-white/30 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-white px-4 py-1.5 text-[13px] font-semibold text-black shadow-[0_1px_0_0_rgba(255,255,255,0.4)_inset] transition hover:bg-white/90 disabled:opacity-25"
            >
              Scan
            </button>
          </form>
          <div className="mx-auto mt-2 max-w-[760px] text-center text-[10px] text-white/25">Sibyl reasons over real chain + CT data. Verify before you size.</div>
        </div>
      </main>

      {/* RIGHT — dynamic context */}
      <aside className="relative z-10 hidden w-[392px] shrink-0 flex-col border-l border-white/[0.06] bg-white/[0.015] backdrop-blur-2xl lg:flex">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Context</div>
          {cards.length > 0 ? <div className="text-[10px] text-white/30">{cards.length} cards</div> : null}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {cards.length === 0 ? (
            <div className="mt-[20vh] px-6 text-center text-[12px] leading-relaxed text-white/30">
              Charts, holders, wallets, narratives and terminal stats appear here as Sibyl scans.
            </div>
          ) : (
            cards.map((c) => <CardRenderer key={c.id} card={c} />)
          )}
        </div>
      </aside>
    </div>
  );
}
