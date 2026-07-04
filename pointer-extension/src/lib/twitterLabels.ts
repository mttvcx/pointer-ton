/**
 * On-page label badges for X — the visible payoff. Scans the @handles rendered
 * in the timeline / profiles, asks the background broker for Pointer's KNOWN
 * labels (the curated KOL/identity directory in `/api/ext/labels`, no import
 * needed), merges the user's own local profile notes, and stamps a Pointer pill
 * inline next to the handle ("RED · KOL"). Idle-scheduled, dedup'd, cheap.
 */
import { pointer } from '@/pointer/client';
import type { ExtLabel, ExtLabels } from '@/pointer/types';
import { getProfiles } from '@/lib/labels';

const HANDLE_RE = /^@([A-Za-z0-9_]{1,15})$/;

export function startTwitterLabels(): void {
  const cache = new Map<string, ExtLabel | null>(); // handle(lower) → directory hit
  let local: Record<string, string> = {}; // handle(lower) → personal note

  const loadLocal = () =>
    void getProfiles().then((ps) => {
      local = Object.fromEntries(ps.map((p) => [p.handle.toLowerCase(), p.note || p.handle]));
    });
  loadLocal();
  // Re-read local labels when the user adds one in the popup.
  try {
    chrome.storage.onChanged.addListener((_c, area) => area === 'local' && loadLocal());
  } catch {
    /* no-op */
  }

  function handleInfo(c: HTMLElement): { handle: string; el: HTMLElement } | null {
    for (const s of Array.from(c.querySelectorAll<HTMLElement>('span'))) {
      const m = HANDLE_RE.exec((s.textContent ?? '').trim());
      if (m && m[1]) return { handle: m[1].toLowerCase(), el: s };
    }
    return null;
  }

  function hitFor(handle: string): ExtLabel | null {
    const dir = cache.get(handle);
    if (dir) return dir;
    if (local[handle]) return { name: local[handle]!, badge: 'Label', verified: false, kind: 'personal' };
    return null;
  }

  async function scan(): Promise<void> {
    // User-Name = timeline/tweets · UserName = profile header · UserCell = lists
    // (followers, who-to-follow, search) — so badges appear beside everyone.
    const containers = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="User-Name"], [data-testid="UserName"], [data-testid="UserCell"]'));
    const pending: { c: HTMLElement; handle: string; el: HTMLElement }[] = [];
    const need = new Set<string>();
    for (const c of containers) {
      const info = handleInfo(c);
      if (!info) continue;
      if (c.getAttribute('data-pt-h') === info.handle) continue; // already handled this handle
      pending.push({ c, handle: info.handle, el: info.el });
      if (!cache.has(info.handle) && !local[info.handle]) need.add(info.handle);
    }
    if (!pending.length) return;

    if (need.size) {
      const res = await pointer.labels([...need], []);
      if (res.ok) {
        const data = res.data as ExtLabels;
        for (const h of need) cache.set(h, data.handles[h] ?? null);
      }
      // On failure (e.g. a transient blip) we do NOT cache — so the handle is
      // retried on the next scan instead of its badge vanishing for the session.
    }

    for (const { c, handle, el } of pending) {
      c.setAttribute('data-pt-h', handle);
      if (c.querySelector('.pt-label-badge')) continue;
      const hit = hitFor(handle);
      if (!hit) continue;
      // Full stack (KOL + Founder …) on the profile header; just the primary badge
      // on tweets / list cells to keep those uncluttered.
      const isHeader = c.getAttribute('data-testid') === 'UserName';
      const stack = hit.labels?.length ? hit.labels : [hit.kind === 'personal' ? hit.name : hit.badge || hit.name];
      const toShow = isHeader ? stack.slice(0, 4) : stack.slice(0, 1);
      let anchor: HTMLElement = el;
      toShow.forEach((text, i) => {
        const pill = makeBadgePill(text, hit, i === 0);
        anchor.insertAdjacentElement('afterend', pill);
        anchor = pill;
      });
    }
  }

  const schedule = () => (window.requestIdleCallback ?? window.setTimeout)(() => void scan(), { timeout: 600 } as never);
  schedule();
  let debounce: number | undefined;
  new MutationObserver(() => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(schedule, 350);
  }).observe(document.body, { childList: true, subtree: true });
}

/** One inline pill. `withDot` only on the first (primary) so a stack reads clean. */
function makeBadgePill(text: string, hit: ExtLabel, withDot: boolean): HTMLElement {
  const kol = hit.kind !== 'personal'; // directory + community = accent; personal = green
  const accent = kol ? '#7c83ff' : '#3ddc97';
  const el = document.createElement('span');
  el.className = 'pt-label-badge';
  Object.assign(el.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    margin: '0 2px 0 6px',
    padding: withDot ? '1px 7px 1px 6px' : '1px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: '16px',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    color: kol ? '#c8ccff' : '#bdeccf',
    background: kol ? 'rgba(124,131,255,0.16)' : 'rgba(61,220,151,0.14)',
    border: `1px solid ${kol ? 'rgba(124,131,255,0.45)' : 'rgba(61,220,151,0.42)'}`,
    cursor: 'default',
  } as CSSStyleDeclaration);
  el.title = hit.kind === 'personal' ? `Your label: ${hit.name}` : `Pointer · ${hit.name}`;

  if (withDot) {
    const dot = document.createElement('span');
    Object.assign(dot.style, { width: '5px', height: '5px', borderRadius: '999px', background: accent, boxShadow: `0 0 6px ${accent}`, flex: '0 0 auto' } as CSSStyleDeclaration);
    el.appendChild(dot);
  }

  const label = document.createElement('span');
  label.textContent = text;
  Object.assign(label.style, { maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: hit.kind === 'personal' ? '0' : '0.02em' } as CSSStyleDeclaration);
  el.appendChild(label);
  return el;
}
