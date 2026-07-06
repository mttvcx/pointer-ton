# Sibyl — unit economics & margins

We sell **token usage**, not raw scan counts. Each plan is a token-usage tier
(Starter → Default → Generous → Max). Under the hood the margin comes from three
levers, all already in code:

1. **Cheap-model routing** (`sibyl/modelRouter.ts`) — 80–95% of calls run on
   `gemini-2.5-flash` / `deepseek-chat` (fractions of a cent). Only `DEEP_SCAN` /
   `RESEARCH_REPORT` touch the premium judge (`gemini-2.5-pro`).
2. **Mode clamp** (`clampModeToPlan`) — a plan can't run a mode above its tier, so a
   Free user physically cannot trigger a $0.35 research report.
3. **Daily caps + deep-scan sub-caps** — bound the worst case per account.

## Cost per scan (blended, by tier's mode mix)

Per-mode compute cost (`MODE_COST_USD`, conservative):
`HOVER $0.0003 · QUICK $0.002 · STANDARD $0.012 · DEEP $0.08 · RESEARCH $0.35`.

| Tier | Mode mix (quick/std/deep/research) | Blended $/scan |
|---|---|---|
| Free (Starter) | 100 / 0 / 0 / 0 | ~$0.002 |
| Pro (Default) | 90 / 10 / 0 / 0 | ~$0.003 |
| Pro+ (Generous) | 80 / 15 / 5 / 0 | ~$0.0074 |
| Max (Max) | 70 / 20 / 8 / 2 | ~$0.017 |

## Margin per plan

Real SaaS usage lands well under the cap. Modeling **~5% of the daily cap** as the
typical power-user month (caps exist for the abusive tail, not the median):

| Plan | Price/mo | Daily cap | ~Scans/mo @5% | Compute/mo | **Gross margin** |
|---|---:|---:|---:|---:|---:|
| Free | $0 | 20 | ~30 | ~$0.06 | loss-leader (funnel) |
| Pro | $20 | 300 | ~450 | ~$1.35 | **~$18.6 / 93%** |
| Pro+ | $49 | 1,500 | ~2,250 | ~$16.7 | **~$32 / 66%** |
| Max | $199 | 6,000 | ~9,000 | ~$155 | **~$44 / 22%** |

**Worst case (100% of cap, all month)** is the stress test the caps defend:
Pro ≈ $118, Pro+ ≈ $333, Max ≈ $3.1K. That's why the daily cap + deep-scan sub-cap
(Pro+ 40/day, Max 200/day) + the mode clamp exist — they turn an unbounded LLM bill
into a bounded, known ceiling. Max is intentionally the thinnest margin (power/desk
users + the 5,000 API credits are metered separately), Pro/Pro+ carry the profit.

## What's wired vs. pending

- **Wired:** mode clamp (every scan), per-mode cost table, the flywheel logs every
  scan (`sibyl_scans`, with a nullable `user_id`) so usage is queryable.
- **To wire (needs auth → a real `user_id`):** a `usageToday(userId)` counter that
  reads `sibyl_scans` for the day and (a) blocks past the daily cap, (b) downgrades
  mode as the cap approaches, (c) meters API credits for Max. Stripe closes the loop.

API access (`/v1`) is a **Max & Enterprise** feature (`PlanConfig.apiAccess`).
