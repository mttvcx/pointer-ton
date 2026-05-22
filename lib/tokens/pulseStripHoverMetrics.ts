import type { PulseTokenBundle } from '@/types/tokens';

function asInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Number.isInteger(v)) return v;
    if (Math.abs(v - Math.round(v)) < 1e-9) return Math.round(v);
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

/**
 * Pulse rows: “Pro traders” count when indexer fills `extended_metrics` / nested JSON.
 */
export function proTradersCountFromBundle(bundle: PulseTokenBundle): number | null {
  const roots = [bundle.snapshot?.extended_metrics, bundle.token.raw_metadata].filter(Boolean);
  const walk = (obj: unknown, depth: number): number | null => {
    if (depth > 12 || obj == null) return null;
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      const r = obj as Record<string, unknown>;
      for (const [k, v] of Object.entries(r)) {
        const kl = k.toLowerCase().replace(/\s+/g, '_');
        if (
          kl === 'pro_traders' ||
          kl === 'protraders' ||
          kl === 'pro_trader_count' ||
          kl === 'protrader_count'
        ) {
          const n = asInt(v);
          if (n != null && n >= 0) return n;
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
  for (const root of roots) {
    const n = walk(root, 0);
    if (n != null) return n;
  }
  return null;
}

/** Crown stat: migrated launches / total launches for this creator (Axiom semantics). */
export type DevMigrateFraction = {
  numerator: number | null;
  denominator: number | null;
};

export function devMigrateFractionFromBundle(bundle: PulseTokenBundle): DevMigrateFraction {
  const roots = [bundle.snapshot?.extended_metrics, bundle.token.raw_metadata].filter(Boolean);

  const pairFromRecord = (r: Record<string, unknown>): DevMigrateFraction | null => {
    const numKeys = ['dev_deploy_migrated', 'dev_migrated', 'migrated_deploys', 'migrated_deploy_count'];
    const denKeys = [
      'dev_deploy_total',
      'dev_launches_total',
      'tokens_created_by_dev',
      'total_deploys',
      'dev_launch_count',
    ];
    let numerator: number | null = null;
    let denominator: number | null = null;
    for (const nk of numKeys) {
      if (!(nk in r)) continue;
      const x = asInt(r[nk]);
      if (x != null && x >= 0) {
        numerator = x;
        break;
      }
    }
    for (const dk of denKeys) {
      if (!(dk in r)) continue;
      const x = asInt(r[dk]);
      if (x != null && x > 0) {
        denominator = x;
        break;
      }
    }
    if (numerator != null || denominator != null) return { numerator, denominator };

    /** Nested `dev_deploy: { migrated, total }` */
    const nest = r.dev_deploy_stats ?? r.devDeployStats ?? r.dev_deploy;
    if (nest && typeof nest === 'object' && !Array.isArray(nest)) {
      const o = nest as Record<string, unknown>;
      const m = asInt(o.migrated ?? o.migrated_count ?? o.migratedDeploys);
      const t = asInt(o.total ?? o.total_deploys ?? o.totalLaunches ?? o.count);
      if (m != null || (t != null && t > 0)) return { numerator: m, denominator: t };
    }
    return null;
  };

  const walk = (obj: unknown, depth: number): DevMigrateFraction | null => {
    if (depth > 14 || obj == null) return null;

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      const r = obj as Record<string, unknown>;
      const direct = pairFromRecord(r);
      if (direct) return direct;

      for (const v of Object.values(r)) {
        const h = walk(v, depth + 1);
        if (h != null && (h.numerator != null || h.denominator != null)) return h;
      }
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        const h = walk(item, depth + 1);
        if (h != null && (h.numerator != null || h.denominator != null)) return h;
      }
    }

    return null;
  };

  for (const root of roots) {
    const hit = walk(root, 0);
    if (hit && (hit.numerator != null || hit.denominator != null)) return hit;
  }

  return { numerator: null, denominator: null };
}

export function formatDevMigrateSlash(n: DevMigrateFraction): string {
  const { numerator: a, denominator: b } = n;
  if (a != null && b != null && b >= 0) return `${a}/${b}`;
  if (a != null) return `${a}/—`;
  if (b != null && b > 0) return `—/${b}`;
  return '—/—';
}
