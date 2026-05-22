'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { usePortfolioRefreshListener } from '@/lib/hooks/usePortfolioRefreshListener';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import {
  AUTO_SELL_DEMO_MINT,
  POINTER_AUTO_SELL_DISPATCH_EVT,
  type AutoSellDispatchPayload,
} from '@/lib/alerts/autoSellDispatch';
import {
  evaluateAutoSellTrigger,
  type PositionEvalInput,
} from '@/lib/autoSell/evaluateTrigger';
import type { AutoSellRule } from '@/lib/autoSell/types';
import { useAutoSellStore } from '@/store/autoSell';
import { useAutoSellToastStore } from '@/store/autoSellToasts';
import { useTrackAutomationStore } from '@/store/trackAutomation';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

type PortfolioPosition = {
  mint: string;
  symbol: string | null;
  costBasisUsd: number;
  unrealizedPnlUsd: number | null;
  valueUsd: number | null;
};

function skipToast(title: string, mint?: string) {
  useAutoSellToastStore.getState().push({
    status: 'skipped',
    title,
    mint,
  });
}

function ruleMatchesMint(rule: AutoSellRule, mint: string): boolean {
  if (rule.tokenScope.kind === 'all_held') return mint !== SOL_MINT;
  return rule.tokenScope.mint.trim() === mint;
}

async function fetchMarketCaps(
  mints: string[],
  getAccessToken: () => Promise<string | null>,
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const token = await getAccessToken();
  if (!token) return out;

  await Promise.all(
    mints.slice(0, 12).map(async (mint) => {
      try {
        const res = await fetch(`/api/tokens/${encodeURIComponent(mint)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          out.set(mint, null);
          return;
        }
        const j = (await res.json()) as {
          snapshot?: { market_cap_usd?: number | null };
        };
        const mc = j.snapshot?.market_cap_usd;
        out.set(mint, mc != null && Number.isFinite(mc) ? mc : null);
      } catch {
        out.set(mint, null);
      }
    }),
  );
  return out;
}

export function AutoSellExecutor() {
  const { authenticated, getAccessToken } = usePointerAuth();
  const { sellTokenPct, canTrade } = usePulseQuickBuy();
  const ruleLastFire = useRef<Map<string, number>>(new Map());
  const inFlight = useRef<Set<string>>(new Set());
  const positionOpenedAt = useRef<Map<string, number>>(new Map());

  const runAutoSell = useCallback(
    async (input: {
      mint: string;
      ticker: string;
      sellPct: number;
      ruleId?: string | null;
      dataDemo?: boolean;
    }) => {
      const prefs = useAutoSellStore.getState();
      const pushToast = useAutoSellToastStore.getState().push;
      const patchToast = useAutoSellToastStore.getState().patch;

      const dedupeKey = `${input.ruleId ?? 'demo'}:${input.mint}:${input.sellPct}`;
      if (inFlight.current.has(dedupeKey)) return;
      inFlight.current.add(dedupeKey);

      try {
        if (!input.dataDemo && !prefs.autoSellEnabled) {
          console.info('[auto-sell] skipped: master toggle off');
          return;
        }

        const ruleKey = input.ruleId?.trim() || 'unknown-rule';
        const cooldownMs = Math.max(1, prefs.cooldownSec) * 1000;
        const last = ruleLastFire.current.get(`${ruleKey}:${input.mint}`) ?? 0;
        if (!input.dataDemo && Date.now() - last < cooldownMs) {
          skipToast('⏸ Auto-sell skipped: cooldown', input.mint);
          return;
        }

        if (!input.dataDemo && !canTrade) {
          skipToast('⚠ Auto-sell skipped: wallet not ready', input.mint);
          return;
        }

        const toastId = pushToast({
          status: 'pending',
          title: `📤 Auto-sell: ${input.ticker} — ${input.sellPct}%`,
          mint: input.mint,
        });

        if (input.dataDemo) {
          await new Promise((r) => setTimeout(r, 1500));
          patchToast(toastId, {
            status: 'success',
            txSignature: 'DemoTx' + Math.random().toString(36).slice(2, 10) + 'demoautosell',
          });
          return;
        }

        ruleLastFire.current.set(`${ruleKey}:${input.mint}`, Date.now());

        const result = await sellTokenPct(input.mint, input.sellPct, { silent: true });
        if (!result) {
          patchToast(toastId, { status: 'failed', error: 'Trade did not start' });
          return;
        }
        if (result.ok) {
          patchToast(toastId, {
            status: 'success',
            txSignature: result.signature,
          });
        } else {
          patchToast(toastId, { status: 'failed', error: result.error });
        }
      } finally {
        inFlight.current.delete(dedupeKey);
      }
    },
    [canTrade, sellTokenPct],
  );

  const evaluateRules = useCallback(async () => {
    const prefs = useAutoSellStore.getState();
    if (!authenticated || !prefs.autoSellEnabled) return;
    if (useTrackAutomationStore.getState().global.killSwitchActive) return;
    const activeRules = prefs.rules.filter((r) => r.enabled);
    if (activeRules.length === 0) return;

    const token = await getAccessToken();
    if (!token) return;

    const res = await fetch('/api/portfolio?tradesLimit=40&fifoLimit=500', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const body = (await res.json()) as {
      positions?: PortfolioPosition[];
    };
    const positions = (body.positions ?? []).filter(
      (p) => p.mint && p.mint !== SOL_MINT && (p.valueUsd ?? 0) > 0,
    );
    if (positions.length === 0) return;

    const now = Date.now();
    for (const p of positions) {
      if (!positionOpenedAt.current.has(p.mint)) {
        positionOpenedAt.current.set(p.mint, now);
      }
    }

    const needsMc = activeRules.some(
      (r) => r.trigger.type === 'mc_milestone' || r.trigger.type === 'stop_loss_mc',
    );
    const mcByMint = needsMc
      ? await fetchMarketCaps(
          positions.map((p) => p.mint),
          getAccessToken,
        )
      : new Map<string, number | null>();

    for (const rule of activeRules) {
      for (const pos of positions) {
        if (!ruleMatchesMint(rule, pos.mint)) continue;

        const evalInput: PositionEvalInput = {
          mint: pos.mint,
          symbol: pos.symbol,
          costBasisUsd: pos.costBasisUsd,
          unrealizedPnlUsd: pos.unrealizedPnlUsd,
          marketCapUsd: mcByMint.get(pos.mint) ?? null,
          positionOpenedAtMs: positionOpenedAt.current.get(pos.mint) ?? null,
        };

        if (!evaluateAutoSellTrigger(rule.trigger, evalInput, now)) continue;

        const ticker = pos.symbol ?? pos.mint.slice(0, 6);
        void runAutoSell({
          mint: pos.mint,
          ticker,
          sellPct: rule.sellPct,
          ruleId: rule.id,
        });
      }
    }
  }, [authenticated, getAccessToken, runAutoSell]);

  usePortfolioRefreshListener(() => void evaluateRules(), authenticated);

  useEffect(() => {
    if (!authenticated) return;
    void evaluateRules();
  }, [authenticated, evaluateRules]);

  useEffect(() => {
    function onDispatch(e: Event) {
      const detail = (e as CustomEvent<AutoSellDispatchPayload>).detail;
      if (!detail?.mint) return;
      void runAutoSell({
        mint: detail.mint,
        ticker: detail.ticker ?? detail.mint.slice(0, 6),
        sellPct: detail.sellPct,
        ruleId: detail.ruleId,
        dataDemo: detail.dataDemo === true,
      });
    }
    window.addEventListener(POINTER_AUTO_SELL_DISPATCH_EVT, onDispatch);
    return () => window.removeEventListener(POINTER_AUTO_SELL_DISPATCH_EVT, onDispatch);
  }, [runAutoSell]);

  return null;
}
