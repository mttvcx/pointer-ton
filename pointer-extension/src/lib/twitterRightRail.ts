/**
 * Right-rail profile card (the Ethos/Cupsey side panel). On an X profile page we
 * inject a Pointer card into the sidebar column, styled like Twitter's own
 * right-column cards (same border/radius/bg) — Pointer accent only on Pointer
 * content. Survives SPA navigation.
 */
import { pointer } from '@/pointer/client';
import type { ProfileSummary } from '@/ui/cards/ProfileCard';

const TW = { divider: 'rgb(47, 51, 54)', text: 'rgb(231, 233, 234)', muted: 'rgb(113, 118, 123)', btnBorder: 'rgb(83, 100, 113)', hover: 'rgba(231,233,234,0.03)' };
const PT_ACCENT = '#7c83ff';
const LOGO = chrome.runtime.getURL('pointer-bird.png');
const CARD_ID = 'pt-rail-card';
const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose', 'hashtag', 'bookmarks', 'jobs', 'lists', 'communities', 'premium']);
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
const explorer = (c: string, a: string) => (c === 'sol' || c === 'solana' ? `https://solscan.io/account/${a}` : `https://etherscan.io/address/${a}`);

export function startTwitterRightRail(): void {
  let current = '';
  const tick = () => {
    const handle = profileHandle();
    if (handle !== current) {
      current = handle;
      document.getElementById(CARD_ID)?.remove();
      if (handle) void inject(handle);
    } else if (handle && !document.getElementById(CARD_ID)) {
      void inject(handle); // sidebar re-rendered on scroll/nav
    }
  };
  window.setInterval(tick, 800);
  tick();
}

function profileHandle(): string {
  const m = /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(location.pathname);
  if (!m || !m[1]) return '';
  const h = m[1].toLowerCase();
  return RESERVED.has(h) ? '' : h;
}

const HEADINGS = ['Live on X', 'You might like', 'Who to follow', 'What’s happening', "What's happening", 'Subscribe to Premium', 'Trends for you', 'Get Verified', 'Relevant people'];

/** The first native section box (e.g. the "Live on X" card). We insert directly
 *  before it so Pointer lands at the top of the section list, in the scroll flow
 *  (not pinned behind the sticky search at y=0). */
function firstSectionBox(sidebar: HTMLElement): HTMLElement | null {
  let anchor: HTMLElement | null = null;
  for (const t of HEADINGS) {
    anchor = Array.from(sidebar.querySelectorAll<HTMLElement>('span, h2')).find((e) => !e.children.length && (e.textContent ?? '').trim() === t) ?? null;
    if (anchor) break;
  }
  if (!anchor) return null;
  // Climb to X's rounded section-card box (the ancestor with a non-zero
  // border-radius). We insert a SIBLING before it → Pointer's own separate,
  // full-width box, never nested inside another card.
  let el: HTMLElement | null = anchor;
  for (let i = 0; i < 12 && el && el !== sidebar; i++) {
    if (parseFloat(getComputedStyle(el).borderRadius || '0') >= 8) return el;
    el = el.parentElement;
  }
  return null;
}

async function inject(handle: string): Promise<void> {
  const sidebar = document.querySelector<HTMLElement>('[data-testid="sidebarColumn"]');
  if (!sidebar || document.getElementById(CARD_ID)) return;
  const box = firstSectionBox(sidebar);
  if (!box || !box.parentElement) return; // sidebar not ready — tick() retries
  const card = buildCard(handle);
  box.parentElement.insertBefore(card, box);

  const res = await pointer.profile(handle);
  fill(card, res.ok ? (res.data as unknown as ProfileSummary) : null, handle);
}

function buildCard(handle: string): HTMLElement {
  const card = document.createElement('div');
  card.id = CARD_ID;
  Object.assign(card.style, { width: '100%', boxSizing: 'border-box', margin: '0 0 16px', border: `1px solid ${TW.divider}`, borderRadius: '16px', overflow: 'hidden', font: 'inherit', color: TW.text } as CSSStyleDeclaration);
  const head = document.createElement('div');
  Object.assign(head.style, { display: 'flex', alignItems: 'center', gap: '7px', padding: '12px 16px 0' } as CSSStyleDeclaration);
  const img = document.createElement('img');
  img.src = LOGO;
  Object.assign(img.style, { width: '16px', height: '16px', objectFit: 'contain' } as CSSStyleDeclaration);
  const t = document.createElement('span');
  t.textContent = 'Pointer';
  Object.assign(t.style, { fontWeight: '800', fontSize: '15px' } as CSSStyleDeclaration);
  const hh = document.createElement('span');
  hh.textContent = `@${handle}`;
  Object.assign(hh.style, { marginLeft: 'auto', fontSize: '12px', color: TW.muted } as CSSStyleDeclaration);
  head.append(img, t, hh);
  const body = document.createElement('div');
  body.className = 'pt-rail-body';
  Object.assign(body.style, { padding: '12px 16px 14px' } as CSSStyleDeclaration);
  body.appendChild(textRow('Loading…'));
  card.append(head, body);
  return card;
}

function fill(card: HTMLElement, data: ProfileSummary | null, handle: string): void {
  const body = card.querySelector<HTMLElement>('.pt-rail-body');
  if (!body) return;
  body.textContent = '';

  if (!data || !data.found) {
    body.appendChild(textRow('Not in Pointer’s directory yet.'));
    body.appendChild(tagButton(handle, body));
    return;
  }

  const id = document.createElement('div');
  Object.assign(id.style, { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' } as CSSStyleDeclaration);
  const nm = document.createElement('span');
  nm.textContent = data.name ?? `@${handle}`;
  Object.assign(nm.style, { fontSize: '15px', fontWeight: '800' } as CSSStyleDeclaration);
  id.appendChild(nm);
  if (data.verified) {
    const v = document.createElement('span');
    v.textContent = '✓';
    Object.assign(v.style, { color: '#3ddc97' } as CSSStyleDeclaration);
    id.appendChild(v);
  }
  if (data.badge) id.appendChild(pill(data.badge));
  body.appendChild(id);

  if (data.wallets.length) {
    body.appendChild(label(`Linked wallets · ${data.wallets.length}`));
    for (const w of data.wallets.slice(0, 4)) {
      const row = document.createElement('a');
      row.href = explorer(w.chain, w.address);
      row.target = '_blank';
      row.rel = 'noreferrer';
      Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', textDecoration: 'none', color: TW.text, border: `1px solid ${TW.divider}`, marginBottom: '6px', fontSize: '13px' } as CSSStyleDeclaration);
      row.onmouseenter = () => (row.style.background = TW.hover);
      row.onmouseleave = () => (row.style.background = 'transparent');
      const a = document.createElement('span');
      a.textContent = short(w.address);
      Object.assign(a.style, { fontVariantNumeric: 'tabular-nums' } as CSSStyleDeclaration);
      const c = document.createElement('span');
      c.textContent = w.chain.toUpperCase();
      Object.assign(c.style, { marginLeft: 'auto', fontSize: '10px', fontWeight: '800', color: TW.muted } as CSSStyleDeclaration);
      const ar = document.createElement('span');
      ar.textContent = '↗';
      Object.assign(ar.style, { color: TW.muted } as CSSStyleDeclaration);
      row.append(a, c, ar);
      body.appendChild(row);
    }
  }

  // CA history — Pointer's own, built from the tweets we've scanned.
  if (data.cas && data.cas.length) {
    body.appendChild(label(`CA history · ${data.cas.length}`));
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' } as CSSStyleDeclaration);
    for (const c of data.cas.slice(0, 8)) {
      const chip = document.createElement('a');
      chip.href = c.chain === 'eth' ? `https://etherscan.io/token/${c.mint}` : `https://solscan.io/token/${c.mint}`;
      chip.target = '_blank';
      chip.rel = 'noreferrer';
      chip.textContent = `${c.mint.slice(0, 4)}…${c.mint.slice(-4)}`;
      Object.assign(chip.style, { fontSize: '11px', fontVariantNumeric: 'tabular-nums', padding: '3px 8px', borderRadius: '8px', textDecoration: 'none', color: TW.text, border: `1px solid ${TW.divider}` } as CSSStyleDeclaration);
      chip.onmouseenter = () => (chip.style.background = TW.hover);
      chip.onmouseleave = () => (chip.style.background = 'transparent');
      wrap.appendChild(chip);
    }
    body.appendChild(wrap);
  }

  const b = document.createElement('button');
  b.textContent = 'View profile';
  b.onclick = () => void pointer.profile(handle);
  Object.assign(b.style, { width: '100%', marginTop: '4px', boxSizing: 'border-box', padding: '10px 16px', borderRadius: '999px', border: '1px solid transparent', cursor: 'pointer', fontWeight: '800', fontSize: '14px', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff', background: 'linear-gradient(180deg,#8b8cf9,#7280ff)', boxShadow: '0 6px 18px -6px rgba(124,131,255,0.65), inset 0 1px 0 rgba(255,255,255,0.28)', font: 'inherit' } as CSSStyleDeclaration);
  body.appendChild(b);
}

/* ── builders ── */
function tagButton(handle: string, body: HTMLElement): HTMLElement {
  const b = document.createElement('button');
  b.textContent = `Tag @${handle}`;
  Object.assign(b.style, { width: '100%', boxSizing: 'border-box', padding: '10px 16px', borderRadius: '999px', border: '1px solid transparent', cursor: 'pointer', fontWeight: '800', fontSize: '14px', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff', background: 'linear-gradient(180deg,#8b8cf9,#7280ff)', boxShadow: '0 6px 18px -6px rgba(124,131,255,0.65), inset 0 1px 0 rgba(255,255,255,0.28)', font: 'inherit' } as CSSStyleDeclaration);
  b.onclick = () => {
    body.textContent = '';
    const input = document.createElement('input');
    input.placeholder = 'KOL · Dev · Scammer…';
    input.maxLength = 32;
    Object.assign(input.style, { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: '10px', fontSize: '14px', font: 'inherit', color: TW.text, background: 'transparent', border: `1px solid ${TW.btnBorder}`, outline: 'none', marginBottom: '8px' } as CSSStyleDeclaration);
    const save = async () => {
      const v = input.value.trim();
      if (!v) return;
      const res = await pointer.submitLabel('handle', handle, v, 'kol');
      body.textContent = '';
      body.appendChild(textRow(res.ok ? `Tagged @${handle} as “${v}”. Public once others agree.` : 'Couldn’t submit — retry.'));
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && void save());
    const sb = document.createElement('button');
    sb.textContent = 'Save tag';
    Object.assign(sb.style, { width: '100%', boxSizing: 'border-box', padding: '10px 16px', borderRadius: '999px', border: '1px solid transparent', cursor: 'pointer', fontWeight: '800', fontSize: '13px', lineHeight: '1.2', whiteSpace: 'nowrap', color: '#fff', background: 'linear-gradient(180deg,#8b8cf9,#7280ff)', boxShadow: '0 6px 18px -6px rgba(124,131,255,0.6), inset 0 1px 0 rgba(255,255,255,0.28)', font: 'inherit' } as CSSStyleDeclaration);
    sb.onclick = () => void save();
    body.append(input, sb);
    setTimeout(() => input.focus(), 0);
  };
  return b;
}
function pill(text: string): HTMLElement {
  const el = document.createElement('span');
  el.textContent = text;
  Object.assign(el.style, { padding: '1px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.03em', color: '#c8ccff', background: 'rgba(124,131,255,0.16)', border: `1px solid rgba(124,131,255,0.45)` } as CSSStyleDeclaration);
  return el;
}
function label(text: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, { fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: TW.muted, margin: '0 0 7px' } as CSSStyleDeclaration);
  return el;
}
function textRow(text: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, { fontSize: '13px', color: TW.muted, margin: '0 0 10px' } as CSSStyleDeclaration);
  return el;
}
