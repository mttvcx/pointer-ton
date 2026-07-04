import type { DetectedEntity } from '@/lib/detect';

/** A place in the page where a hover trigger / decoration attaches. */
export interface HoverTarget {
  entity: DetectedEntity;
  /** Element the user hovers to open the Pointer card. */
  anchor: HTMLElement;
  /** Optional: a small inline badge to inject next to the anchor. */
  badge?: boolean;
}

/** A page-level action (e.g. "Analyze with Pointer" on a project site). */
export interface PageAction {
  id: string;
  label: string;
  run(): void;
}

/**
 * A per-site adapter. Adding a new supported website = implement this once and
 * register a host match in `wxt.config.ts`. The host page is DATA, never trusted
 * code — adapters only READ the DOM and return entities; they never execute page
 * script.
 */
export interface SiteAdapter {
  id: string;
  /** Host globs this adapter handles (must be a subset of manifest host_permissions). */
  matches: string[];
  /** Find entities already present in a DOM subtree. Deterministic, no network. */
  scan(root: ParentNode): HoverTarget[];
  /** Optional site-wide action surfaced in the toolbar / page. */
  pageAction?(): PageAction | null;
}

/** Registry — content scripts pick the adapter whose `matches` fits `location`. */
export function selectAdapter(adapters: SiteAdapter[], host: string): SiteAdapter | null {
  return (
    adapters.find((a) =>
      a.matches.some((glob) => {
        const re = new RegExp('^' + glob.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        return re.test(host);
      }),
    ) ?? null
  );
}
