/**
 * Pointer Sandbox Mode v1 — simulated price engine.
 *
 * Pure in-memory random walk. NO network, NO Helius/Jupiter. Tokens drift
 * every few seconds; some are biased to pump, some to dump. Subscribers get
 * notified on each tick so unrealized PnL + sparklines can update.
 */

import type { SandboxMarketToken } from '@/lib/sandbox/types';

const SPARK_LEN = 24;
const TICK_MS = 3000;

const SEED_TOKENS: Omit<SandboxMarketToken, 'spark' | 'changePct'>[] = [
  { mint: 'SBX1pumpPEEPEExxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'PEEPEE', name: 'Sandbox Peepee', priceSol: 0.0000021, bias: 'pump' },
  { mint: 'SBX2dumpRUGGYxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'RUGGY', name: 'Sandbox Ruggy', priceSol: 0.0000089, bias: 'dump' },
  { mint: 'SBX3neutMOONxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'MOON', name: 'Sandbox Moon', priceSol: 0.000045, bias: 'neutral' },
  { mint: 'SBX4pumpDEGENxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'DEGEN', name: 'Sandbox Degen', priceSol: 0.00012, bias: 'pump' },
  { mint: 'SBX5neutCHADxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'CHAD', name: 'Sandbox Chad', priceSol: 0.00031, bias: 'neutral' },
  { mint: 'SBX6dumpEXITxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', symbol: 'EXIT', name: 'Sandbox Exit', priceSol: 0.0000156, bias: 'dump' },
];

type Listener = (tokens: SandboxMarketToken[]) => void;

class SandboxMarket {
  private tokens: SandboxMarketToken[] = SEED_TOKENS.map((t) => ({
    ...t,
    changePct: 0,
    spark: Array.from({ length: SPARK_LEN }, () => t.priceSol),
  }));
  private basePrice = new Map<string, number>(SEED_TOKENS.map((t) => [t.mint, t.priceSol]));
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer || typeof window === 'undefined') return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    for (const t of this.tokens) {
      const drift = t.bias === 'pump' ? 0.012 : t.bias === 'dump' ? -0.012 : 0;
      const noise = (Math.random() - 0.5) * 0.06;
      const factor = 1 + drift + noise;
      t.priceSol = Math.max(1e-12, t.priceSol * factor);
      const base = this.basePrice.get(t.mint) ?? t.priceSol;
      t.changePct = ((t.priceSol - base) / base) * 100;
      t.spark = [...t.spark.slice(1), t.priceSol];
    }
    const snapshot = this.snapshot();
    for (const l of this.listeners) l(snapshot);
  }

  snapshot(): SandboxMarketToken[] {
    return this.tokens.map((t) => ({ ...t, spark: [...t.spark] }));
  }

  getToken(mint: string): SandboxMarketToken | null {
    return this.tokens.find((t) => t.mint === mint) ?? null;
  }

  /** Price for any mint — seeded sandbox tokens use the live walk; unknown
   * mints get a deterministic pseudo-price so external tokens still "work". */
  priceFor(mint: string): number {
    const known = this.getToken(mint);
    if (known) return known.priceSol;
    let h = 0;
    for (let i = 0; i < mint.length; i++) h = (h * 31 + mint.charCodeAt(i)) % 1_000_000;
    return 0.0000005 + (h / 1_000_000) * 0.0005;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

let singleton: SandboxMarket | null = null;

export function sandboxMarket(): SandboxMarket {
  if (!singleton) singleton = new SandboxMarket();
  return singleton;
}
