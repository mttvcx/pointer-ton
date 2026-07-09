# Packs — Diamond tier + jackpot solvency (1/20) rule

Adds a 5th pack between Gold and Legendary, and bakes a jackpot-solvency rule into
the economics so a single top hit can never exceed 5% (1/20) of a pack's reserve pool.

## New tier: Diamond

- Price band: target $270, min $200, max $450, cap 6 SOL → **4 SOL at reference (SOL=$72)**.
- 5 cards per open. Icy/cyan theme. Marketing name for the pack art: "Diamond Hands".
- Outcome table (`lib/packs/packTemplates.ts` `diamondTemplate`) sums to 10,000 bps.

Registered everywhere `PackType` is exhaustive: `types/pack.ts`, `lib/packs/pricing.ts`
(band + snapshot), `rarityTheme.ts` (PACK_VISUAL), `packTemplates.ts` (template + maps +
reference-price assert), `packArtIdentity.ts`, `packShowcase.ts`, the pack components
(`Pack3D`, `PackCard`, `PackFoilDesign`), and both API route zod enums.

## Jackpot solvency — the 1/20 rule

`lib/packs/packEconomics.ts`:
- `JACKPOT_POOL_DIVISOR = 20`.
- `maxAffordableJackpotSol(pool)` = `pool / 20` — the largest jackpot the pool can pay.
- `jackpotWithinPool(jackpot, pool)` = `jackpot <= pool/20`.
- New hard invariant in `computePackEconomics`: `maxPayoutSol` must be `<= rewardPoolBudgetSol / 20`.
  A pack fails validation (and won't load) if its advertised max jackpot exceeds 1/20 of its
  reserve pool. `rewardPoolBudgetSol` is the internal reserve (price × 60–120 per tier).

The helpers are ready to also gate at award/fulfillment time against the live treasury
balance (belt-and-suspenders); that runtime wiring is the next step and is intentionally
kept out of the money-movement path until reviewed.

## Verified economics (all at SOL=$72), all tests green

| Pack | Price | EV | House edge | maxPayout ÷ pool | 1/20 ceiling |
|---|---|---|---|---|---|
| Bronze | 0.15 | 73.6% | 26.4% | 0.011 | 0.050 |
| Silver | 0.5 | 76.2% | 23.8% | 0.015 | 0.050 |
| Gold | 2 | 71.4% | 28.6% | 0.020 | 0.050 |
| Diamond | 4 | 74.7% | 25.3% | 0.024 | 0.050 |
| Legendary | 5 | 71.7% | 28.3% | 0.030 | 0.050 |

Invariants (unchanged, still enforced by `packEconomics.test.ts` + `pricing.test.ts` across
SOL scenarios [60,72,80,120,150,220]):
- EV < pack price (house always wins long-run)
- EV ≤ 78% of price (`MAX_FULL_OPEN_EV_BPS`)
- house edge ≥ 22% (`MODELED_HOUSE_EDGE_MIN_BPS`)
- outcome bps sum = 10,000
- mythic jackpot EV ≤ per-pack `jackpotBudgetBps`
- **new:** maxPayout ≤ 1/20 of reserve pool

Run: `npm run test:packs` (pricing) or `node --import tsx --test lib/packs/*.test.ts`.
