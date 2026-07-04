import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authToken, useAuth } from '../auth';
import { api } from './client';
import { shortMint } from '../format';
import {
  useAutoSellRules,
  addAutoSell as addLocal,
  toggleAutoSell as toggleLocal,
  removeAutoSell as removeLocal,
  type AutoSellTrigger,
} from '../local';

/**
 * Binds the mobile Auto-sell UI to /api/auto-sell (per-account, synced with web).
 * Demo mode falls back to the local store. Maps the compact mobile rule (one
 * config number) to the backend's triggerConfig/tokenScope DTO.
 */

const CONFIG_FIELD: Record<AutoSellTrigger, string> = {
  mc_milestone: 'targetMcUsd',
  pct_gain: 'gainPct',
  time_elapsed: 'minutes',
  stop_loss_mc: 'mcUsd',
  trailing_stop: 'trailPct',
};

type AutoSellDTO = {
  id: string | number;
  name?: string;
  triggerType: AutoSellTrigger;
  triggerConfig?: Record<string, number> | null;
  sellPct?: number;
  tokenScope?: { kind: 'mint' | 'all_held'; mint?: string } | null;
  isActive?: boolean;
};

export type UISellRule = {
  id: string;
  trigger: AutoSellTrigger;
  value: number;
  sellPct: number;
  scopeMint?: string;
  scopeLabel?: string;
  enabled: boolean;
};

export type NewSellInput = {
  trigger: AutoSellTrigger;
  value: number;
  sellPct: number;
  scopeMint?: string;
  scopeLabel?: string;
};

function buildPayload(input: NewSellInput): Record<string, unknown> {
  return {
    triggerType: input.trigger,
    triggerConfig: { [CONFIG_FIELD[input.trigger]]: input.value },
    sellPct: input.sellPct,
    tokenScope: input.scopeMint ? { kind: 'mint', mint: input.scopeMint } : { kind: 'all_held' },
    walletScope: 'primary',
    isActive: true,
  };
}

function dtoToUI(dto: AutoSellDTO): UISellRule {
  const field = CONFIG_FIELD[dto.triggerType] ?? 'trailPct';
  const value = dto.triggerConfig?.[field] ?? 0;
  const mint = dto.tokenScope?.kind === 'mint' ? dto.tokenScope.mint : undefined;
  return {
    id: String(dto.id),
    trigger: dto.triggerType,
    value,
    sellPct: dto.sellPct ?? 100,
    scopeMint: mint,
    scopeLabel: mint ? shortMint(mint) : undefined,
    enabled: dto.isActive ?? true,
  };
}

async function listRules(): Promise<UISellRule[]> {
  const r = await api<{ rules?: AutoSellDTO[] }>('/api/auto-sell', { token: await authToken() });
  return (r.rules ?? []).map(dtoToUI);
}
async function createRule(input: NewSellInput): Promise<void> {
  await api('/api/auto-sell', { token: await authToken(), method: 'POST', body: buildPayload(input) });
}
async function patchRule(id: string, patch: Record<string, unknown>): Promise<void> {
  await api(`/api/auto-sell/${encodeURIComponent(id)}`, { token: await authToken(), method: 'PATCH', body: patch });
}
async function deleteRule(id: string): Promise<void> {
  await api(`/api/auto-sell/${encodeURIComponent(id)}`, { token: await authToken(), method: 'DELETE' });
}

export function useAutoSell() {
  const auth = useAuth();
  const qc = useQueryClient();
  const local = useAutoSellRules();
  const isReal = auth.isLoggedIn && !auth.demo;

  const q = useQuery({ queryKey: ['auto-sell'], queryFn: listRules, enabled: isReal, staleTime: 20_000 });

  const rules: UISellRule[] = isReal
    ? q.data ?? []
    : local.map((r) => ({
        id: String(r.id),
        trigger: r.trigger,
        value: r.value,
        sellPct: r.sellPct,
        scopeMint: r.scopeMint,
        scopeLabel: r.scopeLabel,
        enabled: r.enabled,
      }));

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['auto-sell'] }), [qc]);

  const add = useCallback(
    async (input: NewSellInput) => {
      if (!isReal) {
        addLocal({ trigger: input.trigger, value: input.value, sellPct: input.sellPct, scopeMint: input.scopeMint, scopeLabel: input.scopeLabel, enabled: true });
        return;
      }
      await createRule(input);
      invalidate();
    },
    [isReal, invalidate],
  );
  const toggle = useCallback(
    async (id: string, next: boolean) => {
      if (!isReal) {
        toggleLocal(Number(id));
        return;
      }
      await patchRule(id, { isActive: next });
      invalidate();
    },
    [isReal, invalidate],
  );
  const remove = useCallback(
    async (id: string) => {
      if (!isReal) {
        removeLocal(Number(id));
        return;
      }
      await deleteRule(id);
      invalidate();
    },
    [isReal, invalidate],
  );

  return { rules, loading: isReal && q.isLoading, add, toggle, remove };
}
