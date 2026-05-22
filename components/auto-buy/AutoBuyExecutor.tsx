'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { usePulseQuickBuy, type QuickBuyResult } from '@/lib/hooks/usePulseQuickBuy';
import {
  POINTER_AUTO_BUY_DISPATCH_EVT,
  type AutoBuyDispatchPayload,
  isAutoBuyTwitterListenAlert,
  parseTwitterListenAutoBuyPayload,
  tickerFromTwitterListenPayload,
} from '@/lib/alerts/autoBuyDispatch';
import { resolveAutoBuyAmountSol } from '@/lib/alerts/resolveAutoBuyAmount';
import { useAutoBuyStore } from '@/store/autoBuy';
import { useAutoBuyToastStore } from '@/store/autoBuyToasts';

function skipToast(title: string, mint?: string) {
  useAutoBuyToastStore.getState().push({
    status: 'skipped',
    title,
    mint,
  });
}

export function AutoBuyExecutor() {
  const { authenticated } = usePointerAuth();
  const { data } = useAlertsTickerQuery({ pollAggressively: true });
  const { buyToken } = usePulseQuickBuy();
  const seenIds = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);
  const ruleLastFire = useRef<Map<string, number>>(new Map());
  const inFlight = useRef<Set<string>>(new Set());

  const runAutoBuy = useCallback(
    async (input: {
      mint: string;
      ticker: string;
      amountSol: number;
      ruleId?: string | null;
      alertId?: string | null;
      dataDemo?: boolean;
    }) => {
      const prefs = useAutoBuyStore.getState();
      const pushToast = useAutoBuyToastStore.getState().push;
      const patchToast = useAutoBuyToastStore.getState().patch;
      const recordSpend = useAutoBuyStore.getState().recordAutoBuySpend;

      const dedupeKey = input.alertId ?? `${input.ruleId ?? 'demo'}:${input.mint}:${input.amountSol}`;
      if (inFlight.current.has(dedupeKey)) return;
      inFlight.current.add(dedupeKey);

      try {
        if (!input.dataDemo && !prefs.autoBuyEnabled) {
          console.info('[auto-buy] skipped: master toggle off');
          return;
        }

        const ruleKey = input.ruleId?.trim() || 'unknown-rule';
        const cooldownMs = Math.max(1, prefs.autoBuyCooldownSec) * 1000;
        const last = ruleLastFire.current.get(ruleKey) ?? 0;
        if (!input.dataDemo && Date.now() - last < cooldownMs) {
          skipToast('⏸ Auto-buy skipped: cooldown', input.mint);
          return;
        }

        const stats = useAutoBuyStore.getState().getTodayStats();
        if (
          !input.dataDemo &&
          stats.spentSol + input.amountSol > prefs.autoBuyDailyCapSol + 1e-9
        ) {
          skipToast('⚠ Auto-buy skipped: daily cap reached', input.mint);
          return;
        }

        const toastId = pushToast({
          status: 'pending',
          title: `⚡ Auto-buy: ${input.ticker} — ${input.amountSol} SOL`,
          mint: input.mint,
        });

        if (input.dataDemo) {
          await new Promise((r) => setTimeout(r, 1500));
          const fakeSig =
            'DemoTx' + Math.random().toString(36).slice(2, 10) + 'demoautobuy';
          patchToast(toastId, {
            status: 'success',
            txSignature: fakeSig,
          });
          return;
        }

        ruleLastFire.current.set(ruleKey, Date.now());

        const result = await buyToken(input.mint, input.amountSol, { silent: true });
        if (!result) {
          patchToast(toastId, { status: 'failed', error: 'Trade did not start' });
          return;
        }

        if (result.ok) {
          recordSpend(input.amountSol);
          patchToast(toastId, {
            status: 'success',
            txSignature: result.signature,
          });
        } else {
          patchToast(toastId, {
            status: 'failed',
            error: result.error,
          });
        }
      } finally {
        inFlight.current.delete(dedupeKey);
      }
    },
    [buyToken],
  );

  useEffect(() => {
    if (!authenticated || !data) return;

    if (!hydrated.current) {
      for (const a of data) seenIds.current.add(a.id);
      hydrated.current = true;
      return;
    }

    for (const alert of data) {
      if (seenIds.current.has(alert.id)) continue;
      seenIds.current.add(alert.id);
      if (!isAutoBuyTwitterListenAlert(alert.type, alert.payload)) continue;

      const p = parseTwitterListenAutoBuyPayload(alert.payload)!;
      const mint = p.mint!.trim();
      const amountSol = resolveAutoBuyAmountSol(p.buySolPreset);
      const ticker = tickerFromTwitterListenPayload(p, mint);

      void runAutoBuy({
        mint,
        ticker,
        amountSol,
        ruleId: p.ruleId,
        alertId: alert.id,
      });
    }
  }, [authenticated, data, runAutoBuy]);

  useEffect(() => {
    function onDispatch(e: Event) {
      const detail = (e as CustomEvent<AutoBuyDispatchPayload>).detail;
      if (!detail?.mint) return;
      void runAutoBuy({
        mint: detail.mint,
        ticker: detail.ticker,
        amountSol: detail.amountSol,
        ruleId: detail.ruleId,
        alertId: detail.alertId,
        dataDemo: detail.dataDemo === true,
      });
    }
    window.addEventListener(POINTER_AUTO_BUY_DISPATCH_EVT, onDispatch);
    return () => window.removeEventListener(POINTER_AUTO_BUY_DISPATCH_EVT, onDispatch);
  }, [runAutoBuy]);

  return null;
}
