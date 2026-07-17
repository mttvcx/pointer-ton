'use client';

import { MARK_CATEGORIES, type MarkCategory } from '@/lib/tradingview/marks';

export type DisplayMenuColors = {
  popup: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  hover: string;
};

/**
 * Builds the Axiom-style "Display Options" dropdown *inside the chart iframe*
 * (same-origin blob doc), anchored under `anchor`. Each row toggles a bubble
 * category. Returns a `close()` handle. `onChange` fires after any toggle so the
 * caller can refresh the marks.
 */
export function mountDisplayMenu(opts: {
  anchor: HTMLElement;
  getState: (key: MarkCategory) => boolean;
  setState: (key: MarkCategory, value: boolean) => void;
  colors: DisplayMenuColors;
  onChange: () => void;
}): { close: () => void; isOpen: () => boolean } {
  const { anchor, getState, setState, colors, onChange } = opts;
  const doc = anchor.ownerDocument;
  let menu: HTMLDivElement | null = null;

  const onDocDown = (e: Event) => {
    const target = e.target as Node;
    if (menu && !menu.contains(target) && target !== anchor && !anchor.contains(target)) close();
  };

  const close = () => {
    if (!menu) return;
    menu.remove();
    menu = null;
    doc.removeEventListener('mousedown', onDocDown, true);
  };

  const open = () => {
    menu = doc.createElement('div');
    const rect = anchor.getBoundingClientRect();
    Object.assign(menu.style, {
      position: 'fixed',
      left: `${Math.round(rect.left)}px`,
      top: `${Math.round(rect.bottom + 4)}px`,
      zIndex: '1000',
      background: colors.popup,
      border: `1px solid ${colors.border}`,
      borderRadius: '10px',
      padding: '6px',
      minWidth: '186px',
      boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
      font: '13px system-ui, -apple-system, sans-serif',
    } as CSSStyleDeclaration);

    for (const cat of MARK_CATEGORIES) {
      const row = doc.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        padding: '7px 9px',
        cursor: 'pointer',
        borderRadius: '7px',
        color: colors.text,
        userSelect: 'none',
      } as CSSStyleDeclaration);

      const dot = doc.createElement('span');
      const paintDot = (on: boolean) => {
        Object.assign(dot.style, {
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          flex: '0 0 auto',
          background: on ? colors.accent : 'transparent',
          border: `1.5px solid ${on ? colors.accent : colors.muted}`,
        } as CSSStyleDeclaration);
      };
      paintDot(getState(cat.key));

      const label = doc.createElement('span');
      label.textContent = cat.label;

      row.appendChild(dot);
      row.appendChild(label);
      row.onmouseenter = () => {
        row.style.background = colors.hover;
      };
      row.onmouseleave = () => {
        row.style.background = 'transparent';
      };
      row.onclick = () => {
        const next = !getState(cat.key);
        setState(cat.key, next);
        paintDot(next);
        onChange();
      };
      menu.appendChild(row);
    }

    doc.body.appendChild(menu);
    // Defer so the opening click doesn't immediately close it.
    setTimeout(() => doc.addEventListener('mousedown', onDocDown, true), 0);
  };

  anchor.onclick = () => (menu ? close() : open());
  return { close, isOpen: () => menu != null };
}
