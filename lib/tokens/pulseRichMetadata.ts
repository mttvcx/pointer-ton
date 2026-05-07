import type { PulseTokenBundle } from '@/types/tokens';

const TRUTHY = new Set(['true', '1', 'yes', 'y']);

function boolish(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === 'number' && Number.isFinite(v)) return v !== 0;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    return TRUTHY.has(t);
  }
  return false;
}

/** Detect pump.fun-style livestream flags in Helius / launchpad JSON (best-effort). */
export function isPumpLiveFromMetadata(bundle: PulseTokenBundle): boolean {
  const { token } = bundle;
  if (token.launch_pad !== 'pump.fun') return false;

  const walk = (obj: unknown, depth: number): boolean => {
    if (depth > 12 || obj == null) return false;
    if (typeof obj === 'string') {
      const t = obj.toLowerCase();
      return t === 'live' || t.includes('streaming');
    }
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      const r = obj as Record<string, unknown>;
      for (const [k, v] of Object.entries(r)) {
        const kl = k.toLowerCase();
        if (
          kl.includes('is_live') ||
          kl.includes('islive') ||
          kl === 'live' ||
          kl.includes('broadcast') ||
          kl.includes('livestream')
        ) {
          if (boolish(v)) return true;
        }
        if (typeof v === 'string' && (kl.includes('live') || kl.includes('stream'))) {
          if (walk(v, depth + 1)) return true;
        }
        if (walk(v, depth + 1)) return true;
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (walk(item, depth + 1)) return true;
      }
    }
    return false;
  };

  return token.raw_metadata ? walk(token.raw_metadata, 0) : false;
}

function numish(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const m = v.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Buyback % for agent hover (metadata heuristics). */
export function agentBuybackPctFromMetadata(bundle: PulseTokenBundle): number | null {
  const walk = (obj: unknown, depth: number): number | null => {
    if (depth > 12 || obj == null) return null;
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      const r = obj as Record<string, unknown>;
      for (const [k, v] of Object.entries(r)) {
        const kl = k.toLowerCase();
        if (
          kl.includes('buyback') ||
          kl.includes('buy_back') ||
          kl.includes('agent_rate') ||
          kl === 'rebate_percent'
        ) {
          const n = numish(v);
          if (n != null && n >= 0 && n <= 100) return n;
        }
        const sub = walk(v, depth + 1);
        if (sub != null) return sub;
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const sub = walk(item, depth + 1);
        if (sub != null) return sub;
      }
    }
    return null;
  };
  return bundle.token.raw_metadata ? walk(bundle.token.raw_metadata, 0) : null;
}
