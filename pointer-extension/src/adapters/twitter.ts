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

    // Contract addresses in tweet text.
    const tweets = root.querySelectorAll<HTMLElement>('[data-testid="tweetText"]:not([data-pt-ca])');
    for (const el of tweets) {
      const found = detectInText(el.textContent ?? '');
      if (found.length === 0) continue;
      el.dataset.ptCa = '1';
      for (const entity of found) {
        if (entity.kind === 'token' || entity.kind === 'evm') {
          targets.push({ entity, anchor: el, badge: true });
        }
      }
    }

    return targets;
  },
};

/** X reserved paths that look like handles but aren't profiles. */
const RESERVED = new Set([
  'home', 'explore', 'notifications', 'messages', 'search', 'settings', 'compose',
  'i', 'intent', 'hashtag', 'bookmarks', 'lists', 'topics', 'grok', 'jobs', 'about',
  'tos', 'privacy', 'login', 'signup', 'premium', 'communities',
]);
