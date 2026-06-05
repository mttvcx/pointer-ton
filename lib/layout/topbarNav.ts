import { APP_NAV, type AppNavItem } from '@/components/layout/navConfig';

/** Stable nav keys — same as `AppNavItem.href`. */
export type TopbarNavId = AppNavItem['href'];

export const TOPBAR_NAV_DEFAULT_ORDER: TopbarNavId[] = APP_NAV.map((n) => n.href);

const ALLOWED = new Set<string>(TOPBAR_NAV_DEFAULT_ORDER);

export function isTopbarNavId(id: string): id is TopbarNavId {
  return ALLOWED.has(id);
}

/** Merge persisted order with defaults when new nav items ship. */
export function normalizeTopbarNavOrder(order: string[] | undefined): TopbarNavId[] {
  const base = order?.length
    ? order.filter((id): id is TopbarNavId => isTopbarNavId(id))
    : [...TOPBAR_NAV_DEFAULT_ORDER];
  const seen = new Set<string>();
  const out: TopbarNavId[] = [];
  for (const id of base) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of TOPBAR_NAV_DEFAULT_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function resolveTopbarNav(order: string[] | undefined): AppNavItem[] {
  const normalized = normalizeTopbarNavOrder(order);
  const byHref = new Map(APP_NAV.map((item) => [item.href, item]));
  return normalized
    .map((href) => byHref.get(href))
    .filter((item): item is AppNavItem => item != null);
}
