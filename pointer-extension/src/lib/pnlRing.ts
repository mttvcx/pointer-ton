/**
 * Ethos-style ring around EVERY avatar (profile header + timeline), showing the
 * account's wallet PnL instead of a credibility score. Green ring when up, red
 * when down. Each avatar's handle comes from its `data-testid`
 * (UserAvatar-Container-<handle>), so timeline avatars get a minimal ring too.
 *
 * - Big header avatar (≥80px): full ring + value badge, and hovering it opens the
 *   rich portfolio popup (X shows no hovercard on the profile's own avatar).
 * - Small avatars (<80px): minimal ring only — hovering them already triggers X's
 *   native hovercard (which carries our PnL chart), so no extra popup.
 * - No connected wallet → no ring. Sits just outside the avatar so it wraps an
 *   Ethos ring if present.
 *
 * PnL is DEMO for now (deterministic per handle) until wired to real realizedPnlUsd.
 */
import { pointer } from '@/pointer/client';
import type { ProfileIntel } from '@/pointer/types';
import { attachFollowerHover } from '@/lib/followerHover';

const SVGNS = 'http://www.w3.org/2000/svg';
const UP = '#3ddc97';
const DOWN = '#f4615f';
const PREFIX = 'UserAvatar-Container-';
const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose', 'hashtag', 'bookmarks', 'jobs', 'lists', 'communities', 'premium']);

const usd = (n: number): string => {
  const a = Math.abs(n);
  return a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `$${a.toFixed(0)}`;
};

// handle → PnL (null = no wallet → no ring). Cached so each handle is fetched once.
const pnlCache = new Map<string, number | null>();

export function startPnlRing(): void {
  const tick = () => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-testid^="${PREFIX}"]`))) {
      if (el.dataset.ptNoRing || el.querySelector('.pt-pnl-ring')) continue;
      const handle = (el.getAttribute('data-testid') || '').slice(PREFIX.length).toLowerCase();
      if (!handle || RESERVED.has(handle)) {
        el.dataset.ptNoRing = '1';
        continue;
      }
      void applyTo(el, handle);
    }
  };
  window.setInterval(tick, 900);
  tick();
}

async function applyTo(el: HTMLElement, handle: string): Promise<void> {
  let pnl = pnlCache.get(handle);
  if (pnl === undefined) {
    const pr = await pointer.profile(handle);
    const prof = pr.ok ? (pr.data as ProfileIntel) : null;
    pnl = prof?.wallets && prof.wallets.length ? demoPnl(handle) : null; // DEMO until wired
    pnlCache.set(handle, pnl);
  }
  if (pnl == null) {
    el.dataset.ptNoRing = '1'; // no wallet → never ring this one
    return;
  }
  if (el.isConnected && !el.querySelector('.pt-pnl-ring')) drawRing(el, handle, pnl);
}

/** Deterministic demo PnL per handle (≈ -8k…+40k, biased positive). */
function demoPnl(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return Math.round((h >>> 0) / 4294967296 * 48000 - 8000);
}

function drawRing(container: HTMLElement, handle: string, pnl: number): void {
  if (container.querySelector('.pt-pnl-ring')) return;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const size = container.getBoundingClientRect().width;
  const minimal = size < 80;
  const up = pnl >= 0;
  const color = up ? UP : DOWN;

  const wrap = document.createElement('div');
  wrap.className = 'pt-pnl-ring';
  Object.assign(wrap.style, { position: 'absolute', inset: minimal ? '-2px' : '-5px', borderRadius: '999px', pointerEvents: 'none', zIndex: '3' } as CSSStyleDeclaration);

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  Object.assign(svg.style, { width: '100%', height: '100%', display: 'block', filter: `drop-shadow(0 0 ${minimal ? 2 : 3}px ${color}66)` } as CSSStyleDeclaration);
  const circle = document.createElementNS(SVGNS, 'circle');
  circle.setAttribute('cx', '50');
  circle.setAttribute('cy', '50');
  circle.setAttribute('r', '47.5');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', color);
  circle.setAttribute('stroke-width', minimal ? '3.5' : '3');
  svg.appendChild(circle);
  wrap.appendChild(svg);

  if (!minimal) {
    const badge = document.createElement('div');
    badge.textContent = `${up ? '+' : '−'}${usd(Math.abs(pnl))}`;
    Object.assign(badge.style, { position: 'absolute', left: '50%', bottom: '-7px', transform: 'translateX(-50%)', background: color, color: '#000', fontSize: '11px', fontWeight: '800', padding: '1px 8px', borderRadius: '999px', whiteSpace: 'nowrap', boxShadow: '0 2px 7px rgba(0,0,0,0.5)', fontVariantNumeric: 'tabular-nums', border: '2px solid #000' } as CSSStyleDeclaration);
    wrap.appendChild(badge);
    // Rich portfolio popup on hover (the profile's own avatar — X shows no hovercard here)
    const img = container.querySelector('img');
    attachFollowerHover(container, { handle, name: handle, badge: null, avatar: img?.getAttribute('src') ?? null });
  }

  container.appendChild(wrap);
}
