import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import themeCss from '@/ui/theme.css?inline';

/**
 * Single closed-Shadow-DOM host with one persistent React root — pre-mounted so
 * opening a card is just a `render` (no DOM/shadow setup on the hot path → the
 * <80ms budget). Themed with Pointer tokens; nothing leaks to/from the host page.
 */
let mount: HTMLElement | null = null;
let root: Root | null = null;
let hideTimer: number | undefined;

function ensureHost(): { mount: HTMLElement; root: Root } {
  if (mount && root) return { mount, root };
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;z-index:2147483647;inset:0;pointer-events:none;';
  const shadow = wrapper.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = themeCss;
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;pointer-events:auto;display:none;';
  m.addEventListener('pointerenter', () => window.clearTimeout(hideTimer));
  m.addEventListener('pointerleave', () => scheduleHideCard());
  shadow.append(style, m);
  document.documentElement.appendChild(wrapper);
  mount = m;
  root = createRoot(m);
  return { mount: m, root };
}

export function showCard(anchor: HTMLElement, node: ReactNode): void {
  const { mount: m, root: r } = ensureHost();
  window.clearTimeout(hideTimer);
  const rect = anchor.getBoundingClientRect();
  m.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 380))}px`;
  m.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 260)}px`;
  m.style.display = 'block';
  r.render(node);
}

export function scheduleHideCard(): void {
  hideTimer = window.setTimeout(() => {
    if (mount) mount.style.display = 'none';
  }, 140);
}
