import 'server-only';

import type { TrackerRuleCondition } from '@/lib/trackers/ruleCondition';

function normPad(p: string | null | undefined): string | null {
  if (!p || p === 'unknown') return null;
  return p.trim().toLowerCase();
}

function launchMatchesPads(
  launchpad: string | null | undefined,
  anyOf: string[] | null | undefined,
): boolean {
  if (!anyOf || anyOf.length === 0) return true;
  const ev = normPad(launchpad ?? null);
  if (!ev) return false;
  return anyOf.some((p) => {
    const x = p.trim().toLowerCase();
    return ev === x || ev.includes(x) || x.includes(ev);
  });
}

/**
 * True when a token launch event satisfies `condition`.
 * Swap-specific types are evaluated elsewhere when trade indexing exists.
 */
export function ruleMatchesTokenLaunch(
  condition: TrackerRuleCondition,
  ev: {
    mint: string;
    launchpad: string | null;
  },
): boolean {
  const types = condition.eventTypes;
  const wantsLaunch =
    types.includes('token_launch') || types.includes('any_trade');
  if (!wantsLaunch) return false;

  if (condition.mintFilter?.trim()) {
    if (ev.mint !== condition.mintFilter.trim()) return false;
  }

  if (!launchMatchesPads(ev.launchpad, condition.launchpadsAnyOf ?? null)) {
    return false;
  }

  return true;
}
