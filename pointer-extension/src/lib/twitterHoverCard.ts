/**
 * Integrate Pointer INTO Twitter's native hover card (the Ethos approach) — never
 * a competing floating card. When X renders its `[data-testid="HoverCard"]`
 * profile preview, we append a Pointer panel INSIDE it, reusing Twitter's own
 * outline / divider / bg so it reads as native. Pointer's accent (violet) is the
 * only non-native colour, exactly where Pointer content lives.
 */
import { pointer } from '@/pointer/client';
import type { ProfileSummary } from '@/ui/cards/ProfileCard';
import { getWalletData } from '@/lib/walletData';

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
const SVGNS = 'http://www.w3.org/2000/svg';
const UP = '#3ddc97';
const DOWN = '#f4615f';
const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose', 'hashtag']);

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
const explorer = (chain: string, a: string) => (chain === 'sol' || chain === 'solana' ? `https://solscan.io/account/${a}` : `https://etherscan.io/address/${a}`);

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
  if (!data.found) {
    panel.appendChild(header());
    panel.appendChild(textRow('Not in Pointer’s directory yet — tag them to add it for everyone.'));
    panel.appendChild(actions([{ label: `Tag @${handle}`, primary: true, onClick: () => void tagHandle(handle, panel) }]));
    return;
  }

  // identity: name + label (KOL) — right under X's own name
  const idRow = document.createElement('div');
  Object.assign(idRow.style, { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '11px' } as CSSStyleDeclaration);
  const idNm = document.createElement('span');
  idNm.textContent = data.name ?? `@${handle}`;
  Object.assign(idNm.style, { fontSize: '14px', fontWeight: '800' } as CSSStyleDeclaration);
  idRow.appendChild(idNm);
  for (const l of data.labels?.length ? data.labels : data.badge ? [data.badge] : []) idRow.appendChild(pill(l));
  panel.appendChild(idRow);

  // header: timeframe toggle (left)
  const head = document.createElement('div');
  Object.assign(head.style, { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' } as CSSStyleDeclaration);
  const seg = document.createElement('div');
  Object.assign(seg.style, { display: 'flex', gap: '4px' } as CSSStyleDeclaration);
  head.appendChild(seg);
  panel.appendChild(head);

  // PnL value — reacts to the selected timeframe, green up / red down
  const sum = document.createElement('div');
  Object.assign(sum.style, { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '9px' } as CSSStyleDeclaration);
  const pnlVal = document.createElement('span');
  Object.assign(pnlVal.style, { fontSize: '21px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' } as CSSStyleDeclaration);
  const pnlCap = document.createElement('span');
  pnlCap.textContent = 'Realized PnL';
  Object.assign(pnlCap.style, { fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: TW.muted } as CSSStyleDeclaration);
  sum.append(pnlVal, pnlCap);
  panel.appendChild(sum);

  // chart
  const chartBox = document.createElement('div');
  panel.appendChild(chartBox);

  const tfBtns: Record<string, HTMLButtonElement> = {};
  let activeTf = '30d';
  const draw = (tf: string): void => {
    activeTf = tf;
    for (const [id, b] of Object.entries(tfBtns)) {
      const on = id === tf;
      b.style.color = on ? '#fff' : TW.muted;
      b.style.background = on ? 'rgba(124,131,255,0.22)' : 'transparent';
      b.style.borderColor = on ? 'rgba(124,131,255,0.5)' : TW.divider;
    }
    pnlVal.textContent = '…';
    pnlVal.style.color = TW.muted;
    chartBox.textContent = '';
    void getWalletData(handle, tf).then((d) => {
      if (activeTf !== tf) return; // a newer toggle won the race
      if (d?.indexing) {
        pnlVal.textContent = '…';
        pnlVal.style.color = TW.muted;
        chartBox.textContent = '';
        const n = document.createElement('div');
        n.textContent = 'Indexing trades — one moment';
        Object.assign(n.style, { fontSize: '11px', color: TW.muted, textAlign: 'center', padding: '24px 0' } as CSSStyleDeclaration);
        chartBox.appendChild(n);
        return;
      }
      const realized = d?.realizedPnlUsd ?? null;
      const chart = d?.chart ?? [];
      const up = (realized ?? 0) >= 0;
      pnlVal.textContent = realized != null ? `${up ? '+' : '−'}${usd(Math.abs(realized))}` : '—';
      pnlVal.style.color = realized == null ? TW.text : up ? UP : DOWN;
      chartBox.textContent = '';
      if (chart.length >= 2) {
        chartBox.appendChild(lineChart(chart, up ? UP : DOWN));
      } else {
        const n = document.createElement('div');
        n.textContent = 'No trade history in this window';
        Object.assign(n.style, { fontSize: '11px', color: TW.muted, textAlign: 'center', padding: '24px 0' } as CSSStyleDeclaration);
        chartBox.appendChild(n);
      }
    }).catch(() => {
      if (activeTf !== tf) return; // transient (e.g. not connected yet)
      pnlVal.textContent = '—';
      pnlVal.style.color = TW.text;
      chartBox.textContent = '';
      const n = document.createElement('div');
      n.textContent = 'Couldn’t load — try again';
      Object.assign(n.style, { fontSize: '11px', color: TW.muted, textAlign: 'center', padding: '24px 0' } as CSSStyleDeclaration);
      chartBox.appendChild(n);
    });
  };
  for (const tf of [{ id: '1d', label: '1D' }, { id: '7d', label: '7D' }, { id: '30d', label: '30D' }, { id: 'max', label: 'All' }]) {
    const b = document.createElement('button');
    b.textContent = tf.label;
    Object.assign(b.style, { padding: '3px 9px', borderRadius: '7px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', color: TW.muted, background: 'transparent', border: `1px solid ${TW.divider}`, font: 'inherit' } as CSSStyleDeclaration);
    b.onclick = () => draw(tf.id);
    tfBtns[tf.id] = b;
    seg.appendChild(b);
  }
  draw('30d');

  // powered-by — bottom line
  const foot = document.createElement('div');
  Object.assign(foot.style, { display: 'flex', marginTop: '11px', paddingTop: '9px', borderTop: `1px solid ${TW.divider}` } as CSSStyleDeclaration);
  const pb = poweredBy();
  pb.style.marginLeft = '0';
  foot.appendChild(pb);
  panel.appendChild(foot);
}

/** Pointer wordmark lockup — bigger bird + clearer label. */
function poweredBy(): HTMLElement {
  const a = document.createElement('a');
  a.href = 'https://pointer.trade';
  a.target = '_blank';
  a.rel = 'noreferrer';
  Object.assign(a.style, { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', whiteSpace: 'nowrap' } as CSSStyleDeclaration);
  const img = document.createElement('img');
  img.src = LOGO;
  Object.assign(img.style, { width: '18px', height: '18px', objectFit: 'contain' } as CSSStyleDeclaration);
  const t = document.createElement('span');
  t.textContent = 'powered by pointer.trade';
  Object.assign(t.style, { fontSize: '11.5px', fontWeight: '600', color: 'rgb(160,166,173)' } as CSSStyleDeclaration);
  a.append(img, t);
  return a;
}

const usd = (n: number): string => {
  const a = Math.abs(n);
  return a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `$${a.toFixed(a < 1 && a > 0 ? 2 : 0)}`;
};

/** Clean PnL line on the grey card: zero baseline, gradient fill, colored line. */
function lineChart(points: { v: number }[], color: string): SVGElement {
  const W = 232;
  const H = 92;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  Object.assign(svg.style, { width: '100%', height: `${H}px`, display: 'block' } as CSSStyleDeclaration);
  if (points.length < 2) return svg;
  const ys = points.map((p) => p.v);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);
  const px = (i: number) => (i / (points.length - 1)) * (W - 4) + 2;
  const py = (y: number) => H - 4 - ((y - minY) / ((maxY - minY) || 1)) * (H - 8);
  const zeroY = py(0);

  const base = document.createElementNS(SVGNS, 'line');
  base.setAttribute('x1', '2');
  base.setAttribute('x2', String(W - 2));
  base.setAttribute('y1', zeroY.toFixed(1));
  base.setAttribute('y2', zeroY.toFixed(1));
  base.setAttribute('stroke', TW.divider);
  base.setAttribute('stroke-width', '1');
  base.setAttribute('stroke-dasharray', '2 3');
  svg.appendChild(base);

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(p.v).toFixed(1)}`).join(' ');
  const gid = `ptg-${color.replace('#', '')}`;
  const defs = document.createElementNS(SVGNS, 'defs');
  const grad = document.createElementNS(SVGNS, 'linearGradient');
  grad.setAttribute('id', gid);
  grad.setAttribute('x1', '0');
  grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0');
  grad.setAttribute('y2', '1');
  const s1 = document.createElementNS(SVGNS, 'stop');
  s1.setAttribute('offset', '0');
  s1.setAttribute('stop-color', color);
  s1.setAttribute('stop-opacity', '0.28');
  const s2 = document.createElementNS(SVGNS, 'stop');
  s2.setAttribute('offset', '1');
  s2.setAttribute('stop-color', color);
  s2.setAttribute('stop-opacity', '0');
  grad.append(s1, s2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  const area = document.createElementNS(SVGNS, 'path');
  area.setAttribute('d', `${line} L ${px(points.length - 1).toFixed(1)} ${zeroY.toFixed(1)} L ${px(0).toFixed(1)} ${zeroY.toFixed(1)} Z`);
  area.setAttribute('fill', `url(#${gid})`);
  svg.appendChild(area);

  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('d', line);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);
  return svg;
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
    panel.appendChild(textRow(!res.ok ? 'Couldn’t submit — connect Pointer and retry.' : res.data.applied ? `Tagged @${handle} as “${label}” — live.` : `Tagged @${handle} as “${label}”. In the pool — public once others agree.`));
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
