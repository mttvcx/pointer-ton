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
 * PnL is REAL — realizedPnlUsd from getWalletData (all linked wallets combined,
 * one cached fetch per handle shared with the popup + hover chart).
 */
import { attachFollowerHover } from '@/lib/followerHover';
import { getWalletData } from '@/lib/walletData';

const SVGNS = 'http://www.w3.org/2000/svg';
const UP = '#3ddc97';
const DOWN = '#f4615f';
const PREFIX = 'UserAvatar-Container-';
const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose', 'hashtag', 'bookmarks', 'jobs', 'lists', 'communities', 'premium']);

const usd = (n: number): string => {
  const a = Math.abs(n);
  return a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `$${a.toFixed(0)}`;
};

export function startPnlRing(): void {
  const tick = () => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-testid^="${PREFIX}"]`))) {
      if (el.dataset.ptSkip || el.querySelector('.pt-pnl-ring')) continue;
      const handle = (el.getAttribute('data-testid') || '').slice(PREFIX.length).toLowerCase();
      if (!handle || RESERVED.has(handle)) {
        el.dataset.ptSkip = '1'; // reserved / no handle — never ring this element
        continue;
      }
      void applyTo(el, handle);
    }
  };
  window.setInterval(tick, 1500);
  tick();
}

// No local cache/markers on purpose: getWalletData is TTL-cached (short while a
// wallet is still indexing, long once final), so re-checking each tick is cheap
// and the ring self-populates the moment the on-demand backfill lands.
async function applyTo(el: HTMLElement, handle: string): Promise<void> {
  const d = await getWalletData(handle).catch(() => undefined);
  // transient / no wallet / no realized PnL yet → no ring (retry as the TTL expires)
  if (!d || d.realizedPnlUsd == null) return;
  if (el.isConnected && !el.querySelector('.pt-pnl-ring')) drawRing(el, handle, d.realizedPnlUsd);
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
  circle.setAttribute('stroke-width', minimal ? '4.5' : '3');
  svg.appendChild(circle);
  wrap.appendChild(svg);

  // value badge — shown on BOTH sizes (compact on small avatars)
  const badge = document.createElement('div');
  badge.textContent = `${up ? '+' : '−'}${usd(Math.abs(pnl))}`;
  Object.assign(badge.style, { position: 'absolute', left: '50%', bottom: minimal ? '-8px' : '-7px', transform: 'translateX(-50%)', background: color, color: '#000', fontSize: minimal ? '9px' : '11px', fontWeight: '800', padding: minimal ? '0 5px' : '1px 8px', borderRadius: '999px', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.5)', fontVariantNumeric: 'tabular-nums', border: minimal ? '1.5px solid #000' : '2px solid #000', lineHeight: minimal ? '1.45' : '1.5' } as CSSStyleDeclaration);
  wrap.appendChild(badge);

  // Rich portfolio popup only on the big header avatar (small ones use X's hovercard)
  if (!minimal) {
    const img = container.querySelector('img');
    attachFollowerHover(container, { handle, name: handle, badge: null, avatar: img?.getAttribute('src') ?? null });
  }

  container.appendChild(wrap);
}
