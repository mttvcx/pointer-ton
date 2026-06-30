/**
 * Ethos-style ring around the profile avatar — but showing the account's wallet
 * PnL instead of a credibility score. Green ring + badge when up, red when down.
 * Sits just OUTSIDE the avatar (inset -5px) so if Ethos already drew a ring, ours
 * goes around it. No connected wallet → no ring at all.
 *
 * PnL value is DEMO for now (deterministic per handle) so the look can be locked;
 * swap demoPnl() for the real /api/ext/wallet realizedPnlUsd once approved.
 */
import { pointer } from '@/pointer/client';
import type { ProfileIntel } from '@/pointer/types';

const SVGNS = 'http://www.w3.org/2000/svg';
const UP = '#3ddc97';
const DOWN = '#f4615f';
const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose', 'hashtag', 'bookmarks', 'jobs', 'lists', 'communities', 'premium']);

const usd = (n: number): string => {
  const a = Math.abs(n);
  return a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `$${a.toFixed(0)}`;
};

function profileHandle(): string {
  const m = /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(location.pathname);
  if (!m || !m[1]) return '';
  const h = m[1].toLowerCase();
  return RESERVED.has(h) ? '' : h;
}

/** The large profile-header avatar (the biggest UserAvatar in the primary column). */
function headerAvatar(): HTMLElement | null {
  const pc = document.querySelector('[data-testid="primaryColumn"]');
  if (!pc) return null;
  let best: HTMLElement | null = null;
  let bw = 0;
  for (const e of Array.from(pc.querySelectorAll<HTMLElement>('[data-testid^="UserAvatar-Container-"]'))) {
    const w = e.getBoundingClientRect().width;
    if (w > bw) {
      bw = w;
      best = e;
    }
  }
  return bw >= 80 ? best : null;
}

// handle → realized PnL (null = no wallet / no data → no ring). Cached per session.
const pnlCache = new Map<string, number | null>();

export function startPnlRing(): void {
  const tick = () => {
    const handle = profileHandle();
    if (!handle) return;
    const av = headerAvatar();
    if (!av || av.querySelector('.pt-pnl-ring')) return; // none, or already drawn
    void apply(handle);
  };
  window.setInterval(tick, 800);
  tick();
}

async function apply(handle: string): Promise<void> {
  let pnl = pnlCache.get(handle);
  if (pnl === undefined) {
    const pr = await pointer.profile(handle);
    const prof = pr.ok ? (pr.data as ProfileIntel) : null;
    const hasWallet = !!(prof?.wallets && prof.wallets.length);
    pnl = hasWallet ? demoPnl(handle) : null; // DEMO until wired to real realizedPnlUsd
    pnlCache.set(handle, pnl);
  }
  if (pnl == null) return; // no wallet → no ring
  if (profileHandle() !== handle) return; // navigated away mid-fetch
  const av = headerAvatar();
  if (av) drawRing(av, pnl);
}

/** Deterministic demo PnL per handle (≈ -8k…+40k, biased positive). */
function demoPnl(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return Math.round((h >>> 0) / 4294967296 * 48000 - 8000);
}

function drawRing(container: HTMLElement, pnl: number): void {
  if (container.querySelector('.pt-pnl-ring')) return;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const up = pnl >= 0;
  const color = up ? UP : DOWN;

  const wrap = document.createElement('div');
  wrap.className = 'pt-pnl-ring';
  Object.assign(wrap.style, { position: 'absolute', inset: '-5px', borderRadius: '999px', pointerEvents: 'none', zIndex: '3' } as CSSStyleDeclaration);

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  Object.assign(svg.style, { width: '100%', height: '100%', display: 'block', filter: `drop-shadow(0 0 3px ${color}66)` } as CSSStyleDeclaration);
  const circle = document.createElementNS(SVGNS, 'circle');
  circle.setAttribute('cx', '50');
  circle.setAttribute('cy', '50');
  circle.setAttribute('r', '47.5');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', color);
  circle.setAttribute('stroke-width', '3');
  svg.appendChild(circle);
  wrap.appendChild(svg);

  const badge = document.createElement('div');
  badge.textContent = `${up ? '+' : '−'}${usd(Math.abs(pnl))}`;
  Object.assign(badge.style, { position: 'absolute', left: '50%', bottom: '-7px', transform: 'translateX(-50%)', background: color, color: '#000', fontSize: '11px', fontWeight: '800', padding: '1px 8px', borderRadius: '999px', whiteSpace: 'nowrap', boxShadow: '0 2px 7px rgba(0,0,0,0.5)', fontVariantNumeric: 'tabular-nums', border: '2px solid #000' } as CSSStyleDeclaration);
  wrap.appendChild(badge);

  container.appendChild(wrap);
}
