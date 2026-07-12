'use client';

import { useState } from 'react';
import { sibylSerif } from '@/components/sibyl/fonts';

export type ThemeChoice = 'system' | 'light' | 'dark';

type Section = 'general' | 'appearance' | 'data' | 'account' | 'about';

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z' },
  { id: 'appearance', label: 'Appearance', icon: 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a2.5 2.5 0 0 1-4.9-.64 2.5 2.5 0 0 0-2.5-2.5A2.5 2.5 0 0 1 11 5a9 9 0 0 0-.5-2Z' },
  { id: 'data', label: 'Data & privacy', icon: 'M12 2 4 6v6c0 5 3.4 7.7 8 10 4.6-2.3 8-5 8-10V6l-8-4Z' },
  { id: 'account', label: 'Account', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' },
  { id: 'about', label: 'About', icon: 'M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z' },
];

function Ico({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b s-border py-3.5 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium s-fg">{title}</div>
        {desc ? <div className="mt-0.5 text-[11.5px] leading-snug s-faint">{desc}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`flex h-[22px] w-[38px] items-center rounded-full px-0.5 transition ${on ? '' : 's-panel2'}`} style={on ? { background: 'var(--s-accent)' } : undefined}>
      <span className={`h-[18px] w-[18px] rounded-full bg-white shadow transition ${on ? 'translate-x-[16px]' : ''}`} />
    </span>
  );
}

export function SibylSettingsModal({
  open,
  onClose,
  theme,
  onTheme,
  statusLine,
  memory,
  onBackup,
  onRestore,
  onClear,
  onUpgrade,
  authenticated,
  accountName,
  onSignIn,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  theme: ThemeChoice;
  onTheme: (t: ThemeChoice) => void;
  statusLine: string;
  memory: { scans: number; entities: number; resolved: number } | null;
  onBackup: () => void;
  onRestore: () => void;
  onClear: () => void;
  onUpgrade: () => void;
  authenticated: boolean;
  accountName: string;
  onSignIn: () => void;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<Section>('general');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="fade-in absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="modal-in menu-glass relative z-10 flex h-[560px] max-h-[92vh] w-full max-w-[760px] overflow-hidden rounded-3xl border s-border shadow-2xl">
        {/* left nav */}
        <div className="flex w-[200px] shrink-0 flex-col border-r s-border p-3">
          <div className={`${sibylSerif.className} px-2 py-2 text-[18px] tracking-tight s-fg`}>Settings</div>
          <div className="mt-1 space-y-0.5">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setSection(n.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition h-panel2 ${section === n.id ? 's-panel2 s-fg' : 's-muted h-fg'}`}
              >
                <Ico d={n.icon} /> {n.label}
              </button>
            ))}
          </div>
          <div className="mt-auto px-2 pt-3 text-[10px] s-faint">Sibyl 7.0 · preview</div>
        </div>

        {/* right pane */}
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold s-fg">{NAV.find((n) => n.id === section)?.label}</h3>
            <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full s-panel2 text-[13px] s-fg transition h-panel2">✕</button>
          </div>

          {section === 'general' ? (
            <div>
              <Row title="Default engine" desc="Sibyl routes to the right specialists automatically. Higher tiers unlock deeper reasoning.">
                <span className="rounded-lg s-panel2 px-2.5 py-1.5 text-[12px] font-medium s-fg">Sibyl 7.0</span>
              </Row>
              <Row title="Underlying model" desc="Sibyl always presents as one engine — the provider stack stays masked.">
                <span className="text-[11px] s-faint">Masked · always on</span>
              </Row>
              <Row title="Streaming responses" desc="Show specialist reasoning as it resolves.">
                <Toggle on />
              </Row>
              <Row title="Send on Enter" desc="Enter sends; Shift+Enter adds a newline.">
                <Toggle on />
              </Row>
            </div>
          ) : null}

          {section === 'appearance' ? (
            <div>
              <Row title="Theme" desc="System follows your device. Dark shows the animated hero.">
                <div className="grid grid-cols-3 gap-0.5 rounded-lg s-panel2 p-0.5">
                  {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
                    <button key={t} type="button" onClick={() => onTheme(t)} className={`rounded-md px-3 py-1 text-[11px] font-medium capitalize transition ${theme === t ? 's-panel2 s-fg' : 's-muted h-fg'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </Row>
              <Row title="Accent" desc="Sibyl blue — used for actions and highlights.">
                <span className="h-5 w-5 rounded-full ring-1 s-border" style={{ background: 'var(--s-accent)' }} />
              </Row>
              <Row title="Animated background" desc="The field-of-grass hero on the entry screen (dark only).">
                <Toggle on={theme !== 'light'} />
              </Row>
            </div>
          ) : null}

          {section === 'data' ? (
            <div>
              <Row title="Backup chat history" desc="Download every saved chat as a JSON file. Chats live in this browser only.">
                <button type="button" onClick={onBackup} className="rounded-lg s-panel2 px-3 py-1.5 text-[12px] font-medium s-fg transition h-panel2">Download</button>
              </Row>
              <Row title="Restore chat history" desc="Import a backup file — chats merge into what's already here.">
                <button type="button" onClick={onRestore} className="rounded-lg s-panel2 px-3 py-1.5 text-[12px] font-medium s-fg transition h-panel2">Import</button>
              </Row>
              <Row title="Clear all chats" desc="Permanently delete every chat in this browser. Can't be undone.">
                <button type="button" onClick={onClear} className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[12px] font-medium text-rose-400 transition hover:bg-rose-500/20">Clear</button>
              </Row>
              <div className="mt-4 rounded-xl s-panel2 p-3 text-[11px] leading-relaxed s-faint">
                Sibyl keeps your chats on-device (localStorage). Nothing is uploaded until you sign in and enable sync.
              </div>
            </div>
          ) : null}

          {section === 'account' ? (
            <div>
              <div className="mb-4 flex items-center gap-3 rounded-xl s-panel2 p-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full s-panel2 s-muted">
                  <Ico d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium s-fg">{authenticated ? accountName : 'Guest'}</div>
                  <div className="text-[11px] s-faint">{authenticated ? 'Free plan · signed in' : 'Free plan · not signed in'}</div>
                </div>
                {authenticated ? (
                  <button type="button" onClick={onLogout} className="ml-auto rounded-lg border s-border px-3 py-1.5 text-[12px] font-medium s-fg transition h-panel2">
                    Log out
                  </button>
                ) : (
                  <button type="button" onClick={onSignIn} className="ml-auto rounded-lg px-3 py-1.5 text-[12px] font-semibold text-black transition hover:opacity-90" style={{ background: 'var(--s-accent)' }}>
                    Sign in
                  </button>
                )}
              </div>
              <Row title="Plan" desc="Upgrade for deeper scans, memory recall, and API access.">
                <button type="button" onClick={onUpgrade} className="rounded-lg s-panel2 px-3 py-1.5 text-[12px] font-medium s-fg transition h-panel2">Upgrade plan</button>
              </Row>
              <Row title="Purchase credits" desc="Top up scan credits without changing plans (Max & API).">
                <button type="button" onClick={onUpgrade} className="rounded-lg s-panel2 px-3 py-1.5 text-[12px] font-medium s-fg transition h-panel2">Buy credits</button>
              </Row>
              <Row title="API access" desc="Public /v1 API is included with Max & Enterprise.">
                <span className="text-[11px] s-faint">Max & Enterprise</span>
              </Row>
            </div>
          ) : null}

          {section === 'about' ? (
            <div>
              <Row title="Version" desc="Sibyl by Pointer — crypto intelligence engine.">
                <span className="text-[12px] s-fg">7.0 preview</span>
              </Row>
              <Row title="Live status">
                <span className="flex items-center gap-1.5 text-[11px] s-faint">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {statusLine || 'checking…'}
                </span>
              </Row>
              {memory ? (
                <Row title="Flywheel memory" desc="What Sibyl has learned and graded so far.">
                  <span className="text-[11px] s-faint">{memory.scans.toLocaleString()} scans · {memory.entities.toLocaleString()} remembered · {memory.resolved.toLocaleString()} graded</span>
                </Row>
              ) : null}
              <div className="mt-4 flex gap-2">
                <a href="https://pointer.am" target="_blank" rel="noreferrer" className="flex-1 rounded-lg s-panel2 px-3 py-2 text-center text-[12px] font-medium s-fg transition h-panel2">Home</a>
                <a href="https://discord.gg" target="_blank" rel="noreferrer" className="flex-1 rounded-lg s-panel2 px-3 py-2 text-center text-[12px] font-medium s-fg transition h-panel2">Discord</a>
                <a href="https://x.com" target="_blank" rel="noreferrer" className="flex-1 rounded-lg s-panel2 px-3 py-2 text-center text-[12px] font-medium s-fg transition h-panel2">X / Twitter</a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
