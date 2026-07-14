/** Topbar wallet chip — rounded pill; sharp chrome is for the dropdown panel only. */
export const WALLET_TOPBAR_TRIGGER =
  'focus-ring flex h-8 shrink-0 items-center gap-2 rounded-lg border border-[#2e2e32] bg-[#2a2a2d] px-2.5 text-white hover:bg-[#333338]';

/** Axiom-style wallet dropdown — sharp rectangular popup. z-[240] clears the
 *  sticky topbar (z-[230]) so the panel is never painted under it. */
export const AXIOM_WALLET_PANEL =
  'z-[240] flex w-[280px] flex-col overflow-hidden rounded-sm border border-[#2e2e32] bg-[#141414] p-0 shadow-[0_8px_28px_rgba(0,0,0,0.72)]';

export const AXIOM_WALLET_TAB_TRACK =
  'flex flex-1 items-stretch gap-px overflow-hidden rounded-sm border border-[#2e2e32] bg-[#0c0c0e] p-px';

export const AXIOM_WALLET_TAB_BTN =
  'flex flex-1 items-center justify-center gap-1 rounded-[2px] py-1.5 text-[11px] font-semibold transition-colors';

export const AXIOM_WALLET_TAB_ACTIVE = 'bg-[#2a2a2e] text-white';

export const AXIOM_WALLET_TAB_IDLE = 'text-[#888892] hover:text-[#c4c4c8]';

export const AXIOM_DEPOSIT_BTN =
  'flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-[#5865F2] py-2 text-[13px] font-semibold text-white transition-colors hover:brightness-110';

export const AXIOM_WITHDRAW_BTN =
  'flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-[#3d3d42] bg-transparent py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1e1e22]';
