'use client';

import { useState } from 'react';
import { PLANS } from '@/sibyl/pricing';
import type { PlanTier } from '@/sibyl/types';
import { sibylSerif } from '@/components/sibyl/fonts';

type PlanUi = { tagline: string; highlight?: boolean; badge?: string; cta: string; features: string[] };

const UI: Record<PlanTier, PlanUi> = {
  FREE: {
    tagline: 'Start scanning',
    cta: 'Current plan',
    features: ['Starter token usage', 'Quick scans', 'KOL-registry wallet labels', 'Live chain + CT data', 'Rug-risk grading'],
  },
  PRO: {
    tagline: 'For active traders',
    cta: 'Upgrade to Pro',
    features: ['Everything in Free', 'Default token usage', 'Standard scans — full specialist fan-out', 'Flywheel memory recall', '5 deep scans / day', 'Priority speed'],
  },
  PRO_PLUS: {
    tagline: 'The serious edge',
    highlight: true,
    badge: 'Popular',
    cta: 'Upgrade to Pro+',
    features: ['Everything in Pro', 'Generous token usage', 'Deep scans w/ adversarial verify', '40 deep scans / day', 'Saved scans + history', 'Early access to new agents'],
  },
  MAX: {
    tagline: 'Desk-grade intelligence',
    cta: 'Upgrade to Max',
    features: ['Everything in Pro+', 'Max token usage', 'Research reports', '200 deep scans / day', '5,000 API credits', 'Public API (/v1) access', 'Priority support'],
  },
  ENTERPRISE: {
    tagline: 'For funds & platforms',
    cta: 'Contact sales',
    features: ['Custom volume + SLA', 'Dedicated data feeds', 'Private / on-prem deploy', 'White-glove onboarding'],
  },
};

const CARDS: PlanTier[] = ['FREE', 'PRO', 'PRO_PLUS', 'MAX'];

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function SibylUpgradeModal({ open, onClose, currentTier = 'FREE' }: { open: boolean; onClose: () => void; currentTier?: PlanTier }) {
  const [annual, setAnnual] = useState(false);
  if (!open) return null;

  const priceLabel = (t: PlanTier): { big: string; sub: string } | null => {
    const m = PLANS[t].priceUsdMonthly;
    if (m == null) return null;
    if (m === 0) return { big: '$0', sub: 'free forever' };
    const val = annual ? Math.round((m * 10) / 12) : m;
    return { big: `$${val}`, sub: annual ? '/mo · billed yearly' : '/month' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="fade-in absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div className="modal-in relative z-10 flex max-h-[92vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d12]/95 shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white">
          ✕
        </button>

        <div className="overflow-y-auto px-6 py-8 md:px-10">
          <div className="text-center">
            <h2 className={`${sibylSerif.className} text-[34px] leading-tight tracking-tight text-white`}>Choose your plan</h2>
            <p className="mx-auto mt-2 max-w-[460px] text-[13px] leading-relaxed text-white/55">Sibyl gets sharper the more you scan. Upgrade for deeper scans, persistent memory, and API access — margins stay high, so pricing stays fair.</p>
          </div>

          {/* billing toggle */}
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.05] p-0.5 text-[12px]">
              <button type="button" onClick={() => setAnnual(false)} className={`rounded-full px-3.5 py-1.5 font-medium transition ${!annual ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'}`}>
                Monthly
              </button>
              <button type="button" onClick={() => setAnnual(true)} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition ${annual ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'}`}>
                Yearly <span className="s-accent text-[10px]">−17%</span>
              </button>
            </div>
          </div>

          {/* plan cards */}
          <div className="stagger mt-7 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {CARDS.map((t) => {
              const ui = UI[t];
              const p = PLANS[t];
              const pr = priceLabel(t);
              const isCurrent = t === currentTier;
              return (
                <div
                  key={t}
                  className={`relative flex flex-col rounded-2xl border p-5 ${ui.highlight ? 'border-[color:var(--s-accent)]/60 bg-white/[0.05]' : 'border-white/10 bg-white/[0.025]'}`}
                >
                  {ui.badge ? (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-black" style={{ background: 'var(--s-accent)' }}>
                      {ui.badge}
                    </span>
                  ) : null}
                  <div className={`${sibylSerif.className} text-[22px] leading-none text-white`}>{p.label}</div>
                  <div className="mt-1 text-[11.5px] text-white/45">{ui.tagline}</div>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    {pr ? (
                      <>
                        <span className="text-[30px] font-semibold tracking-tight text-white">{pr.big}</span>
                        <span className="text-[11px] text-white/45">{pr.sub}</span>
                      </>
                    ) : (
                      <span className="text-[22px] font-semibold text-white">Custom</span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isCurrent}
                    className={`mt-4 w-full rounded-xl py-2 text-[12.5px] font-semibold transition ${
                      isCurrent
                        ? 'cursor-default border border-white/10 text-white/45'
                        : ui.highlight
                          ? 'text-black hover:opacity-90'
                          : 'border border-white/15 text-white hover:bg-white/10'
                    }`}
                    style={ui.highlight && !isCurrent ? { background: 'var(--s-accent)' } : undefined}
                  >
                    {isCurrent ? 'Current plan' : ui.cta}
                  </button>

                  <ul className="mt-5 space-y-2">
                    {ui.features.map((f) => (
                      <li key={f} className="flex gap-2 text-[12px] leading-snug text-white/70">
                        <span className={ui.highlight ? 's-accent' : 'text-emerald-400'}>
                          <Check />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* enterprise + API strip */}
          <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4 sm:flex-row">
            <div>
              <div className="text-[14px] font-semibold text-white">Enterprise & API</div>
              <div className="mt-0.5 text-[12px] text-white/50">{UI.ENTERPRISE.features.join(' · ')}</div>
            </div>
            <button type="button" className="shrink-0 rounded-xl border border-white/15 px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-white/10">
              Contact sales
            </button>
          </div>

          <div className="mt-5 text-center text-[11px] text-white/30">Billing launches soon — this is a preview of Sibyl’s plans. No charge yet.</div>
        </div>
      </div>
    </div>
  );
}
