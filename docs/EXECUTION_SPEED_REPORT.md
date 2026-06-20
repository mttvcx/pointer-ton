# Pointer — Buy/Sell Execution Speed Report

> Goal: match Axiom-class fill speed. Living doc — we fill the results table as we test with 0.001 SOL buys/sells.

## The bar (Axiom)
A 2026 guide claims Axiom does **"under 0.4s execution"** (alongside ~72% Solana bot volume share, $200M+ revenue). Treat the 0.4s as **click → transaction submitted to the network** (their hot path: pre-built tx + staked/swQoS RPC + skip-preflight), **not** click → on-chain confirmed. Confirmation is Solana-bound (~1 slot ≈ 0.4s best case; realistic P90 landing ≈ 1.4–3.0s across landing services per our research). So:
- **Submit latency** (click → broadcast): the number we can actually compete on → target **sub-1s, ideally ~0.4–0.6s**.
- **Confirm latency** (broadcast → finalized): mostly the network's job; we optimize landing (swQoS + Jito), but ~1–3s is the floor.

## How we fill (our pipeline)
`usePulseQuickBuy.executeBuy`: **quote** (`/api/trade/quote`, builds the Jupiter swap tx) → **sign+exec** (Privy `signAndSendTransaction` broadcasts, then `/api/trade/execute` records) → confirmation polls async (does NOT block the next buy).

Already shipped to cut latency:
- **Quote prefetch (depth-1):** while one buy signs, the next queued buy's quote is pre-built → spam-buys skip the ~300–800ms quote round-trip (`quote≈0ms` in telemetry = warm/prefetched).
- **Dual-path landing:** Helius Sender (swQoS) + Jito bundle raced in parallel (`lib/solana/submit.ts`).
- **Non-blocking FIFO queue:** the next buy starts as soon as the prior is submitted+recorded (not after confirmation).

## Telemetry (now instrumented)
Every buy/sell prints to the browser console AND shows on the success toast:
```
[pointer-speed] BUY total=NNNms quote=NNNms sign+exec=NNNms (prefetched|cold quote) mint=… amt=…
[pointer-speed] SELL total=NNNms quote+bal=NNNms sign+exec=NNNms mint=… pct=…
```
- **total** = click → "Filled in Xms" (submitted + recorded; the perceived fill).
- **quote** = building/fetching the swap tx (≈0 when prefetched).
- **sign+exec** = Privy wallet broadcast + execute POST.

## Where the time goes (expected, before live numbers)
| Stage | Cold (first/single buy) | Warm (spam, prefetched) | Lever |
|---|---|---|---|
| quote | ~300–800ms | ~0ms ✅ | prefetch (done) |
| sign+exec | ~400–1200ms | ~400–1200ms | Privy embedded-sign latency; execute POST |
| **total (submit)** | **~0.7–2.0s** | **~0.4–1.2s** | get sign+exec down |
| confirm (async) | ~1–3s | ~1–3s | swQoS/Jito tip (done); network-bound |

The **prefetch should already put warm spam-buys in range of the 0.4s bar on the submit metric.** The next grind is **sign+exec** (Privy embedded signing + the execute round-trip).

## Results log (fill as we test — 0.001 SOL)
| # | Date/UTC | Action | total ms | quote ms | sign+exec ms | prefetched? | notes |
|---|---|---|---|---|---|---|---|
| 1 | | BUY | | | | | first/cold |
| 2 | | BUY | | | | | spam #2 (warm?) |
| 3 | | BUY | | | | | spam #3 |
| 4 | | SELL | | | | | |

## Next levers if sign+exec is the bottleneck
1. **Make the execute POST fire-and-forget** (record server-side without blocking the toast) — shaves the execute round-trip off perceived fill.
2. **Pre-warm Privy signer / confirm embedded vs popup** — embedded click-to-sign should be fast; if it's slow, that's the target.
3. **Deeper quote prefetch** (depth-2/3) + prefetch on hover, not just in-queue.
4. **Direct pump.fun/Raydium program calls** for bonding-curve tokens (skip Jupiter entirely) — biggest architectural lever, but unverified that competitors do it; only if quote latency stays a problem on cold buys.
