import { z } from 'zod';
import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import type { PulseTokenBundle } from '@/types/tokens';
import type { PulseColumnId } from '@/lib/utils/constants';

/** Pulse “protocol” buckets for Pointer TON — venues / discovery sources (not Solana DEXes). */
export const PULSE_PROTOCOL_IDS = ['ton', 'dedust', 'stonfi', 'megaton'] as const;
export type PulseProtocolId = (typeof PULSE_PROTOCOL_IDS)[number];

/** Legacy Solana-era preset IDs → collapse into TON buckets when loading saved filters. */
const LEGACY_PROTOCOL_TO_TON: Record<string, PulseProtocolId> = {
  pump: 'ton',
  bags: 'ton',
  printr: 'ton',
  moonshot: 'ton',
  raydium: 'dedust',
  meteora: 'stonfi',
};

/** Migrate Solana-era preset/protocol IDs to TON buckets (Pulse filters + alert rules). */
export function migrateLegacyPulseProtocols(raw: unknown): PulseProtocolId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const next = new Set<PulseProtocolId>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if ((PULSE_PROTOCOL_IDS as readonly string[]).includes(item)) {
      next.add(item as PulseProtocolId);
      continue;
    }
    const mapped = LEGACY_PROTOCOL_TO_TON[item];
    if (mapped) next.add(mapped);
  }
  if (next.size === 0) return undefined;
  return PULSE_PROTOCOL_IDS.filter((p) => next.has(p));
}

export const COLUMN_SORT_KEYS = [
  'created_at',
  'market_cap_usd',
  'liquidity_usd',
  'holder_count',
  'volume_24h_usd',
  'age_minutes',
  'bonding_curve_pct',
] as const;
export type ColumnSortKey = (typeof COLUMN_SORT_KEYS)[number];

export const ColumnFiltersSchema = z
  .object({
    protocols: z.array(z.enum(PULSE_PROTOCOL_IDS)),
    quoteSol: z.boolean(),
    quoteUsdc: z.boolean(),
    quoteUsd1: z.boolean(),
    mcMin: z.number().nullable(),
    mcMax: z.number().nullable(),
    liqMin: z.number().nullable(),
    liqMax: z.number().nullable(),
    holdersMin: z.number().nullable(),
    holdersMax: z.number().nullable(),
    vol24hMin: z.number().nullable(),
    vol24hMax: z.number().nullable(),
    ageMinMinutes: z.number().nullable(),
    ageMaxMinutes: z.number().nullable(),
    bondingMinPct: z.number().nullable(),
    bondingMaxPct: z.number().nullable(),
    paidOnly: z.boolean(),
    lpLockedOnly: z.boolean(),
    mintRenouncedOnly: z.boolean(),
    freezeRenouncedOnly: z.boolean(),
    hasTwitter: z.boolean(),
    hasTelegram: z.boolean(),
    hasWebsite: z.boolean(),
    twitterFollowersMin: z.number().nullable(),
  })
  .strict();

export type ColumnFilters = z.infer<typeof ColumnFiltersSchema>;

export const BUY_BUTTON_STYLES = ['small', 'medium', 'large', 'ultra'] as const;
export type BuyButtonStyle = (typeof BUY_BUTTON_STYLES)[number];

/** MC in the metric strip vs prominent top-right (Axiom-style). */
export const MC_LAYOUTS = ['strip', 'hero'] as const;
export type McLayout = (typeof MC_LAYOUTS)[number];

export const ColumnDisplayOptionsSchema = z
  .object({
    showMc: z.boolean(),
    showLiq: z.boolean(),
    showVol: z.boolean(),
    showHolders: z.boolean(),
    showDev: z.boolean(),
    density: z.enum(['compact', 'normal', 'expanded']),
    showRiskFlags: z.boolean(),
    showBondingRing: z.boolean(),
    showLaunchpadBadge: z.boolean(),
    buyButtonStyle: z.enum(BUY_BUTTON_STYLES).default('medium'),
    mcLayout: z.enum(MC_LAYOUTS).default('hero'),
    /** Green pump.fun frame on the token image while still on-curve. */
    showPumpFrame: z.boolean().default(true),
    /** Cashback / agent / fee-share glyphs in the row. */
    showTraitIcons: z.boolean().default(true),
    /** Quick buy size for this column only (SOL). */
    quickBuySol: z.number().positive().max(1_000_000).default(0.5),
  })
  .strict();

export type ColumnDisplayOptions = z.infer<typeof ColumnDisplayOptionsSchema>;

export const DEFAULT_COLUMN_FILTERS: ColumnFilters = {
  protocols: [...PULSE_PROTOCOL_IDS],
  quoteSol: true,
  quoteUsdc: true,
  quoteUsd1: true,
  mcMin: null,
  mcMax: null,
  liqMin: null,
  liqMax: null,
  holdersMin: null,
  holdersMax: null,
  vol24hMin: null,
  vol24hMax: null,
  ageMinMinutes: null,
  ageMaxMinutes: null,
  bondingMinPct: null,
  bondingMaxPct: null,
  paidOnly: false,
  lpLockedOnly: false,
  mintRenouncedOnly: false,
  freezeRenouncedOnly: false,
  hasTwitter: false,
  hasTelegram: false,
  hasWebsite: false,
  twitterFollowersMin: null,
};

export const DEFAULT_COLUMN_DISPLAY_OPTIONS: ColumnDisplayOptions = {
  showMc: true,
  showLiq: true,
  showVol: true,
  showHolders: true,
  showDev: true,
  density: 'normal',
  showRiskFlags: true,
  showBondingRing: true,
  showLaunchpadBadge: true,
  buyButtonStyle: 'medium',
  /** Default to prominent MC (Axiom-style); users can switch to strip in Display. */
  mcLayout: 'hero',
  showPumpFrame: true,
  showTraitIcons: true,
  quickBuySol: 0.5,
};

export function normalizeColumnFilters(raw: unknown): ColumnFilters {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_COLUMN_FILTERS };
  const o = { ...(raw as Record<string, unknown>) };
  const migrated = migrateLegacyPulseProtocols(o.protocols);
  if (migrated) o.protocols = migrated;
  const merged = { ...DEFAULT_COLUMN_FILTERS, ...o };
  const p = ColumnFiltersSchema.safeParse(merged);
  return p.success ? p.data : { ...DEFAULT_COLUMN_FILTERS };
}

export function normalizeColumnDisplayOptions(raw: unknown): ColumnDisplayOptions {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_COLUMN_DISPLAY_OPTIONS };
  const o = raw as Record<string, unknown>;
  const migrated = { ...o };
  if (migrated.buyButtonStyle === 'normal') migrated.buyButtonStyle = 'medium';
  if (migrated.buyButtonStyle === 'outline') migrated.buyButtonStyle = 'ultra';
  if (migrated.buyButtonStyle === 'mega') migrated.buyButtonStyle = 'large';
  const merged = {
    ...DEFAULT_COLUMN_DISPLAY_OPTIONS,
    ...migrated,
  };
  const p = ColumnDisplayOptionsSchema.safeParse(merged);
  return p.success ? p.data : { ...DEFAULT_COLUMN_DISPLAY_OPTIONS };
}

const SharePayloadSchema = z
  .object({
    v: z.literal(1),
    column_id: z.enum(['new', 'stretch', 'migrated']),
    preset_slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    name: z.string().optional(),
    filters: ColumnFiltersSchema,
    display_options: ColumnDisplayOptionsSchema,
    sort_by: z.enum(COLUMN_SORT_KEYS),
    sort_dir: z.enum(['asc', 'desc']),
  })
  .strict();

export type ColumnPresetSharePayload = z.infer<typeof SharePayloadSchema>;

export function encodeColumnPresetShare(payload: ColumnPresetSharePayload): string {
  const json = JSON.stringify(payload);
  return btoa(encodeURIComponent(json));
}

export function decodeColumnPresetShare(raw: string): ColumnPresetSharePayload | null {
  try {
    const json = decodeURIComponent(atob(raw));
    const data: unknown = JSON.parse(json);
    const p = SharePayloadSchema.safeParse(data);
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

export function padToProtocols(pad: string | null): PulseProtocolId[] {
  if (!pad) return [];
  const p = pad.toLowerCase().trim();
  const out: PulseProtocolId[] = [];
  // `jettonToTokenRow` sets launch_pad: 'ton' for TonAPI ingest.
  if (p === 'ton' || p === 'tonapi') out.push('ton');
  // Friendly labels / legacy rows
  if (p === 'pump.fun' || p === 'pump' || p.includes('launchpad')) out.push('ton');
  if (p.includes('dedust')) out.push('dedust');
  if (p.includes('ston.fi') || p.includes('stonfi')) out.push('stonfi');
  if (p.includes('megaton')) out.push('megaton');
  const mapped = LEGACY_PROTOCOL_TO_TON[p];
  if (mapped) out.push(mapped);
  return [...new Set(out)];
}

function protocolsFromExtended(bundle: PulseTokenBundle): PulseProtocolId[] {
  const em = bundle.snapshot?.extended_metrics;
  if (!em || typeof em !== 'object' || Array.isArray(em)) return [];
  const r = em as Record<string, unknown>;
  const dex =
    (typeof r.dex === 'string' ? r.dex : '') ||
    (typeof r.dexId === 'string' ? r.dexId : '') ||
    (typeof r.poolDex === 'string' ? r.poolDex : '') ||
    '';
  const d = dex.toLowerCase();
  const out: PulseProtocolId[] = [];
  if (d.includes('dedust')) out.push('dedust');
  if (d.includes('stonfi') || d.includes('ston.fi')) out.push('stonfi');
  if (d.includes('megaton')) out.push('megaton');
  return [...new Set(out)];
}

export function tokenProtocolIds(bundle: PulseTokenBundle): Set<PulseProtocolId> {
  const set = new Set<PulseProtocolId>();
  for (const x of padToProtocols(bundle.token.launch_pad ?? null)) set.add(x);
  for (const x of protocolsFromExtended(bundle)) set.add(x);
  return set;
}

function quoteSymbolFromBundle(bundle: PulseTokenBundle): string | null {
  const em = bundle.snapshot?.extended_metrics;
  if (!em || typeof em !== 'object' || Array.isArray(em)) return null;
  const r = em as Record<string, unknown>;
  const sym =
    (typeof r.quoteSymbol === 'string' ? r.quoteSymbol : null) ??
    (typeof r.quote === 'string' ? r.quote : null) ??
    (typeof r.pairQuote === 'string' ? r.pairQuote : null);
  return sym?.trim() ? sym.trim().toUpperCase() : null;
}

export function quoteFilterPasses(bundle: PulseTokenBundle, f: ColumnFilters): boolean {
  const active = [f.quoteSol, f.quoteUsdc, f.quoteUsd1].filter(Boolean).length;
  if (active === 0) return false;
  if (active === 3) return true;
  const sym = quoteSymbolFromBundle(bundle);
  if (!sym) return true;
  if (sym.includes('SOL') && !f.quoteSol) return false;
  if ((sym.includes('USDC') || sym === 'USD') && !f.quoteUsdc) return false;
  if (sym.includes('USD1') && !f.quoteUsd1) return false;
  return true;
}

function numInRange(
  v: number | null | undefined,
  min: number | null,
  max: number | null,
  unknownPass: boolean,
): boolean {
  if (v == null || !Number.isFinite(v)) return unknownPass;
  if (min != null && v < min) return false;
  if (max != null && v > max) return false;
  return true;
}

function ageMinutes(createdIso: string): number {
  const t = new Date(createdIso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (Date.now() - t) / 60_000);
}

export function twitterFollowersFromBundle(bundle: PulseTokenBundle): number | null {
  const walk = (obj: unknown, depth: number): number | null => {
    if (depth > 8 || obj == null) return null;
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      const r = obj as Record<string, unknown>;
      for (const key of [
        'twitter_followers',
        'twitterFollowers',
        'followers_count',
        'followersCount',
      ]) {
        const n = r[key];
        if (typeof n === 'number' && Number.isFinite(n)) return n;
        if (typeof n === 'string' && n.trim()) {
          const x = Number(n);
          if (Number.isFinite(x)) return x;
        }
      }
      for (const v of Object.values(r)) {
        const h = walk(v, depth + 1);
        if (h != null) return h;
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const h = walk(item, depth + 1);
        if (h != null) return h;
      }
    }
    return null;
  };
  const fromSnap = bundle.snapshot?.extended_metrics
    ? walk(bundle.snapshot.extended_metrics, 0)
    : null;
  if (fromSnap != null) return fromSnap;
  return bundle.token.raw_metadata ? walk(bundle.token.raw_metadata, 0) : null;
}

export function pulseBundleMatchesFilters(bundle: PulseTokenBundle, f: ColumnFilters): boolean {
  if (f.protocols.length === 0) return false;
  if (f.protocols.length < PULSE_PROTOCOL_IDS.length) {
    const detected = tokenProtocolIds(bundle);
    if (detected.size > 0) {
      const ok = [...detected].some((p) => f.protocols.includes(p));
      if (!ok) return false;
    }
  }

  if (!quoteFilterPasses(bundle, f)) return false;

  const snap = bundle.snapshot;
  const mc = snap?.market_cap_usd ?? null;
  const liq = snap?.liquidity_usd ?? null;
  const holders = snap?.holder_count ?? null;
  const vol = snap?.volume_24h_usd ?? snap?.volume_1h_usd ?? null;

  if (!numInRange(mc, f.mcMin, f.mcMax, true)) return false;
  if (!numInRange(liq, f.liqMin, f.liqMax, true)) return false;
  if (!numInRange(holders, f.holdersMin, f.holdersMax, true)) return false;
  if (!numInRange(vol, f.vol24hMin, f.vol24hMax, true)) return false;

  const age = ageMinutes(bundle.token.created_at);
  if (!numInRange(age, f.ageMinMinutes, f.ageMaxMinutes, true)) return false;

  const bond = getPulseBondingRingState(bundle);
  const bondPct = bond.migrated ? 100 : bond.fillPct;
  if (f.bondingMinPct != null || f.bondingMaxPct != null) {
    if (bondPct == null) return true;
    if (!numInRange(bondPct, f.bondingMinPct, f.bondingMaxPct, true)) return false;
  }

  if (f.paidOnly && bundle.token.is_paid !== true) return false;
  if (f.lpLockedOnly && bundle.token.is_lp_locked !== true) return false;
  if (f.mintRenouncedOnly && bundle.token.mint_authority != null) return false;
  if (f.freezeRenouncedOnly && bundle.token.freeze_authority != null) return false;

  if (f.hasTwitter && !(bundle.token.twitter_handle && bundle.token.twitter_handle.trim()))
    return false;
  if (f.hasTelegram && !(bundle.token.telegram_url && bundle.token.telegram_url.trim()))
    return false;
  if (f.hasWebsite && !(bundle.token.website_url && bundle.token.website_url.trim()))
    return false;

  if (f.twitterFollowersMin != null && f.twitterFollowersMin > 0) {
    const tw = twitterFollowersFromBundle(bundle);
    if (tw == null || tw < f.twitterFollowersMin) return false;
  }

  return true;
}

export function sortPulseBundles(
  bundles: PulseTokenBundle[],
  sortBy: ColumnSortKey,
  sortDir: 'asc' | 'desc',
): PulseTokenBundle[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  const score = (b: PulseTokenBundle): number => {
    const snap = b.snapshot;
    switch (sortBy) {
      case 'created_at':
        return new Date(b.token.created_at).getTime();
      case 'market_cap_usd':
        return snap?.market_cap_usd ?? -Infinity;
      case 'liquidity_usd':
        return snap?.liquidity_usd ?? -Infinity;
      case 'holder_count':
        return snap?.holder_count ?? -Infinity;
      case 'volume_24h_usd':
        return snap?.volume_24h_usd ?? snap?.volume_1h_usd ?? -Infinity;
      case 'age_minutes':
        return ageMinutes(b.token.created_at);
      case 'bonding_curve_pct': {
        const bond = getPulseBondingRingState(b);
        return bond.migrated ? 100 : bond.fillPct ?? -Infinity;
      }
      default:
        return 0;
    }
  };
  return [...bundles].sort((a, b) => {
    const va = score(a);
    const vb = score(b);
    if (va === vb) return 0;
    return va < vb ? -1 * dir : 1 * dir;
  });
}

export function parseImportedPresetJson(
  raw: string,
  columnId: PulseColumnId,
): {
  filters: ColumnFilters;
  display_options: ColumnDisplayOptions;
  sort_by: ColumnSortKey;
  sort_dir: 'asc' | 'desc';
  name?: string;
} | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    if (typeof o.column_id === 'string' && o.column_id !== columnId) return null;
    const filters = normalizeColumnFilters(o.filters ?? o);
    const display_options = normalizeColumnDisplayOptions(
      o.display_options ?? o.display ?? DEFAULT_COLUMN_DISPLAY_OPTIONS,
    );
    const sort_by = COLUMN_SORT_KEYS.includes(o.sort_by as ColumnSortKey)
      ? (o.sort_by as ColumnSortKey)
      : 'created_at';
    const sort_dir = o.sort_dir === 'asc' || o.sort_dir === 'desc' ? o.sort_dir : 'desc';
    return { filters, display_options, sort_by, sort_dir, name: typeof o.name === 'string' ? o.name : undefined };
  } catch {
    return null;
  }
}
