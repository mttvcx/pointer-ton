import 'server-only';

import { insertAlert } from '@/lib/db/alerts';
import { listActiveAutomationRulesByTrigger, updateAlertRule, type AlertRuleRow } from '@/lib/db/alertRules';
import { fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';
import { notifyUser } from '@/lib/push/notifyUser';

/**
 * Cron-side firing for the two automation triggers that live on `alert_rules` but
 * are detected by existing pollers rather than the X-monitor: `tracked_wallet`
 * (poll-tracked-wallets) and `price` (check-limit-alerts).
 *
 * Layer B: DETECT + NOTIFY + push, carrying the rule's intended action so the
 * executor can act on it. Actual auto-execution is Layer C (delegated signer,
 * guardrailed + kill-switched). Nothing here signs or spends.
 */

/** Per-process cooldown guard (best-effort; resets on cold start). */
const lastFireMs = new Map<string, number>();
/** Price rules with no explicit cooldown still shouldn't re-fire every 2-min tick. */
const PRICE_MIN_COOLDOWN_MS = 5 * 60_000;

type RuleAction = { execution: 'auto_buy' | 'notify'; buySolPreset: number | null; slippageBps: number | null };

function ruleAction(row: AlertRuleRow): RuleAction {
  const cfg = (row.action_config ?? {}) as Record<string, unknown>;
  const buy = row.action_type === 'buy';
  return {
    execution: buy ? 'auto_buy' : 'notify',
    buySolPreset: typeof cfg.buySolPreset === 'number' ? cfg.buySolPreset : null,
    slippageBps: typeof cfg.slippageBps === 'number' ? cfg.slippageBps : null,
  };
}

function cooledDown(ruleId: string, cooldownMs: number): boolean {
  if (cooldownMs <= 0) return true;
  const last = lastFireMs.get(ruleId) ?? 0;
  return Date.now() - last >= cooldownMs;
}

async function maybeDisableAfterSuccess(row: AlertRuleRow): Promise<void> {
  if (!row.disable_after_success) return;
  try {
    await updateAlertRule(row.user_id, row.id, { is_active: false });
  } catch {
    /* best-effort */
  }
}

export type TrackedWalletSwapForRules = {
  wallet: string;
  mint: string;
  side: 'buy' | 'sell';
  solAmount: number;
  symbol?: string | null;
  signature: string;
};

/**
 * Fire `tracked_wallet` automation rules whose configured wallet matches this swap.
 * The wallet must also be in `tracked_wallets` for the poll cron to observe it.
 * Rules are cached briefly to avoid a query per swap.
 */
let twRulesCache: { at: number; rows: AlertRuleRow[] } | null = null;
const TW_RULES_TTL_MS = 60_000;

async function trackedWalletRules(): Promise<AlertRuleRow[]> {
  if (twRulesCache && Date.now() - twRulesCache.at < TW_RULES_TTL_MS) return twRulesCache.rows;
  const rows = await listActiveAutomationRulesByTrigger('tracked_wallet').catch(() => [] as AlertRuleRow[]);
  twRulesCache = { at: Date.now(), rows };
  return rows;
}

export async function fireTrackedWalletRulesForSwap(swap: TrackedWalletSwapForRules): Promise<number> {
  const rows = await trackedWalletRules();
  if (rows.length === 0) return 0;
  let fired = 0;

  for (const row of rows) {
    const cfg = (row.trigger_config ?? {}) as { wallet?: string; side?: string; minSolAmount?: number };
    if (!cfg.wallet || cfg.wallet !== swap.wallet) continue;
    const wantSide = cfg.side ?? 'buy';
    if (wantSide !== 'any' && wantSide !== swap.side) continue;
    if (typeof cfg.minSolAmount === 'number' && swap.solAmount < cfg.minSolAmount) continue;

    const cooldownMs = Math.max(0, Number(row.cooldown_seconds ?? 0)) * 1000;
    if (!cooledDown(row.id, cooldownMs)) continue;
    lastFireMs.set(row.id, Date.now());

    const action = ruleAction(row);
    const sym = swap.symbol ? `$${swap.symbol}` : swap.mint.slice(0, 8);
    const summary = `${row.name}: wallet ${swap.side} ${sym}`;

    try {
      await insertAlert({
        user_id: row.user_id,
        type: 'automation_tracked_wallet',
        ai_narration: summary,
        payload: {
          message: summary,
          source: 'tracked_wallet_rule',
          ruleId: row.id,
          ruleName: row.name,
          mint: swap.mint,
          wallet: swap.wallet,
          side: swap.side,
          solAmount: swap.solAmount,
          signature: swap.signature,
          execution: action.execution,
          buySolPreset: action.buySolPreset,
          slippageBps: action.slippageBps,
        },
      });
      await notifyUser(row.user_id, {
        title: row.name,
        body: `Tracked wallet ${swap.side} ${sym}`,
        url: `/token/${encodeURIComponent(swap.mint)}`,
      });
      fired += 1;
      await maybeDisableAfterSuccess(row);
    } catch (e) {
      console.warn('[automation] tracked_wallet rule emit failed:', e instanceof Error ? e.message : e);
    }
  }
  return fired;
}

/** Effective USD target for a price rule (absolute, or multiple × captured base). */
function priceTarget(cfg: { targetPriceUsd?: number; targetMultiple?: number; basePriceUsd?: number }): number | null {
  if (typeof cfg.targetPriceUsd === 'number' && cfg.targetPriceUsd > 0) return cfg.targetPriceUsd;
  if (typeof cfg.targetMultiple === 'number' && typeof cfg.basePriceUsd === 'number' && cfg.basePriceUsd > 0) {
    return cfg.basePriceUsd * cfg.targetMultiple;
  }
  return null;
}

/** Check every active `price` rule against spot and fire the crossed ones. Returns count fired. */
export async function firePriceRules(): Promise<number> {
  const rows = await listActiveAutomationRulesByTrigger('price').catch(() => [] as AlertRuleRow[]);
  if (rows.length === 0) return 0;

  const mints = [...new Set(rows.map((r) => (r.trigger_config as { mint?: string })?.mint).filter(Boolean) as string[])];
  if (mints.length === 0) return 0;
  const prices = await fetchUsdPricesForMints(mints);

  let fired = 0;
  for (const row of rows) {
    const cfg = (row.trigger_config ?? {}) as {
      mint?: string;
      direction?: 'above' | 'below';
      targetPriceUsd?: number;
      targetMultiple?: number;
      basePriceUsd?: number;
    };
    if (!cfg.mint) continue;
    const spot = prices.get(cfg.mint)?.usdPrice;
    if (spot == null || !Number.isFinite(spot)) continue;
    const target = priceTarget(cfg);
    if (target == null) continue;

    const direction = cfg.direction ?? 'above';
    const hit = direction === 'above' ? spot >= target : spot <= target;
    if (!hit) continue;

    const cooldownMs = Math.max(Math.max(0, Number(row.cooldown_seconds ?? 0)) * 1000, PRICE_MIN_COOLDOWN_MS);
    if (!cooledDown(row.id, cooldownMs)) continue;
    lastFireMs.set(row.id, Date.now());

    const action = ruleAction(row);
    const summary = `${row.name}: price ${direction} $${target.toPrecision(4)} (spot $${spot.toPrecision(4)})`;
    try {
      await insertAlert({
        user_id: row.user_id,
        type: 'automation_price',
        ai_narration: summary,
        payload: {
          message: summary,
          source: 'price_rule',
          ruleId: row.id,
          ruleName: row.name,
          mint: cfg.mint,
          direction,
          spotUsd: spot,
          targetUsd: target,
          execution: action.execution,
          buySolPreset: action.buySolPreset,
          slippageBps: action.slippageBps,
        },
      });
      await notifyUser(row.user_id, {
        title: row.name,
        body: `Price ${direction} target — spot $${spot.toPrecision(4)}`,
        url: `/token/${encodeURIComponent(cfg.mint)}`,
      });
      fired += 1;
      await maybeDisableAfterSuccess(row);
    } catch (e) {
      console.warn('[automation] price rule emit failed:', e instanceof Error ? e.message : e);
    }
  }
  return fired;
}
