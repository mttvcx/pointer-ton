import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authToken, useAuth } from '../auth';
import { api, ApiError } from './client';
import { shortMint } from '../format';
import {
  useAutoRules,
  addRule as addLocalRule,
  toggleRule as toggleLocalRule,
  removeRule as removeLocalRule,
  type RuleTrigger,
  type RuleChain,
} from '../local';

/**
 * Binds the mobile Alerts UI to the real per-account automation backend
 * (`/api/alert-rules`), so rules PERSIST and SYNC web↔mobile. Demo mode (no auth)
 * falls back to the in-memory local store so Expo Go still works. The backend
 * unifies all 5 triggers into alert_rules; we map our compact mobile shape to its
 * `triggerType` / `triggerConfig` / `actionType` / `actionConfig` DTO.
 */

// ---- backend DTO (camelCase, from /api/alert-rules) ----
type AlertRuleDTO = {
  id: string | number;
  name?: string;
  triggerType: string;
  triggerConfig?: Record<string, unknown> | null;
  actionType?: string;
  actionConfig?: Record<string, unknown> | null;
  cooldownSeconds?: number;
  dailyCapSol?: number;
  isActive?: boolean;
};

/** The shape the Alerts UI renders (id is a string so server + local unify). */
export type UIRule = {
  id: string;
  trigger: RuleTrigger;
  target: string; // display label
  buySol: number;
  cooldownSec: number;
  dailyCapSol: number;
  enabled: boolean;
  chain?: RuleChain;
};

/** Everything needed to create a rule (raw target, not the display label). */
export type NewRuleInput = {
  trigger: RuleTrigger;
  rawTarget: string; // mint / wallet / handle(no @) / keyword
  display: string;
  priceMult?: number;
  buySol: number;
  cooldownSec: number;
  dailyCapSol: number;
  chain: RuleChain;
};

const TRIGGER_TO_DTO: Record<RuleTrigger, string> = {
  x_ca: 'ca_detected',
  x_keyword: 'keyword',
  tracked_wallet: 'tracked_wallet',
  price: 'price',
  image_match: 'image_match',
};
const DTO_TO_TRIGGER: Record<string, RuleTrigger> = {
  ca_detected: 'x_ca',
  keyword: 'x_keyword',
  tracked_wallet: 'tracked_wallet',
  price: 'price',
  image_match: 'image_match',
};

function buildPayload(input: NewRuleInput): Record<string, unknown> {
  const { trigger, rawTarget, priceMult, buySol, cooldownSec, dailyCapSol, chain } = input;
  let triggerConfig: Record<string, unknown>;
  switch (trigger) {
    case 'x_ca':
      triggerConfig = { handles: [rawTarget] };
      break;
    case 'x_keyword':
      triggerConfig = { handles: [], phrases: [rawTarget] };
      break;
    case 'tracked_wallet':
      triggerConfig = { wallet: rawTarget, side: 'any' };
      break;
    case 'price':
      triggerConfig = { mint: rawTarget, targetMultiple: priceMult ?? 2 };
      break;
    default:
      triggerConfig = { handles: [rawTarget] };
  }
  const buy = buySol > 0;
  return {
    name: input.display,
    triggerType: TRIGGER_TO_DTO[trigger],
    triggerConfig,
    actionType: buy ? 'buy' : 'notify',
    actionConfig: buy ? { buySolPreset: buySol, chain } : {},
    cooldownSeconds: cooldownSec,
    dailyCapSol,
    isActive: true,
  };
}

/** Derive the compact UI shape from a server DTO. */
function dtoToUI(dto: AlertRuleDTO): UIRule {
  const trigger = DTO_TO_TRIGGER[dto.triggerType] ?? 'x_ca';
  const cfg = dto.triggerConfig ?? {};
  const action = dto.actionConfig ?? {};
  // Prefer the saved name; else derive a label from the trigger config.
  let target = dto.name ?? '';
  if (!target) {
    if (trigger === 'x_ca' || trigger === 'x_keyword') {
      const h = (cfg.handles as string[] | undefined)?.[0];
      const p = (cfg.phrases as string[] | undefined)?.[0];
      target = p ? p : h ? '@' + h : '—';
    } else if (trigger === 'tracked_wallet') {
      target = shortMint(String(cfg.wallet ?? '—'));
    } else if (trigger === 'price') {
      target = `${shortMint(String(cfg.mint ?? '—'))} → ${cfg.targetMultiple ?? 2}x`;
    }
  }
  return {
    id: String(dto.id),
    trigger,
    target,
    buySol: typeof action.buySolPreset === 'number' ? action.buySolPreset : dto.actionType === 'buy' ? 0.1 : 0,
    cooldownSec: dto.cooldownSeconds ?? 0,
    dailyCapSol: dto.dailyCapSol ?? 0,
    enabled: dto.isActive ?? true,
    chain: (action.chain as RuleChain | undefined) ?? 'sol',
  };
}

// ---- raw CRUD ----
async function listAlertRules(): Promise<UIRule[]> {
  const r = await api<{ rules?: AlertRuleDTO[] }>('/api/alert-rules', { token: await authToken() });
  return (r.rules ?? []).map(dtoToUI);
}
async function createAlertRule(input: NewRuleInput): Promise<void> {
  const payload = buildPayload(input);
  const token = await authToken();
  try {
    await api('/api/alert-rules', { token, method: 'POST', body: payload });
  } catch (e) {
    // Defensive: if the backend's zod rejects the extra `chain` we tuck into
    // actionConfig (schema not yet confirmed), retry once without it so the rule
    // still saves. Chain persistence lands once the backend accepts the field.
    const ac = payload.actionConfig as Record<string, unknown> | undefined;
    if (e instanceof ApiError && e.status >= 400 && e.status < 500 && ac && 'chain' in ac) {
      const { chain: _drop, ...rest } = ac;
      await api('/api/alert-rules', { token, method: 'POST', body: { ...payload, actionConfig: rest } });
      return;
    }
    throw e;
  }
}
async function patchAlertRule(id: string, patch: Record<string, unknown>): Promise<void> {
  await api(`/api/alert-rules/${encodeURIComponent(id)}`, { token: await authToken(), method: 'PATCH', body: patch });
}
async function deleteAlertRule(id: string): Promise<void> {
  await api(`/api/alert-rules/${encodeURIComponent(id)}`, { token: await authToken(), method: 'DELETE' });
}

/**
 * Unified rules hook. Real mode → the backend (persisted, synced). Demo mode →
 * the in-memory local store. Same return shape either way, so the screen is
 * source-agnostic.
 */
export function useRules() {
  const auth = useAuth();
  const qc = useQueryClient();
  const local = useAutoRules();
  const isReal = auth.isLoggedIn && !auth.demo;

  const q = useQuery({
    queryKey: ['alert-rules'],
    queryFn: listAlertRules,
    enabled: isReal,
    staleTime: 20_000,
  });

  const rules: UIRule[] = isReal
    ? q.data ?? []
    : local.map((r) => ({
        id: String(r.id),
        trigger: r.trigger,
        target: r.target,
        buySol: r.buySol,
        cooldownSec: r.cooldownSec,
        dailyCapSol: r.dailyCapSol,
        enabled: r.enabled,
        chain: r.chain,
      }));

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['alert-rules'] }), [qc]);

  const add = useCallback(
    async (input: NewRuleInput) => {
      if (!isReal) {
        addLocalRule({
          trigger: input.trigger,
          target: input.display,
          buySol: input.buySol,
          cooldownSec: input.cooldownSec,
          dailyCapSol: input.dailyCapSol,
          enabled: true,
          chain: input.buySol > 0 ? input.chain : undefined,
        });
        return;
      }
      await createAlertRule(input);
      invalidate();
    },
    [isReal, invalidate],
  );

  const toggle = useCallback(
    async (id: string, next: boolean) => {
      if (!isReal) {
        toggleLocalRule(Number(id));
        return;
      }
      await patchAlertRule(id, { isActive: next });
      invalidate();
    },
    [isReal, invalidate],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!isReal) {
        removeLocalRule(Number(id));
        return;
      }
      await deleteAlertRule(id);
      invalidate();
    },
    [isReal, invalidate],
  );

  return { rules, loading: isReal && q.isLoading, isReal, add, toggle, remove, refetch: q.refetch };
}
