/**
 * Hover overlay for smart-follower chips. X won't render its native HoverCard for
 * our custom chips, so we float our own Twitter-styled grey card on hover: the
 * follower's identity + their wallet PnL + a small realized-PnL sparkline (the
 * "trading view"). All real — profile → linked wallet → /api/ext/wallet analytics
 * (which now returns a true cumulative realized-PnL curve from indexed swaps).
 */
import { getWalletData } from '@/lib/walletData';

const SVGNS = 'http://www.w3.org/2000/svg';
const TW = {
  divider: 'rgb(47, 51, 54)',
  text: 'rgb(231, 233, 234)',
  muted: 'rgb(113, 118, 123)',
};
const UP = '#3ddc97';
const DOWN = '#f4615f';

let overlay: HTMLElement | null = null;
let showTimer: number | undefined;
let hideTimer: number | undefined;
let reqToken = 0;

type SF = { handle: string; name: string; badge?: string | null; avatar?: string | null };

export function attachFollowerHover(chip: HTMLElement, sf: SF): void {
  chip.addEventListener('pointerenter', () => {
    window.clearTimeout(hideTimer);
    window.clearTimeout(showTimer);
    showTimer = window.setTimeout(() => open(chip, sf), 170);
  });
  chip.addEventListener('pointerleave', () => {
    window.clearTimeout(showTimer);
    scheduleHide();
  });
}

function ensureOverlay(): HTMLElement {
  if (overlay) return overlay;
  const el = document.createElement('div');
  el.className = 'pt-fhov';
  Object.assign(el.style, {
    position: 'fixed',
    zIndex: '2147483646',
    width: '290px',
    boxSizing: 'border-box',
    padding: '12px 14px 13px',
    borderRadius: '16px',
    background: 'rgba(0,0,0,0.92)',
    backdropFilter: 'blur(14px)',
    border: `1px solid ${TW.divider}`,
    boxShadow: '0 12px 44px rgba(0,0,0,0.6)',
    color: TW.text,
    font: '13px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    opacity: '0',
    transition: 'opacity 120ms ease',
    display: 'none',
  } as CSSStyleDeclaration);
  el.addEventListener('pointerenter', () => window.clearTimeout(hideTimer));
  el.addEventListener('pointerleave', () => scheduleHide());
  document.body.appendChild(el);
  overlay = el;
  return el;
}

function scheduleHide(): void {
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (!overlay) return;
    overlay.style.opacity = '0';
    window.setTimeout(() => {
      if (overlay && overlay.style.opacity === '0') overlay.style.display = 'none';
    }, 140);
  }, 160);
}

function place(el: HTMLElement, anchor: HTMLElement): void {
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth || 252;
  const h = el.offsetHeight || 150;
  let left = r.left;
  let top = r.bottom + 8;
  if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
  if (left < 8) left = 8;
  if (top + h > window.innerHeight - 8) top = r.top - h - 8; // flip above when no room below
  el.style.left = `${Math.max(8, left)}px`;
  el.style.top = `${Math.max(8, top)}px`;
}

function open(anchor: HTMLElement, sf: SF): void {
  const el = ensureOverlay();
  const token = ++reqToken;
  el.textContent = '';

  // identity row
  const head = document.createElement('div');
  Object.assign(head.style, { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '11px' } as CSSStyleDeclaration);
  head.appendChild(avatarEl(sf.name, sf.avatar));
  const col = document.createElement('div');
  Object.assign(col.style, { display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' } as CSSStyleDeclaration);
  const nm = document.createElement('span');
  nm.textContent = sf.name;
  Object.assign(nm.style, { fontWeight: '700', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as CSSStyleDeclaration);
  const hh = document.createElement('span');
  hh.textContent = `@${sf.handle}`;
  Object.assign(hh.style, { fontSize: '12px', color: TW.muted } as CSSStyleDeclaration);
  col.append(nm, hh);
  head.appendChild(col);
  if (sf.badge) head.appendChild(pill(sf.badge));
  el.appendChild(head);

  // PnL tiles
  const grid = document.createElement('div');
  Object.assign(grid.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' } as CSSStyleDeclaration);
  const nw = statCell('Net worth');
  const pnl = statCell('Realized PnL');
  grid.append(nw.cell, pnl.cell);
  el.appendChild(grid);

  // chart slot
  const slot = document.createElement('div');
  Object.assign(slot.style, { minHeight: '66px' } as CSSStyleDeclaration);
  slot.appendChild(note('Loading PnL…'));
  el.appendChild(slot);

  el.style.display = 'block';
  requestAnimationFrame(() => {
    place(el, anchor);
    el.style.opacity = '1';
  });

  void (async () => {
    const d = await getWalletData(sf.handle).catch(() => undefined); // real, all wallets combined
    if (token !== reqToken) return;
    if (d === undefined) {
      slot.textContent = '';
      slot.appendChild(note('Couldn’t load — hover again'));
      place(el, anchor);
      return;
    }
    if (d?.name) nm.textContent = d.name; // avatar hovers pass only the handle
    if (!d) {
      nw.set('—');
      pnl.set('—', null);
      slot.textContent = '';
      slot.appendChild(note('No linked wallet'));
      place(el, anchor);
      return;
    }
    if (d.indexing) {
      nw.set('…');
      pnl.set('…', null);
      slot.textContent = '';
      slot.appendChild(note('Indexing trades — hover again in a moment'));
      place(el, anchor);
      return;
    }
    nw.set(d.netWorthUsd != null ? usd(d.netWorthUsd) : '—');
    pnl.set(d.realizedPnlUsd != null ? `${d.realizedPnlUsd >= 0 ? '+' : '−'}${usd(Math.abs(d.realizedPnlUsd))}` : '—', d.realizedPnlUsd ?? null);
    slot.textContent = '';
    if (d.chart.length >= 2) slot.appendChild(sparkline(d.chart));
    else slot.appendChild(note('Not enough trade history for a chart'));
    place(el, anchor);
  })();
}

/* ── builders ── */
function usd(n: number): string {
  const neg = n < 0;
  const a = Math.abs(n);
  const s = a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `$${a.toFixed(a < 1 && a > 0 ? 2 : 0)}`;
  return neg ? `-${s}` : s;
}

function statCell(label: string): { cell: HTMLElement; set: (v: string, signed?: number | null) => void } {
  const cell = document.createElement('div');
  Object.assign(cell.style, { padding: '7px 9px', borderRadius: '10px', border: `1px solid ${TW.divider}` } as CSSStyleDeclaration);
  const l = document.createElement('div');
  l.textContent = label;
  Object.assign(l.style, { fontSize: '9.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: TW.muted, marginBottom: '3px' } as CSSStyleDeclaration);
  const v = document.createElement('div');
  v.textContent = '…';
  Object.assign(v.style, { fontSize: '15px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' } as CSSStyleDeclaration);
  cell.append(l, v);
  return {
    cell,
    set: (val, signed) => {
      v.textContent = val;
      v.style.color = signed == null ? TW.text : signed > 0 ? UP : signed < 0 ? DOWN : TW.text;
    },
  };
}

function pill(text: string): HTMLElement {
  const el = document.createElement('span');
  el.textContent = text;
  Object.assign(el.style, { padding: '1px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.03em', color: '#c8ccff', background: 'rgba(124,131,255,0.16)', border: '1px solid rgba(124,131,255,0.45)', whiteSpace: 'nowrap' } as CSSStyleDeclaration);
  return el;
}

function note(text: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, { fontSize: '11px', color: TW.muted, textAlign: 'center', padding: '17px 0' } as CSSStyleDeclaration);
  return el;
}

function avatarEl(name: string, url?: string | null): HTMLElement {
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.referrerPolicy = 'no-referrer';
    Object.assign(img.style, { width: '30px', height: '30px', borderRadius: '999px', objectFit: 'cover', flex: '0 0 auto' } as CSSStyleDeclaration);
    img.onerror = () => img.replaceWith(initials(name));
    return img;
  }
  return initials(name);
}

function initials(name: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = (name.trim()[0] ?? '?').toUpperCase();
  Object.assign(el.style, { width: '30px', height: '30px', borderRadius: '999px', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#c8ccff', background: 'rgba(124,131,255,0.18)' } as CSSStyleDeclaration);
  return el;
}

/** Compact realized-PnL sparkline: zero baseline, area fill, green/red by sign. */
function sparkline(points: { v: number }[]): SVGElement {
  const W = 262;
  const H = 64;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  Object.assign(svg.style, { width: '100%', height: `${H}px`, display: 'block' } as CSSStyleDeclaration);

  const ys = points.map((p) => p.v);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);
  const px = (i: number) => (i / (points.length - 1)) * (W - 6) + 3;
  const py = (y: number) => H - 4 - ((y - minY) / ((maxY - minY) || 1)) * (H - 8);
  const last = ys[ys.length - 1] ?? 0;
  const color = last >= 0 ? UP : DOWN;
  const zeroY = py(0);

  const base = document.createElementNS(SVGNS, 'line');
  base.setAttribute('x1', '3');
  base.setAttribute('x2', String(W - 3));
  base.setAttribute('y1', zeroY.toFixed(1));
  base.setAttribute('y2', zeroY.toFixed(1));
  base.setAttribute('stroke', TW.divider);
  base.setAttribute('stroke-width', '1');
  base.setAttribute('stroke-dasharray', '2 3');
  svg.appendChild(base);

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(p.v).toFixed(1)}`).join(' ');
  const area = document.createElementNS(SVGNS, 'path');
  area.setAttribute('d', `${line} L ${px(points.length - 1).toFixed(1)} ${zeroY.toFixed(1)} L ${px(0).toFixed(1)} ${zeroY.toFixed(1)} Z`);
  area.setAttribute('fill', color);
  area.setAttribute('opacity', '0.12');
  svg.appendChild(area);

  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('d', line);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);

  return svg;
}
