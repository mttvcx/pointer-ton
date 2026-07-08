'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp, Bot, BookmarkPlus, ChevronDown, ChevronLeft, Coins, Folder, FolderPlus, Lock, Menu, Mic, Paperclip, Plus, Search, Sparkles, Square, Trash2, X,
} from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { SibylAnswerView } from '@/components/sibyl/SibylAnswerView';
import { SibylUpgradeModal } from '@/components/sibyl/SibylUpgradeModal';
import { SIBYL_MODELS } from '@/lib/sibyl/models';
import { useSibylSpaces } from '@/store/sibylSpaces';
import type { SibylAnswer } from '@/sibyl/types';

/**
 * Sibyl app (standalone, mobile-first, Venice-clean, liquid glass). General AI by
 * default; Crypto is a Specialty tab → the Council. Thin client to /api/sibyl/*.
 */

type Specialty = 'general' | 'crypto';
type Msg = { id: string; role: 'user' | 'sibyl'; text?: string; answer?: SibylAnswer; typing?: boolean };
type Stage = { key: string; label: string; status: 'active' | 'done' };
type ModelKey = 'oracle' | 'veil';

const nid = () => `${Date.now()}-${Math.round(performance.now())}`;

const GENERAL_STARTERS = ['Explain a concept simply', 'Draft something for me', 'Summarize this idea', 'Help me decide'];
const CRYPTO_STARTERS = ['Analyze a token', 'Check a wallet', 'Scan a KOL', "What's the meta?"];

export function SibylApp() {
  const { getAccessToken, authenticated, login, user } = usePointerAuth();
  const displayName = user?.google?.name ?? user?.twitter?.username ?? user?.email?.address ?? 'Guest';
  const [drawer, setDrawer] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'spaces'>('chat');
  const [saveItem, setSaveItem] = useState<{ title: string; body: string } | null>(null);
  const [specialty, setSpecialty] = useState<Specialty>('general');
  const [modelKey, setModelKey] = useState<ModelKey>('oracle');
  const [modelSheet, setModelSheet] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [attested, setAttested] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<Msg[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, stages, loading]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStages([]);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query || loading) return;
      setInput('');
      setMessages((m) => [...m, { id: nid(), role: 'user', text: query }]);
      setLoading(true);
      setStages([]);
      setAttested(null);
      const ac = new AbortController();
      abortRef.current = ac;
      const mode = modelKey === 'veil' ? 'confidential' : 'fast';
      const parseSse = (chunk: string): { ev?: string; data?: Record<string, unknown> } => {
        const ev = chunk.match(/^event: (.+)$/m)?.[1];
        const dl = chunk.match(/^data: ([\s\S]+)$/m)?.[1];
        if (!ev || !dl) return {};
        try {
          return { ev, data: JSON.parse(dl) };
        } catch {
          return {};
        }
      };
      try {
        const token = await getAccessToken().catch(() => null);
        const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

        if (specialty === 'general') {
          // GENERAL = plain private AI chat: token-stream text into a live message.
          const history = messagesRef.current
            .filter((x) => typeof x.text === 'string' && x.text.length > 0)
            .slice(-8)
            .map((x) => ({ role: x.role === 'user' ? 'user' : 'assistant', content: x.text! }));
          const asstId = nid();
          setMessages((m) => [...m, { id: asstId, role: 'sibyl', text: '' }]);
          const res = await fetch('/api/sibyl/general/stream', { method: 'POST', headers, body: JSON.stringify({ query, mode, history }), signal: ac.signal });
          if (!res.ok || !res.body) throw new Error('stream_failed');
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const chunks = buf.split('\n\n');
            buf = chunks.pop() ?? '';
            for (const chunk of chunks) {
              const { ev, data } = parseSse(chunk);
              if (!ev || !data) continue;
              if (ev === 'token') {
                const t = (data as { t?: string }).t ?? '';
                if (t) setMessages((m) => m.map((x) => (x.id === asstId ? { ...x, text: (x.text ?? '') + t } : x)));
              } else if (ev === 'attestation') setAttested(Boolean((data as { verified?: boolean }).verified));
              else if (ev === 'error' || ev === 'cap') {
                const msg = (data as { message?: string }).message ?? 'Sibyl hit an error.';
                setMessages((m) => m.map((x) => (x.id === asstId && !x.text ? { ...x, text: msg } : x)));
              }
            }
          }
          return;
        }

        // CRYPTO = the Council: live per-agent trace, then a structured answer.
        let gotAnswer = false;
        const res = await fetch('/api/sibyl/chat/stream', { method: 'POST', headers, body: JSON.stringify({ query, mode }), signal: ac.signal });
        if (!res.ok || !res.body) throw new Error('stream_failed');
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const chunks = buf.split('\n\n');
          buf = chunks.pop() ?? '';
          for (const chunk of chunks) {
            const { ev, data } = parseSse(chunk);
            if (!ev || !data) continue;
            if (ev === 'attestation') setAttested(Boolean((data as { verified?: boolean }).verified));
            else if (ev === 'stage') {
              const s = data as unknown as Stage;
              setStages((prev) => {
                const i = prev.findIndex((x) => x.key === s.key);
                if (i >= 0) {
                  const next = [...prev];
                  next[i] = s;
                  return next;
                }
                return [...prev, s];
              });
            } else if (ev === 'answer') {
              gotAnswer = true;
              const answer = data.answer as SibylAnswer | undefined;
              setMessages((m) => [...m, answer ? { id: nid(), role: 'sibyl', answer, typing: true } : { id: nid(), role: 'sibyl', text: 'Sibyl hit an error. Try again.' }]);
            } else if (ev === 'cap' || ev === 'error') {
              setMessages((m) => [...m, { id: nid(), role: 'sibyl', text: (data.message as string) ?? 'Sibyl hit a limit. Try again.' }]);
            }
          }
        }
        if (!gotAnswer) setMessages((m) => [...m, { id: nid(), role: 'sibyl', text: 'Sibyl hit an error. Try again.' }]);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          setMessages((m) => [...m, { id: nid(), role: 'sibyl', text: 'Network error.' }]);
        }
      } finally {
        setLoading(false);
        setStages([]);
        abortRef.current = null;
      }
    },
    [loading, getAccessToken, modelKey, specialty],
  );

  const empty = messages.length === 0 && !loading;
  const starters = specialty === 'crypto' ? CRYPTO_STARTERS : GENERAL_STARTERS;
  const activeModel = modelKey === 'veil' ? SIBYL_MODELS.veil : SIBYL_MODELS.flagship;

  return (
    <div className="sib fixed inset-0 flex justify-center" style={{ background: 'var(--sib-bg)' }}>
      {/* mobile-first: phone-width column, centered on desktop */}
      <div className="relative flex h-full w-full max-w-[520px] flex-col overflow-hidden">
        {/* top bar */}
        <header className="relative z-20 flex items-center justify-between px-4 py-3">
          <button type="button" onClick={() => setDrawer(true)} className="sib-hover rounded-lg p-1.5" aria-label="Menu">
            <Menu className="h-5 w-5 sib-muted" />
          </button>
          <span className="text-[15px] font-semibold tracking-tight">Sibyl</span>
          <button type="button" onClick={() => setMessages([])} className="sib-hover rounded-lg p-1.5" aria-label="New chat">
            <Plus className="h-5 w-5 sib-muted" />
          </button>
        </header>

        {view === 'spaces' ? (
          <SpacesView onBack={() => setView('chat')} />
        ) : (
        <>
        {/* main scroll area */}
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4">
          {empty ? (
            <Home specialty={specialty} starters={starters} onPick={(s) => send(specialtyPrompt(specialty, s))} />
          ) : (
            <div className="mx-auto flex max-w-[480px] flex-col gap-4 py-4">
              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="sib-rise self-end rounded-2xl rounded-br-md px-3.5 py-2.5 text-[14px]" style={{ background: 'var(--sib-accent)', color: '#fff', maxWidth: '85%' }}>
                    {m.text}
                  </div>
                ) : (
                  <div key={m.id} className="sib-rise sib-glass rounded-2xl p-4">
                    {m.answer ? (
                      <SibylAnswerView answer={m.answer} typeOut={m.typing} />
                    ) : (
                      <div className="whitespace-pre-wrap text-[14px] leading-relaxed sib-fg">
                        {m.text || <span className="sib-dot sib-faint">▋</span>}
                      </div>
                    )}
                    {(m.answer || (m.text && m.text.length > 3)) && !loading ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setSaveItem(
                              m.answer
                                ? { title: m.answer.verdict, body: answerToText(m.answer) }
                                : { title: (m.text ?? '').split('\n')[0]?.slice(0, 80) ?? 'Saved', body: m.text ?? '' },
                            )
                          }
                          className="sib-hover flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] sib-faint"
                        >
                          <BookmarkPlus className="h-3.5 w-3.5" /> Save to Space
                        </button>
                      </div>
                    ) : null}
                  </div>
                ),
              )}
              {loading && specialty === 'crypto' ? <LiveTrace stages={stages} veil={modelKey === 'veil'} attested={attested} /> : null}
            </div>
          )}
        </div>

        {/* composer */}
        <div className="relative z-20 px-3 pb-5 pt-2">
          <div className="mx-auto max-w-[480px]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="sib-glass flex flex-col gap-2 rounded-3xl px-3 py-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything privately…"
                className="w-full bg-transparent px-1 text-[15px] outline-none placeholder:text-[color:var(--sib-faint)]"
              />
              <div className="flex items-center gap-2">
                <button type="button" className="sib-hover rounded-full p-2" aria-label="Attach">
                  <Paperclip className="h-4 w-4 sib-muted" />
                </button>
                <button
                  type="button"
                  onClick={() => setModelSheet(true)}
                  className="sib-panel2 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium"
                >
                  {modelKey === 'veil' ? <Lock className="h-3 w-3" style={{ color: 'var(--sib-veil)' }} /> : <Sparkles className="h-3 w-3 sib-accent" />}
                  {activeModel.name}
                  <ChevronDown className="h-3 w-3 sib-faint" />
                </button>
                <div className="flex-1" />
                {loading ? (
                  <button type="button" onClick={stop} className="flex h-9 w-9 items-center justify-center rounded-full bg-white" aria-label="Stop">
                    <Square className="h-3.5 w-3.5 fill-black text-black" />
                  </button>
                ) : input.trim() ? (
                  <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'var(--sib-accent)' }} aria-label="Send">
                    <ArrowUp className="h-4 w-4 text-white" />
                  </button>
                ) : (
                  <button type="button" className="sib-hover flex h-9 w-9 items-center justify-center rounded-full" aria-label="Voice">
                    <Mic className="h-4 w-4 sib-muted" />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
        </>
        )}

        {drawer ? (
          <Drawer
            specialty={specialty}
            authenticated={authenticated}
            displayName={displayName}
            onSpecialty={(s) => { setSpecialty(s); setView('chat'); setDrawer(false); }}
            onSpaces={() => { setView('spaces'); setDrawer(false); }}
            onSignIn={() => { void login(); setDrawer(false); }}
            onUpgrade={() => { setUpgradeOpen(true); setDrawer(false); }}
            onClose={() => setDrawer(false)}
          />
        ) : null}
        {modelSheet ? <ModelSheet active={modelKey} onPick={(k) => { setModelKey(k); setModelSheet(false); }} onClose={() => setModelSheet(false)} /> : null}
        <SibylUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
        {saveItem ? <SaveSheet item={saveItem} onClose={() => setSaveItem(null)} /> : null}
      </div>
    </div>
  );
}

function specialtyPrompt(sp: Specialty, starter: string): string {
  return sp === 'crypto' ? `${starter}: ` : `${starter}: `;
}

function answerToText(a: SibylAnswer): string {
  return (
    a.body?.trim() ||
    [a.verdict, ...(a.why ?? []).map((w) => `• ${w}`), a.action].filter(Boolean).join('\n')
  );
}

function Home({ specialty, starters, onPick }: { specialty: Specialty; starters: string[]; onPick: (s: string) => void }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      {/* ambient background */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
        src="/sibyl/background.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(7,8,12,0.55), rgba(7,8,12,0.85))' }} />
      <div className="relative z-10 flex flex-col items-center text-center">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl sib-glass">
          <Sparkles className="h-6 w-6 sib-accent" />
        </span>
        <h1 className="text-[26px] font-semibold tracking-tight">
          {specialty === 'crypto' ? 'What are we hunting?' : 'Ask anything, privately.'}
        </h1>
        <p className="mt-1 text-[13px] sib-faint">
          {specialty === 'crypto' ? 'Crypto specialty — the Oracle Council.' : 'Sibyl by Pointer'}
        </p>
      </div>
      <div className="relative z-10 mt-7 flex flex-wrap justify-center gap-2 px-4">
        {starters.map((s) => (
          <button key={s} type="button" onClick={() => onPick(s)} className="sib-glass sib-hover rounded-full px-3.5 py-2 text-[12.5px]">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function LiveTrace({ stages, veil, attested }: { stages: Stage[]; veil: boolean; attested: boolean | null }) {
  return (
    <div className="sib-rise sib-glass flex flex-col gap-2 rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        {veil ? (
          <span className="text-[11px]" style={{ color: 'var(--sib-veil)' }}>
            {attested ? '🔒 Verified enclave' : 'Verifying enclave…'}
          </span>
        ) : (
          <>
            <span className="sib-dot h-1.5 w-1.5 rounded-full bg-white" />
            <span className="text-[13px] font-medium">Thinking…</span>
          </>
        )}
      </div>
      {stages.length ? (
        <div className="space-y-1 pt-0.5">
          {stages.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-[12px]">
              {s.status === 'done' ? <span className="text-emerald-400">✓</span> : <span className="sib-dot h-2.5 w-2.5 rounded-full border border-white/40" />}
              <span className={s.status === 'done' ? 'sib-faint' : 'sib-fg'}>{s.label}…</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Drawer({
  specialty, authenticated, displayName, onSpecialty, onSpaces, onSignIn, onUpgrade, onClose,
}: {
  specialty: Specialty;
  authenticated: boolean;
  displayName: string;
  onSpecialty: (s: Specialty) => void;
  onSpaces: () => void;
  onSignIn: () => void;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex">
      <div className="sib-glass sib-rise relative z-10 flex h-full w-[82%] max-w-[320px] flex-col p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[17px] font-semibold tracking-tight">Sibyl</span>
          <button type="button" onClick={onClose} className="sib-hover rounded-lg p-1.5" aria-label="Close">
            <X className="h-4 w-4 sib-muted" />
          </button>
        </div>
        <button type="button" className="sib-panel mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] sib-muted">
          <Search className="h-4 w-4" /> Search
        </button>
        <nav className="space-y-1">
          <DrawerItem active={specialty === 'general'} onClick={() => onSpecialty('general')} icon={<Sparkles className="h-4 w-4" />} label="Chat" />
          <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider sib-faint">Specialties</div>
          <DrawerItem active={specialty === 'crypto'} onClick={() => onSpecialty('crypto')} icon={<Bot className="h-4 w-4" />} label="Crypto" badge="Council" />
          <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider sib-faint">Library</div>
          <DrawerItem onClick={onSpaces} icon={<Coins className="h-4 w-4" />} label="Spaces" />
        </nav>
        <div className="mt-auto space-y-1 border-t sib-border pt-3">
          <DrawerItem onClick={onUpgrade} icon={<Sparkles className="h-4 w-4" />} label="Upgrade" />
          {/* account footer */}
          {authenticated ? (
            <div className="mt-2 flex items-center gap-2.5 rounded-xl sib-panel px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ background: 'var(--sib-accent)' }}>
                {displayName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium sib-fg">{displayName}</div>
                <div className="text-[10.5px] sib-faint">Signed in</div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="mt-2 w-full rounded-xl py-2.5 text-[13px] font-semibold text-white transition"
              style={{ background: 'var(--sib-accent)' }}
            >
              Sign in / Sign up
            </button>
          )}
        </div>
      </div>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
    </div>
  );
}

function DrawerItem({ active, disabled, icon, label, badge, onClick }: { active?: boolean; disabled?: boolean; icon: React.ReactNode; label: string; badge?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] transition ${active ? 'sib-panel2 sib-fg' : disabled ? 'sib-faint opacity-60' : 'sib-muted sib-hover'}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: 'rgba(109,94,252,0.18)', color: '#c4b5fd' }}>{badge}</span> : null}
    </button>
  );
}

function ModelSheet({ active, onPick, onClose }: { active: ModelKey; onPick: (k: ModelKey) => void; onClose: () => void }) {
  const rows: { key: ModelKey | null; name: string; note: string; tag: 'anon' | 'veil'; locked?: boolean }[] = [
    { key: 'oracle', name: SIBYL_MODELS.flagship.name, note: SIBYL_MODELS.flagship.blurb, tag: 'anon' },
    { key: 'veil', name: SIBYL_MODELS.veil.name, note: SIBYL_MODELS.veil.blurb, tag: 'veil' },
    { key: null, name: 'Oracle Pro', note: 'Deeper scans, adversarial verify', tag: 'anon', locked: true },
    { key: null, name: 'Deep Research', note: 'Long-horizon, many sources', tag: 'anon', locked: true },
  ];
  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="sib-glass sib-rise relative z-10 w-full rounded-t-3xl p-3 pb-6">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        {rows.map((r) => (
          <button
            key={r.name}
            type="button"
            disabled={r.locked}
            onClick={() => r.key && onPick(r.key)}
            className={`flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-3 text-left transition ${r.locked ? 'opacity-55' : active === r.key ? 'sib-panel2' : 'sib-hover'}`}
          >
            <div>
              <div className="text-[14px] font-medium sib-fg">{r.name}</div>
              <div className="text-[11.5px] sib-faint">{r.note}</div>
            </div>
            {r.locked ? (
              <Lock className="h-3.5 w-3.5 sib-faint" />
            ) : (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.tag === 'veil' ? 'sib-tag-veil' : 'sib-tag-anon'}`}>
                {r.tag === 'veil' ? '🔒 Private' : 'Anon'}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Spaces — local research folders. Nothing leaves the device (localStorage),
 * matching the privacy story. Folder list ⇄ folder detail (saved items).
 */
function SpacesView({ onBack }: { onBack: () => void }) {
  const { spaces, createSpace, deleteSpace, removeItem } = useSibylSpaces();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const open = spaces.find((s) => s.id === openId) ?? null;

  if (open) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mx-auto max-w-[480px]">
          <button type="button" onClick={() => setOpenId(null)} className="sib-hover mb-3 -ml-1 flex items-center gap-1 rounded-lg py-1 pr-2 text-[13px] sib-muted">
            <ChevronLeft className="h-4 w-4" /> Spaces
          </button>
          <div className="mb-4 flex items-center gap-2.5">
            <Folder className="h-5 w-5 sib-accent" />
            <h1 className="text-[20px] font-semibold tracking-tight">{open.name}</h1>
            <span className="text-[12px] sib-faint">{open.items.length}</span>
          </div>
          {open.items.length === 0 ? (
            <p className="mt-10 text-center text-[13px] sib-faint">Nothing saved here yet. Tap “Save to Space” on any answer.</p>
          ) : (
            <div className="space-y-2.5">
              {open.items.map((it) => (
                <div key={it.id} className="sib-glass rounded-2xl p-3.5">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="text-[13.5px] font-medium sib-fg">{it.title}</div>
                    <button type="button" onClick={() => removeItem(open.id, it.id)} className="sib-hover rounded-lg p-1" aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5 sib-faint" />
                    </button>
                  </div>
                  <div className="line-clamp-4 whitespace-pre-wrap text-[12.5px] leading-relaxed sib-muted">{it.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="mx-auto max-w-[480px]">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-[22px] font-semibold tracking-tight">Spaces</h1>
          <button type="button" onClick={() => setCreating((v) => !v)} className="sib-hover flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] sib-accent">
            <FolderPlus className="h-4 w-4" /> New
          </button>
        </div>
        <p className="mb-4 text-[12px] sib-faint">Your research folders — saved on this device only.</p>

        {creating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = newName.trim();
              if (!n) return;
              createSpace(n);
              setNewName('');
              setCreating(false);
            }}
            className="sib-glass mb-4 flex items-center gap-2 rounded-2xl px-3 py-2"
          >
            <Folder className="h-4 w-4 sib-faint" />
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Space name…"
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[color:var(--sib-faint)]"
            />
            <button type="submit" className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: 'var(--sib-accent)' }}>Add</button>
          </form>
        ) : null}

        {spaces.length === 0 ? (
          <div className="mt-12 flex flex-col items-center text-center">
            <Folder className="mb-3 h-8 w-8 sib-faint" />
            <p className="text-[13px] sib-faint">No spaces yet. Create one, then save answers into it.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {spaces.map((s) => (
              <div key={s.id} className="sib-glass sib-hover flex items-center gap-3 rounded-2xl px-3.5 py-3">
                <button type="button" onClick={() => setOpenId(s.id)} className="flex flex-1 items-center gap-3 text-left">
                  <Folder className="h-5 w-5 sib-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium sib-fg">{s.name}</div>
                    <div className="text-[11.5px] sib-faint">{s.items.length} saved</div>
                  </div>
                </button>
                <button type="button" onClick={() => deleteSpace(s.id)} className="sib-hover rounded-lg p-1.5" aria-label="Delete space">
                  <Trash2 className="h-4 w-4 sib-faint" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Bottom sheet to save an answer into a Space (pick existing or create). */
function SaveSheet({ item, onClose }: { item: { title: string; body: string }; onClose: () => void }) {
  const { spaces, createSpace, addItem } = useSibylSpaces();
  const [newName, setNewName] = useState('');
  const saveTo = (spaceId: string) => {
    addItem(spaceId, { title: item.title || 'Saved', body: item.body });
    onClose();
  };
  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="sib-glass sib-rise relative z-10 max-h-[70%] w-full overflow-y-auto rounded-t-3xl p-3 pb-6">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-2 px-1 text-[13px] font-semibold sib-fg">Save to Space</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = newName.trim();
            if (!n) return;
            saveTo(createSpace(n));
          }}
          className="sib-panel mb-2 flex items-center gap-2 rounded-2xl px-3 py-2"
        >
          <FolderPlus className="h-4 w-4 sib-faint" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New space…"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[color:var(--sib-faint)]"
          />
          {newName.trim() ? (
            <button type="submit" className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: 'var(--sib-accent)' }}>Create & save</button>
          ) : null}
        </form>
        {spaces.map((s) => (
          <button key={s.id} type="button" onClick={() => saveTo(s.id)} className="sib-hover flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left">
            <Folder className="h-5 w-5 sib-accent" />
            <span className="flex-1 text-[14px] sib-fg">{s.name}</span>
            <span className="text-[11.5px] sib-faint">{s.items.length}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
