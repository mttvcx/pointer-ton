import 'server-only';

/**
 * Pointer Financial → Lulo (lulo.fi) client — the yield engine for idle USDC.
 * Lulo is a Solana-native RESTful aggregator (routes across Kamino/Morpho/Maple
 * etc. with principal protection). Users only see "Smart Yield", never "Lulo".
 *
 * KEY-GATED on `LULO_API_KEY`. With no key the whole yield layer reports
 * "not configured" and the app shows its demo APY.
 *
 * This wires the READ side (live APY) — real and safe, no funds move. Deposit /
 * withdraw generate unsigned Solana transactions the user's wallet must sign;
 * that flow is a separate step (see `generateDeposit`, not yet surfaced).
 *
 * Docs: https://lulo.fi/docs · base https://api.lulo.fi · header `x-api-key`.
 */

export class LuloNotConfiguredError extends Error {
  constructor() {
    super('LULO_NOT_CONFIGURED');
    this.name = 'LuloNotConfiguredError';
  }
}

export function isLuloConfigured(): boolean {
  return !!process.env.LULO_API_KEY?.trim();
}

function luloBase(): string {
  return process.env.LULO_API_BASE?.trim() || 'https://api.lulo.fi';
}

async function luloFetch<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown; walletPubkey?: string }): Promise<T> {
  const key = process.env.LULO_API_KEY?.trim();
  if (!key) throw new LuloNotConfiguredError();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-api-key': key };
  if (init?.walletPubkey) headers['x-wallet-pubkey'] = init.walletPubkey;
  const res = await fetch(`${luloBase()}${path}`, {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers,
    body: init?.body != null ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`Lulo request failed (${res.status})`);
  return json as T;
}

// APY values may arrive as a decimal (0.0765) or a percent (7.65). Normalize → %.
function toPct(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n <= 1 ? n * 100 : n;
}

export type LuloRates = { protectedApyPct: number | null; boostApyPct: number | null };

export const lulo = {
  configured: isLuloConfigured,

  /** Current Protected + Boost APY (`GET /v1/rates.getRates`). Defensive about the
   *  exact JSON keys — the dev-dashboard schema is authoritative; this reads the
   *  documented shape and degrades to null if the shape shifts. */
  async getRates(): Promise<LuloRates> {
    const raw = await luloFetch<Record<string, unknown>>('/v1/rates.getRates');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const root: any = (raw as any)?.data ?? raw;
    const pick = (node: unknown): number | null => {
      if (node == null) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o = node as any;
      return toPct(o?.CURRENT ?? o?.current ?? o?.apy ?? o);
    };
    return {
      protectedApyPct: pick(root?.protected ?? root?.PROTECTED),
      boostApyPct: pick(root?.regular ?? root?.boost ?? root?.BOOST),
    };
  },

  /** Unsigned deposit transaction (base64) for the user's wallet to sign. Not yet
   *  surfaced in the app — kept ready for the auto-sweep flow. */
  async generateDeposit(input: { owner: string; mintAddress: string; depositAmount: string; priorityFee?: number }): Promise<unknown> {
    const fee = input.priorityFee ?? 50000;
    return luloFetch(`/v1/generate.transactions.deposit?priorityFee=${fee}`, {
      method: 'POST',
      walletPubkey: input.owner,
      body: { owner: input.owner, mintAddress: input.mintAddress, depositAmount: input.depositAmount },
    });
  },
};
