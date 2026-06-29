import { twitterAdapter } from '@/adapters/twitter';
import type { HoverTarget } from '@/adapters/types';
import { pointer } from '@/pointer/client';
import themeCss from '@/ui/theme.css?inline';

/**
 * Twitter/X content script — the proving slice for the whole architecture:
 * idle-scheduled DOM scan (never blocks scroll), hover-intent, a closed
 * Shadow-DOM card hydrated from the background broker. The rich React cards
 * (profile, smart-followers, token) replace the skeleton render in Phase 3.
 */
export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  main() {
    const HOVER_INTENT_MS = 50;
    const host = mountShadowHost();
    let hoverTimer: number | undefined;

    // 1. Scan for entities on idle, re-scanning as the SPA mutates (debounced).
    const scan = () => {
      const targets = twitterAdapter.scan(document.body);
      for (const t of targets) bindHover(t);
    };
    const schedule = () =>
      (window.requestIdleCallback ?? window.setTimeout)(() => scan(), { timeout: 500 } as never);

    schedule();
    let debounce: number | undefined;
    new MutationObserver(() => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(schedule, 250);
    }).observe(document.body, { childList: true, subtree: true });

    // 2. Hover-intent → open a card hydrated from the broker.
    function bindHover(target: HoverTarget) {
      target.anchor.addEventListener('pointerenter', () => {
        hoverTimer = window.setTimeout(() => openCard(target), HOVER_INTENT_MS);
      });
      target.anchor.addEventListener('pointerleave', () => window.clearTimeout(hoverTimer));
    }

    async function openCard(target: HoverTarget) {
      const card = renderSkeleton(host, target);
      const res =
        target.entity.kind === 'handle'
          ? await pointer.profile(target.entity.value)
          : await pointer.token(target.entity.value);
      if (!res.ok) {
        card.textContent =
          res.error === 'not_connected' ? 'Connect Pointer to see intelligence.' : 'Unavailable.';
        return;
      }
      // Phase 3: render the full ProfileCard / TokenCard React component here.
      card.textContent = `Pointer · ${target.entity.kind}: ${target.entity.value}`;
    }
  },
});

/** Closed shadow host, themed with Pointer tokens; nothing leaks to/from the page. */
function mountShadowHost(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;z-index:2147483647;top:0;left:0;pointer-events:none;';
  const shadow = wrapper.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = themeCss;
  const mount = document.createElement('div');
  mount.style.pointerEvents = 'auto';
  shadow.append(style, mount);
  document.documentElement.appendChild(wrapper);
  return mount;
}

function renderSkeleton(mount: HTMLElement, target: HoverTarget): HTMLElement {
  mount.replaceChildren();
  const card = document.createElement('div');
  card.className = 'pt-card';
  card.style.cssText = 'position:fixed;padding:12px;';
  const r = target.anchor.getBoundingClientRect();
  card.style.left = `${Math.min(r.left, window.innerWidth - 380)}px`;
  card.style.top = `${Math.min(r.bottom + 6, window.innerHeight - 200)}px`;
  card.textContent = 'Pointer…';
  mount.appendChild(card);
  return card;
}
