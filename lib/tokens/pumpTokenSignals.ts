import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import type { PulseTokenBundle } from '@/types/tokens';

export type PulseRowTraitFlags = {
  cashback: boolean;
  agent: boolean;
  feeShare: boolean;
  /** pump.fun still on bonding curve (show green frame). */
  pumpFunBonding: boolean;
};

const TRUTHY = new Set(['true', '1', 'yes', 'y']);

function keyHintsCashback(k: string): boolean {
  const l = k.toLowerCase();
  return (
    l.includes('cashback') ||
    l === 'rebate' ||
    l.includes('rebate_percent') ||
    l.includes('isrebate')
  );
}

function keyHintsAgent(k: string): boolean {
  const l = k.toLowerCase();
  return (
    l === 'agent' ||
    l.includes('agent_mode') ||
    l.includes('agentmode') ||
    l.includes('pump_agent') ||
    l.includes('ai_agent') ||
    l.includes('is_agent')
  );
}

function keyHintsFeeShare(k: string): boolean {
  const l = k.toLowerCase();
  return (
    l.includes('fee_share') ||
    l.includes('feeshare') ||
    l.includes('shared_fee') ||
    l.includes('creator_fee') ||
    l.includes('royalty') ||
    l.includes('rev_share') ||
    l.includes('revenue_share')
  );
}

function boolish(v: unknown): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === 'number' && Number.isFinite(v)) return v !== 0;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === '') return null;
    if (TRUTHY.has(t)) return true;
    if (t === 'false' || t === '0' || t === 'no') return false;
  }
  return null;
}

/**
 * Walk Helius / pump raw JSON for optional launch trait signals.
 */
function walkTraits(obj: unknown, depth: number): Omit<PulseRowTraitFlags, 'pumpFunBonding'> {
  const acc = { cashback: false, agent: false, feeShare: false };
  if (depth > 12 || obj == null) return acc;

  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const r = obj as Record<string, unknown>;
    for (const ek of Object.entries(r)) {
      const key = ek[0];
      const val = ek[1];
      const b = boolish(val);
      if (b === true) {
        if (keyHintsCashback(key)) acc.cashback = true;
        if (keyHintsAgent(key)) acc.agent = true;
        if (keyHintsFeeShare(key)) acc.feeShare = true;
      }
      if (typeof val === 'string') {
        const low = val.toLowerCase();
        if (low.includes('cashback') || low.includes('rebate')) acc.cashback = true;
        if (/\bagent\b/.test(low) && !low.includes('user_agent')) acc.agent = true;
        if (low.includes('fee share') || low.includes('feeshare') || low.includes('rev share'))
          acc.feeShare = true;
      }
      const sub = walkTraits(val, depth + 1);
      acc.cashback = acc.cashback || sub.cashback;
      acc.agent = acc.agent || sub.agent;
      acc.feeShare = acc.feeShare || sub.feeShare;
    }
    return acc;
  }

  if (Array.isArray(obj)) {
    const acc2 = { cashback: false, agent: false, feeShare: false };
    for (const item of obj) {
      const sub = walkTraits(item, depth + 1);
      acc2.cashback = acc2.cashback || sub.cashback;
      acc2.agent = acc2.agent || sub.agent;
      acc2.feeShare = acc2.feeShare || sub.feeShare;
    }
    return acc2;
  }

  return acc;
}

export function getPulseRowTraitFlags(bundle: PulseTokenBundle): PulseRowTraitFlags {
  const { token, snapshot } = bundle;
  const bond = getPulseBondingRingState(bundle);
  const lp = token.launch_pad?.toLowerCase() ?? '';
  const pumpFunBonding = (lp === 'pump.fun' || lp === 'pump') && !bond.migrated;

  let cashback = false;
  let agent = false;
  let feeShare = false;

  if (token.raw_metadata) {
    const w = walkTraits(token.raw_metadata, 0);
    cashback = w.cashback;
    agent = w.agent;
    feeShare = w.feeShare;
  }
  if (snapshot?.extended_metrics) {
    const w = walkTraits(snapshot.extended_metrics, 0);
    cashback = cashback || w.cashback;
    agent = agent || w.agent;
    feeShare = feeShare || w.feeShare;
  }

  return { cashback, agent, feeShare, pumpFunBonding };
}
