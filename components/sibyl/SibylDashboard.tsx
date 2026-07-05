'use client';

import { useEffect, useRef, useState } from 'react';
import type { SibylAnswer, SibylCard } from '@/sibyl/types';
import { SibylAnswerView } from '@/components/sibyl/SibylAnswerView';
import { CardRenderer } from '@/components/sibyl/SibylCards';

type Msg = { id: string; role: 'user' | 'sibyl'; text?: string; answer?: SibylAnswer };

const EXAMPLES = ['COBRA?', 'Is this ruggy?', 'Is Ansem in this?', 'What’s the narrative?', 'Axiom fees today', 'Best small-cap narrative under $50M?'];

let seq = 0;
const nid = () => `m${seq++}`;

export function SibylDashboard() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [cards, setCards] = useState<SibylCard[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mock, setMock] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/sibyl/status').then((r) => r.json()).then((d) => setMock(Boolean(d.mock))).catch(() => {});
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

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[#08090d] text-white antialiased">
      {/* aurora */}
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden style={{ background: 'radial-gradient(60% 50% at 15% 0%, rgba(56,139,255,0.12), transparent 60%), radial-gradient(50% 50% at 90% 20%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(60% 60% at 50% 120%, rgba(139,92,246,0.10), transparent 60%)' }} />

      {/* LEFT — history / saved scans */}
      <aside className="relative z-10 hidden w-[240px] shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.02] p-3 backdrop-blur-xl md:flex">
        <div className="flex items-center gap-2 px-1 pb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-[13px] font-black">S</div>
          <div><div className="text-[13px] font-semibold leading-none">Sibyl</div><div className="text-[9px] uppercase tracking-widest text-white/35">by pointer</div></div>
        </div>
        <button type="button" onClick={() => { setMessages([]); setCards([]); }} className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] py-2 text-[12px] font-medium text-white/80 transition hover:bg-white/[0.08]">+ New scan</button>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">Saved scans</div>
          {scans.length === 0 ? <div className="px-1 py-2 text-[11px] text-white/30">Nothing yet.</div> : scans.slice().reverse().map((s) => (
            <button key={s.id} type="button" onClick={() => send(s.text!)} className="block w-full truncate rounded-md px-2 py-1.5 text-left text-[12px] text-white/60 transition hover:bg-white/[0.05] hover:text-white/90">{s.text}</button>
          ))}
        </div>
        <div className="pt-2 text-[10px] text-white/30">{mock == null ? '' : mock ? '● mock mode (no keys)' : '● live providers'}</div>
      </aside>

      {/* CENTER — chat */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-10">
          <div className="mx-auto flex max-w-[720px] flex-col gap-5">
            {messages.length === 0 ? (
              <div className="mt-10 text-center">
                <h1 className="text-[26px] font-semibold tracking-tight">Ask Sibyl anything about crypto.</h1>
                <p className="mt-2 text-[13px] text-white/45">Tokens, wallets, KOLs, narratives, terminal fees — high-signal, CT-native.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((e) => (
                    <button key={e} type="button" onClick={() => send(e)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70 transition hover:border-white/25 hover:text-white">{e}</button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="self-end rounded-2xl rounded-br-md border border-white/10 bg-white/[0.06] px-3.5 py-2 text-[13px] text-white/90">{m.text}</div>
              ) : (
                <div key={m.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl">
                  {m.answer ? <SibylAnswerView answer={m.answer} /> : <div className="text-[13px] text-white/60">{m.text}</div>}
                </div>
              ),
            )}
            {loading ? <div className="flex items-center gap-2 text-[12px] text-white/40"><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />Sibyl is scanning…</div> : null}
          </div>
        </div>

        <div className="border-t border-white/[0.06] bg-[#08090d]/80 px-4 py-3 backdrop-blur-xl md:px-10">
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mx-auto flex max-w-[720px] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1.5 focus-within:border-white/25">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Analyze a token, wallet, KOL, or narrative…" className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-white placeholder:text-white/30 focus:outline-none" />
            <button type="submit" disabled={loading || !input.trim()} className="rounded-xl bg-white px-3.5 py-1.5 text-[13px] font-semibold text-black transition disabled:opacity-30">Scan</button>
          </form>
        </div>
      </main>

      {/* RIGHT — dynamic context */}
      <aside className="relative z-10 hidden w-[380px] shrink-0 flex-col border-l border-white/[0.06] bg-white/[0.02] backdrop-blur-xl lg:flex">
        <div className="border-b border-white/[0.06] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">Context</div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {cards.length === 0 ? (
            <div className="mt-10 text-center text-[12px] text-white/30">Charts, holders, wallets, narratives and Dune stats appear here as Sibyl scans.</div>
          ) : cards.map((c) => <CardRenderer key={c.id} card={c} />)}
        </div>
      </aside>
    </div>
  );
}
