/**
 * EMERGENCY CONTROL — pure logic (no server-only / Next / Redis imports) so it
 * is unit-testable in isolation. The I/O wrapper lives in `controls.ts`.
 */

export type EmergencyChain = 'sol' | 'base' | 'eth' | 'bnb' | 'robinhood' | 'ton';
export const EMERGENCY_CHAINS: readonly EmergencyChain[] = ['sol', 'base', 'eth', 'bnb', 'robinhood', 'ton'];

export type EmergencyBannerLevel = 'info' | 'warn' | 'critical';
export type EmergencyBanner = { message: string; level: EmergencyBannerLevel };

export interface EmergencyControls {
  trading: boolean;
  ai: boolean;
  packs: boolean;
  cashback: boolean;
  referral: boolean;
  chains: Record<EmergencyChain, boolean>;
  /** Whole-app pause: only admins + the public status endpoint get through. */
  maintenance: boolean;
  /** Block every mutation (writes); reads still work. */
  readOnly: boolean;
  banner: EmergencyBanner | null;
  updatedAt: string;
  updatedBy: string | null;
}

/** No incident: everything on. */
export function defaultControls(): EmergencyControls {
  return {
    trading: true,
    ai: true,
    packs: true,
    cashback: true,
    referral: true,
    chains: { sol: true, base: true, eth: true, bnb: true, robinhood: true, ton: true },
    maintenance: false,
    readOnly: false,
    banner: null,
    updatedAt: new Date(0).toISOString(),
    updatedBy: null,
  };
}

/** We could not read the truth: pause everything that spends money / calls a
 *  provider / mutates. Reads keep working (maintenance stays false). */
export function failClosedControls(): EmergencyControls {
  return {
    trading: false,
    ai: false,
    packs: false,
    cashback: false,
    referral: false,
    chains: { sol: false, base: false, eth: false, bnb: false, robinhood: false, ton: false },
    maintenance: false,
    readOnly: true,
    banner: {
      message: 'Pointer is in a degraded state — trading and AI are temporarily paused.',
      level: 'critical',
    },
    updatedAt: new Date(0).toISOString(),
    updatedBy: 'fail-closed',
  };
}

/** Merge a stored (possibly partial / legacy) blob onto the defaults. */
export function normalizeControls(raw: Partial<EmergencyControls> | null | undefined): EmergencyControls {
  const d = defaultControls();
  if (!raw || typeof raw !== 'object') return d;
  return {
    trading: typeof raw.trading === 'boolean' ? raw.trading : d.trading,
    ai: typeof raw.ai === 'boolean' ? raw.ai : d.ai,
    packs: typeof raw.packs === 'boolean' ? raw.packs : d.packs,
    cashback: typeof raw.cashback === 'boolean' ? raw.cashback : d.cashback,
    referral: typeof raw.referral === 'boolean' ? raw.referral : d.referral,
    chains: { ...d.chains, ...(raw.chains ?? {}) },
    maintenance: typeof raw.maintenance === 'boolean' ? raw.maintenance : d.maintenance,
    readOnly: typeof raw.readOnly === 'boolean' ? raw.readOnly : d.readOnly,
    banner: raw.banner && typeof raw.banner.message === 'string' ? raw.banner : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : d.updatedAt,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
  };
}

export type EmergencyBlockCode =
  | 'maintenance'
  | 'read_only'
  | 'trading_paused'
  | 'chain_paused'
  | 'ai_paused'
  | 'packs_paused'
  | 'cashback_paused'
  | 'referral_paused';

export class EmergencyBlockedError extends Error {
  constructor(
    public code: EmergencyBlockCode,
    message: string,
  ) {
    super(message);
    this.name = 'EmergencyBlockedError';
  }
}

function haltError(c: EmergencyControls, opts: { write: boolean }): EmergencyBlockedError | null {
  if (c.maintenance) return new EmergencyBlockedError('maintenance', 'Pointer is in maintenance mode.');
  if (opts.write && c.readOnly) return new EmergencyBlockedError('read_only', 'Pointer is in read-only mode.');
  return null;
}

// Pure decision functions. `null` = allowed.
export function decideTrading(c: EmergencyControls, chain?: EmergencyChain): EmergencyBlockedError | null {
  const h = haltError(c, { write: true });
  if (h) return h;
  if (!c.trading) return new EmergencyBlockedError('trading_paused', 'Trading is temporarily paused.');
  if (chain && !c.chains[chain]) {
    return new EmergencyBlockedError('chain_paused', `${chain.toUpperCase()} trading is temporarily paused.`);
  }
  return null;
}
export function decideAi(c: EmergencyControls): EmergencyBlockedError | null {
  if (c.maintenance) return new EmergencyBlockedError('maintenance', 'Pointer is in maintenance mode.');
  if (!c.ai) return new EmergencyBlockedError('ai_paused', 'AI features are temporarily paused.');
  return null;
}
export function decidePacks(c: EmergencyControls): EmergencyBlockedError | null {
  const h = haltError(c, { write: true });
  if (h) return h;
  if (!c.packs) return new EmergencyBlockedError('packs_paused', 'Packs are temporarily paused.');
  return null;
}
export function decideCashback(c: EmergencyControls): EmergencyBlockedError | null {
  const h = haltError(c, { write: true });
  if (h) return h;
  if (!c.cashback) return new EmergencyBlockedError('cashback_paused', 'Cashback is temporarily paused.');
  return null;
}
export function decideReferral(c: EmergencyControls): EmergencyBlockedError | null {
  const h = haltError(c, { write: true });
  if (h) return h;
  if (!c.referral) return new EmergencyBlockedError('referral_paused', 'Referrals are temporarily paused.');
  return null;
}
export function decideWrite(c: EmergencyControls): EmergencyBlockedError | null {
  return haltError(c, { write: true });
}
