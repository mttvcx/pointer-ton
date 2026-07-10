import { detectInText } from '@/lib/detect';
import type { HoverTarget, SiteAdapter } from '@/adapters/types';

/**
 * Twitter / X adapter. Decorates profile links (→ profile intel) and contract
 * addresses in tweet text (→ token intel). Read-only DOM scan; the host page is
 * never trusted as code. The flagship profile + smart-follower hover cards build
 * on this in Phase 3.
 */
export const twitterAdapter: SiteAdapter = {
  id: 'twitter',
  matches: ['x.com', 'twitter.com'],

  scan(root: ParentNode): HoverTarget[] {
    const targets: HoverTarget[] = [];

    // Profile links: <a href="/handle"> in the timeline / profile header.
    const links = root.querySelectorAll<HTMLAnchorElement>('a[href^="/"]:not([data-pt])');
    for (const a of links) {
      const m = a.getAttribute('href')?.match(/^\/([A-Za-z0-9_]{1,15})$/);
      if (!m || RESERVED.has(m[1]!.toLowerCase())) continue;
      a.dataset.pt = '1';
      targets.push({ entity: { kind: 'handle', value: m[1]!.toLowerCase(), raw: `@${m[1]}` }, anchor: a });
    }

    // Addresses in tweet text AND profile bios (incl. the hover card + right-rail
    // "WALLET ADDY:" / "CA:" lines) — wallets, contracts (any chain), ambiguous.
    const containers = root.querySelectorAll<HTMLElement>(
      '[data-testid="tweetText"]:not([data-pt-ca]), [data-testid="UserDescription"]:not([data-pt-ca])',
    );
    for (const el of containers) {
      const found = detectInText(el.textContent ?? '');
      el.dataset.ptCa = '1';
      if (found.length === 0) continue;
      for (const entity of found) {
        if (entity.kind === 'handle') continue;
        // Wrap the exact address so the card anchors to (and outlines) just it —
        // not the whole tweet/bio. Falls back to the container if it can't wrap.
        const anchor = wrapMatch(el, entity.raw) ?? el;
        targets.push({ entity, anchor, badge: true });
      }
    }

    return targets;
  },
};

/**
 * Wrap the first occurrence of `raw` (a single, contiguous address) in a styled
 * span and return it — the hover anchor. Highlighted with a subtle Pointer-violet
 * dotted underline so it reads as interactive.
 */
function wrapMatch(root: HTMLElement, raw: string): HTMLElement | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue ?? '';
    const idx = text.indexOf(raw);
    if (idx === -1) continue;
    try {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + raw.length);
      const span = document.createElement('span');
      span.className = 'pt-ca-hit';
      span.setAttribute('data-pt', '1');
      Object.assign(span.style, {
        cursor: 'pointer',
        borderRadius: '4px',
        textDecoration: 'underline dotted',
        textDecorationColor: 'rgba(124,131,255,0.65)',
        textUnderlineOffset: '2px',
        transition: 'background .12s ease, box-shadow .12s ease',
      } as CSSStyleDeclaration);
      range.surroundContents(span);
      return span;
    } catch {
      return null;
    }
  }
  return null;
}

/** X reserved paths that look like handles but aren't profiles. */
const RESERVED = new Set([
  'home', 'explore', 'notifications', 'messages', 'search', 'settings', 'compose',
  'i', 'intent', 'hashtag', 'bookmarks', 'lists', 'topics', 'grok', 'jobs', 'about',
  'tos', 'privacy', 'login', 'signup', 'premium', 'communities',
]);
