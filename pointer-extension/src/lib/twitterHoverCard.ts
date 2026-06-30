/**
 * Integrate Pointer INTO Twitter's native hover card (the Ethos approach) — never
 * a competing floating card. When X renders its `[data-testid="HoverCard"]`
 * profile preview, we append a Pointer panel INSIDE it, reusing Twitter's own
 * outline / divider / bg so it reads as native. Pointer's accent (violet) is the
 * only non-native colour, exactly where Pointer content lives.
 */
import { pointer } from '@/pointer/client';
import type { ProfileSummary } from '@/ui/cards/ProfileCard';
import type { WalletIntel } from '@/pointer/types';

// Twitter's own tokens — match the native card so the panel is seamless.
const TW = {
  divider: 'rgb(47, 51, 54)',
  text: 'rgb(231, 233, 234)',
  muted: 'rgb(113, 118, 123)',
  btnBorder: 'rgb(83, 100, 113)',
  hover: 'rgba(231,233,234,0.03)',
};
const PT_ACCENT = '#7c83ff';
const LOGO = chrome.runtime.getURL('pointer-bird.png');
const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose', 'hashtag']);

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
const explorer = (chain: string, a: string) => (chain === 'sol' || chain === 'solana' ? `https://solscan.io/account/${a}` : `https://etherscan.io/address/${a}`);
const usd = (n: number): string => {
  const neg = n < 0;
  const a = Math.abs(n);
  const s = a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `$${a.toFixed(a < 1 && a > 0 ? 2 : 0)}`;
  return neg ? `-${s}` : s;
};

/** A bordered metric tile (label + value) with a `set(value, signed?)` to repaint on toggle. */
function statCell(label: string, value: string): { cell: HTMLElement; set: (v: string, signed?: number | null) => void } {
  const cell = document.createElement('div');
  Object.assign(cell.style, { flex: '1', padding: '7px 9px', borderRadius: '9px', border: `1px solid ${TW.divider}` } as CSSStyleDeclaration);
  const l = document.createElement('div');
  l.textContent = label;
  Object.assign(l.style, { fontSize: '9.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: TW.muted, marginBottom: '3px' } as CSSStyleDeclaration);
  const v = document.createElement('div');
  v.textContent = value;
  Object.assign(v.style, { fontSize: '14px', fontWeight: '700', color: TW.text, fontVariantNumeric: 'tabular-nums' } as CSSStyleDeclaration);
  cell.append(l, v);
  const set = (val: string, signed?: number | null) => {
    v.textContent = val;
    v.style.color = signed == null ? TW.text : signed > 0 ? '#3ddc97' : signed < 0 ? '#f4615f' : TW.text;
  };
  return { cell, set };
}

export function startTwitterHoverCard(): void {
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const node of Array.from(m.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        const card = node.matches('[data-testid="HoverCard"]') ? node : node.querySelector<HTMLElement>('[data-testid="HoverCard"]');
        if (card) void enrich(card);
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

function handleFrom(card: HTMLElement): string | null {
  for (const a of Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href^="/"]'))) {
    const m = /^\/([A-Za-z0-9_]{1,15})(\/)?$/.exec(a.getAttribute('href') ?? '');
    if (m && m[1] && !RESERVED.has(m[1].toLowerCase())) return m[1];
  }
  return null;
}

/** The element with Twitter's rounded border/bg — append inside it so we share it. */
function cardBody(card: HTMLElement): HTMLElement {
  let el: HTMLElement = card;
  // descend through single-child wrappers to the actual padded card
  for (let i = 0; i < 4; i++) {
    const kids = Array.from(el.children).filter((c) => c instanceof HTMLElement) as HTMLElement[];
    if (kids.length === 1 && kids[0]) el = kids[0];
    else break;
  }
  return el;
}

async function enrich(card: HTMLElement): Promise<void> {
  if (card.getAttribute('data-pt-hc')) return;
  card.setAttribute('data-pt-hc', '1');
  const handle = handleFrom(card);
  if (!handle) return;

  const panel = document.createElement('div');
  panel.className = 'pt-hc-panel';
  Object.assign(panel.style, { borderTop: `1px solid ${TW.divider}`, padding: '11px 16px 13px', font: 'inherit', color: TW.text } as CSSStyleDeclaration);
  panel.appendChild(loadingRow());
  cardBody(card).appendChild(panel);

  const res = await pointer.profile(handle);
  panel.textContent = '';
  if (!res.ok) {
    if (/not_connected|connect/i.test(res.error)) panel.appendChild(textRow('Connect Pointer to see intel here.'));
    else panel.remove();
    return;
  }
  render(panel, res.data as unknown as ProfileSummary, handle);
}

function header(): HTMLElement {
  const h = document.createElement('div');
  Object.assign(h.style, { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '9px' } as CSSStyleDeclaration);
  const img = document.createElement('img');
  img.src = LOGO;
  Object.assign(img.style, { width: '14px', height: '14px', objectFit: 'contain' } as CSSStyleDeclaration);
  const name = document.createElement('span');
  name.textContent = 'Pointer';
  Object.assign(name.style, { fontSize: '12px', fontWeight: '700', color: TW.muted, letterSpacing: '0.01em' } as CSSStyleDeclaration);
  h.append(img, name);
  return h;
}

function render(panel: HTMLElement, data: ProfileSummary, handle: string): void {
  panel.appendChild(header());

  if (!data.found) {
    panel.appendChild(textRow('Not in Pointer’s directory yet — tag them to add it for everyone.'));
    panel.appendChild(actions([{ label: `Tag @${handle}`, primary: true, onClick: () => void tagHandle(handle, panel) }]));
    return;
  }

  // identity row: name + verified + KOL badge
  const id = document.createElement('div');
  Object.assign(id.style, { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' } as CSSStyleDeclaration);
  const nm = document.createElement('span');
  nm.textContent = data.name ?? `@${handle}`;
  Object.assign(nm.style, { fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as CSSStyleDeclaration);
  id.appendChild(nm);
  if (data.verified) {
    const v = document.createElement('span');
    v.textContent = '✓';
    Object.assign(v.style, { color: '#3ddc97', fontSize: '12px' } as CSSStyleDeclaration);
    id.appendChild(v);
  }
  for (const l of data.labels?.length ? data.labels : data.badge ? [data.badge] : []) id.appendChild(pill(l));
  panel.appendChild(id);

  // smart followers (known KOLs who follow them)
  if (data.smartFollowers && data.smartFollowers > 0) {
    panel.appendChild(sectionLabel(`${data.smartFollowers} Smart follower${data.smartFollowers === 1 ? '' : 's'}`));
    const wrap = chipWrap();
    for (const sf of (data.smartFollowerList ?? []).slice(0, 8)) {
      const chip = document.createElement('a');
      chip.href = `https://x.com/${sf.handle}`;
      chip.target = '_blank';
      chip.rel = 'noreferrer';
      chip.textContent = sf.name;
      chip.title = sf.badge ? `${sf.name} · ${sf.badge}` : sf.name;
      Object.assign(chip.style, { fontSize: '10.5px', fontWeight: '600', padding: '2px 8px', borderRadius: '999px', textDecoration: 'none', color: '#c8ccff', background: 'rgba(124,131,255,0.14)', border: '1px solid rgba(124,131,255,0.4)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as CSSStyleDeclaration);
      wrap.appendChild(chip);
    }
    panel.appendChild(wrap);
  }

  // wallet + PnL — toggle the lookback (1D/7D/30D/All), real numbers from our analytics.
  if (data.wallets.length) {
    const w0 = data.wallets[0]!;
    panel.appendChild(sectionLabel(data.wallets.length > 1 ? `Wallet PnL · ${data.wallets.length} linked` : 'Wallet PnL'));

    const seg = document.createElement('div');
    Object.assign(seg.style, { display: 'flex', gap: '4px', marginBottom: '8px' } as CSSStyleDeclaration);

    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'flex', gap: '8px', marginBottom: '8px' } as CSSStyleDeclaration);
    const nw = statCell('Net worth', '…');
    const pnl = statCell('Realized PnL', '…');
    grid.append(nw.cell, pnl.cell);

    const tfBtns: Record<string, HTMLButtonElement> = {};
    let activeTf = '30d';
    const load = (tf: string) => {
      activeTf = tf;
      for (const [k, b] of Object.entries(tfBtns)) {
        const on = k === tf;
        b.style.color = on ? '#fff' : TW.muted;
        b.style.background = on ? 'rgba(124,131,255,0.22)' : 'transparent';
        b.style.borderColor = on ? 'rgba(124,131,255,0.5)' : TW.divider;
      }
      nw.set('…'); pnl.set('…', null);
      void pointer.wallet(w0.address, tf).then((r) => {
        if (activeTf !== tf) return; // a newer toggle won — drop this stale result
        const wd = r.ok ? (r.data as WalletIntel) : null;
        nw.set(wd?.netWorthUsd != null ? usd(wd.netWorthUsd) : '—');
        pnl.set(wd?.realizedPnlUsd != null ? usd(wd.realizedPnlUsd) : '—', wd?.realizedPnlUsd ?? null);
      });
    };
    for (const tf of [{ id: '1d', label: '1D' }, { id: '7d', label: '7D' }, { id: '30d', label: '30D' }, { id: 'max', label: 'All' }]) {
      const b = document.createElement('button');
      b.textContent = tf.label;
      Object.assign(b.style, { flex: '1', padding: '4px 0', borderRadius: '7px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer', color: TW.muted, background: 'transparent', border: `1px solid ${TW.divider}`, font: 'inherit' } as CSSStyleDeclaration);
      b.onclick = () => load(tf.id);
      tfBtns[tf.id] = b;
      seg.appendChild(b);
    }
    panel.appendChild(seg);
    panel.appendChild(grid);
    load('30d');

    // compact wallet link (explorer)
    const row = document.createElement('a');
    row.href = explorer(w0.chain, w0.address);
    row.target = '_blank';
    row.rel = 'noreferrer';
    Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 9px', borderRadius: '9px', textDecoration: 'none', color: TW.text, border: `1px solid ${TW.divider}`, fontSize: '12px' } as CSSStyleDeclaration);
    row.onmouseenter = () => (row.style.background = TW.hover);
    row.onmouseleave = () => (row.style.background = 'transparent');
    const addr = document.createElement('span');
    addr.textContent = short(w0.address);
    Object.assign(addr.style, { fontVariantNumeric: 'tabular-nums' } as CSSStyleDeclaration);
    const chain = document.createElement('span');
    chain.textContent = w0.chain.toUpperCase();
    Object.assign(chain.style, { marginLeft: 'auto', fontSize: '10px', fontWeight: '700', color: TW.muted } as CSSStyleDeclaration);
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    Object.assign(arrow.style, { color: TW.muted } as CSSStyleDeclaration);
    row.append(addr, chain, arrow);
    panel.appendChild(row);
  }

  // CA history — Pointer's own, from the tweets we've scanned.
  if (data.cas && data.cas.length) {
    panel.appendChild(sectionLabel(`CA history · ${data.cas.length}`));
    const wrap = chipWrap();
    for (const c of data.cas.slice(0, 8)) {
      const chip = document.createElement('a');
      chip.href = c.chain === 'eth' ? `https://etherscan.io/token/${c.mint}` : `https://solscan.io/token/${c.mint}`;
      chip.target = '_blank';
      chip.rel = 'noreferrer';
      chip.textContent = `${c.mint.slice(0, 4)}…${c.mint.slice(-4)}`;
      Object.assign(chip.style, { fontSize: '10.5px', fontVariantNumeric: 'tabular-nums', padding: '2px 7px', borderRadius: '7px', textDecoration: 'none', color: TW.text, border: `1px solid ${TW.divider}` } as CSSStyleDeclaration);
      wrap.appendChild(chip);
    }
    panel.appendChild(wrap);
  }
}

function tagHandle(handle: string, panel: HTMLElement): void {
  panel.textContent = '';
  panel.appendChild(header());

  const input = document.createElement('input');
  input.placeholder = 'KOL · Dev · Scammer · Insider…';
  input.maxLength = 32;
  Object.assign(input.style, {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 11px',
    borderRadius: '9px',
    fontSize: '13px',
    font: 'inherit',
    color: TW.text,
    background: 'transparent',
    border: `1px solid ${TW.btnBorder}`,
    outline: 'none',
    marginBottom: '8px',
  } as CSSStyleDeclaration);

  const submit = async () => {
    const label = input.value.trim();
    if (!label) return;
    const res = await pointer.submitLabel('handle', handle, label, 'kol');
    panel.textContent = '';
    panel.appendChild(header());
    panel.appendChild(textRow(res.ok ? `Tagged @${handle} as “${label}”. In the pool — public once others agree.` : 'Couldn’t submit — connect Pointer and retry.'));
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void submit();
    if (e.key === 'Escape') void enrichRetag(handle, panel);
  });

  panel.appendChild(input);
  panel.appendChild(actions([
    { label: 'Cancel', onClick: () => void enrichRetag(handle, panel) },
    { label: 'Save tag', primary: true, onClick: () => void submit() },
  ]));
  setTimeout(() => input.focus(), 0);
}

/** Re-render the panel for a handle (used to cancel the inline tag input). */
async function enrichRetag(handle: string, panel: HTMLElement): Promise<void> {
  panel.textContent = '';
  panel.appendChild(loadingRow());
  const res = await pointer.profile(handle);
  panel.textContent = '';
  if (res.ok) render(panel, res.data as unknown as ProfileSummary, handle);
  else panel.appendChild(textRow('Connect Pointer to see intel here.'));
}

/* ── small builders ── */
function pill(text: string): HTMLElement {
  const el = document.createElement('span');
  el.textContent = text;
  Object.assign(el.style, { padding: '1px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.03em', color: '#c8ccff', background: 'rgba(124,131,255,0.16)', border: `1px solid rgba(124,131,255,0.45)` } as CSSStyleDeclaration);
  return el;
}
function sectionLabel(text: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: TW.muted, marginBottom: '6px' } as CSSStyleDeclaration);
  return el;
}
function chipWrap(): HTMLElement {
  const el = document.createElement('div');
  Object.assign(el.style, { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' } as CSSStyleDeclaration);
  return el;
}
function textRow(text: string): HTMLElement {
  const p = document.createElement('div');
  p.textContent = text;
  Object.assign(p.style, { fontSize: '12.5px', color: TW.muted, margin: '0 0 10px' } as CSSStyleDeclaration);
  return p;
}
function loadingRow(): HTMLElement {
  const p = document.createElement('div');
  p.textContent = 'Pointer…';
  Object.assign(p.style, { fontSize: '12px', color: TW.muted } as CSSStyleDeclaration);
  return p;
}
function actions(items: { label: string; href?: string; onClick?: () => void; primary?: boolean }[]): HTMLElement {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, { display: 'flex', gap: '7px', marginTop: '4px' } as CSSStyleDeclaration);
  for (const it of items) {
    const b = document.createElement(it.href ? 'a' : 'button') as HTMLElement;
    b.textContent = it.label;
    if (it.href) {
      (b as HTMLAnchorElement).href = it.href;
      (b as HTMLAnchorElement).target = '_blank';
      (b as HTMLAnchorElement).rel = 'noreferrer';
    }
    if (it.onClick) b.onclick = it.onClick;
    Object.assign(b.style, {
      flex: '1',
      minWidth: '0',
      boxSizing: 'border-box',
      textAlign: 'center',
      padding: '9px 14px',
      borderRadius: '999px',
      fontSize: '13px',
      fontWeight: '700',
      lineHeight: '1.2',
      cursor: 'pointer',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      font: 'inherit',
      border: it.primary ? '1px solid transparent' : `1px solid ${TW.btnBorder}`,
      color: it.primary ? '#fff' : TW.text,
      background: it.primary ? 'linear-gradient(180deg,#8b8cf9,#7280ff)' : 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(12px)',
      boxShadow: it.primary ? '0 6px 18px -6px rgba(124,131,255,0.65), inset 0 1px 0 rgba(255,255,255,0.28)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
      transition: 'filter .14s ease, transform .14s ease',
    } as CSSStyleDeclaration);
    b.onmouseenter = () => (b.style.filter = 'brightness(1.08)');
    b.onmouseleave = () => (b.style.filter = 'none');
    wrap.appendChild(b);
  }
  return wrap;
}
