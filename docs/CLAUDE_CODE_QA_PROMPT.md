# Claude Code — Full Pointer QA Prompt

Copy everything inside the block below into Claude Code when you hand it this repo. Claude should read files, run the app, browse Axiom on your PC, test every surface, compare performance, trade with tiny amounts only, document gaps, and fix P0/P1 issues.

---

```
You are the QA + fix engineer for Pointer (pointer-ton), an Axiom-inspired Solana trading terminal.

## 0. Read first (mandatory, in order)

1. HANDOFF.md — current project state (routes, what works, known gaps)
2. AGENTS.md — hard rules (no raw SQL in routes, Zod boundaries, theme tokens, minimal diff)
3. AXIOM_READY_EXECUTION_REPORT.md — indexer & verification baseline
4. REALTIME_INGESTION_REPORT.md — cron / webhook expectations

Repo: https://github.com/mttvcx/pointer-ton
Local: npm install && npm run dev → http://127.0.0.1:3001 (port 3001, not 3000)
Requires .env.local (copy from .env.example) — ask the user if keys missing.

## 1. Your mission

Run a **complete QA pass** of Pointer vs **https://axiom.trade** on the user's machine:

- Every screen, modal, tab, and settings panel listed in HANDOFF.md
- Load times (cold + warm navigation) — note seconds, not vibes
- Data accuracy on token desks (trades tape, holders, top traders, PnL strip, balances)
- Buy/sell execution path end-to-end with **minimal SOL spend**
- Document everything that is wrong, slow, empty, or worse than Axiom
- Then **fix P0/P1 issues** you can resolve in-repo without burning API credits
- Leave a written report at docs/QA_RUN_REPORT_<YYYY-MM-DD>.md when done

## 2. Safety rails (do not burn the user's money or API quota)

### Trading
- **Maximum buy size: 0.001 SOL** per test trade (~$0.15–0.25). Jupiter rejects below this.
- Prefer **one buy + one sell** per test mint, not spam.
- Test mints: use indexed pumps already in DB if possible:
  - ISLANDS: yoA2CoHk6HRNtFuTP1kVt5xkcvG7mr5raQ5zuNxpump
  - WIF: EkJubxxx… or search HANDOFF / AXIOM report for full CAs
- Set NEXT_PUBLIC_FOUNDER_BETA=1 in .env.local for 0.001 presets if not set.
- **Never** run large backfills (maxPages > 6) without asking user.
- If wallet has no SOL, stop and tell user — do not loop failed txs.

### API / credits
- Do not hammer Helius: max 1 indexer backfill per mint during QA.
- Do not run cron:loop for hours; one manual cron cycle is enough to verify.
- Skip AI co-pilot deep mode unless user asks (cost ceiling $0.30/day).

### Auth
- User must be logged in (Privy) with a funded Solana wallet for trade tests.
- If auth blocked, document and continue non-auth surfaces.

## 3. Axiom comparison method

Open **axiom.trade** in browser alongside Pointer.

For each comparable surface, record:

| Field | Pointer | Axiom | Verdict |
|-------|---------|-------|---------|
| First paint / interactive (s) | | | |
| Data present (Y/N/partial) | | | |
| UX parity (layout, density, honesty) | | | |
| Bugs / blockers | | | |

**Compare behavior, not pixel-perfect clone.** Pointer uses its own theme tokens.

Priority surfaces for Axiom parity:
1. Pulse (NEW / MIGRATED columns, quick-buy)
2. Token desk: chart, buy/sell, trades tape, holders, top traders, PnL strip
3. Global search (CA paste, filter chips)
4. Track / wallet tracker toasts
5. Portfolio holdings

Lower priority (Pointer preview / Phase 2): Perps, stock perps, packs commerce, championship live.

## 4. Screen-by-screen checklist

Check each route. For every item: PASS / FAIL / PARTIAL + notes.

### Pulse `/pulse`
- [ ] Columns load with real MC/V/L (not all `--`)
- [ ] Quick-buy FIFO (spam-click 3 rows — queue drains, no stuck spinners)
- [ ] Row click opens token; V/MC area clickable on medium/large preset
- [ ] Protocol filter chips work
- [ ] Stocks column → `/stock/SYMBOL` opens perp shell
- [ ] Load time vs Axiom pulse (note seconds)

### Token desk `/token/[mint]`
Test ISLANDS + one other indexed mint + one non-indexed mint.
- [ ] Header: price, MC, liquidity, socials
- [ ] Chart loads (Lightweight Charts)
- [ ] **Balance** shows correct token amount (Token-2022 pump tokens — not 0)
- [ ] **PnL strip:** Bought / Sold / Holding / PnL — not −100% when still holding winner
- [ ] Buy 0.001 SOL → confirm → balance updates within 30s
- [ ] Sell partial → PnL updates
- [ ] Trades tab: indexed swaps OR honest "indexer pending"
- [ ] Holders: real wallets; bought/avg/PnL real when indexed
- [ ] Top traders: populated when indexed
- [ ] Dev tokens tab when creator known
- [ ] AI panel opens (don't burn quota)

### Explore `/explore`
- [ ] Table + mindshare bubbles render
- [ ] Hover tooltips not broken

### Track `/track` + Trackers `/trackers`
- [ ] Add/remove tracked wallet
- [ ] KOL tab: Mint starter KOLs button works (opt-in)
- [ ] Paste import (Kolscan/Axiom format) if UI exposed
- [ ] Wallet tracker toast on tracked wallet trade (may need webhook/cron)

### Portfolio `/portfolio`
- [ ] Holdings load; SOL USD rate
- [ ] No full-page red on Jupiter 429 (graceful SOL-only fallback)

### Predictions `/predictions`
- [ ] Markets load from `/api/predictions/markets`
- [ ] Crypto filter; market detail page
- [ ] Compare load time vs Kalshi/Axiom predictions if applicable

### Packs `/packs`
- [ ] Opens; clearly simulated if not live commerce

### Perps `/perps` + Stock `/stock/OPENAI`
- [ ] Terminal shell renders; orders labeled preview/Phase 2
- [ ] No false "live" trading claims

### Squads `/squads`
- [ ] Chat panel; float/dock
- [ ] Dead actions show honest Phase 2 messaging

### Global chrome
- [ ] Topbar nav (reorder in Display settings persists)
- [ ] Global search: wide modal, CA resolve, filter chips (Pump/Bonk/Bags)
- [ ] Bottom bar: region menu, stable cluster
- [ ] Deposit modal: asset icons (PYUSD etc.)
- [ ] Watchlist ticker bar

### Settings / Display
- [ ] Column presets (small/medium/large buy buttons visibly different)
- [ ] Topbar nav drag reorder

### Admin `/admin` (if founder access)
- [ ] Loads without 403 for bootstrap user

## 5. Automated checks (run these)

```bash
npm run typecheck
npm test
```

Note any failures. Fix test regressions you introduce; pre-existing failures → list in report.

Optional smoke API (server must be running):

```bash
curl.exe -s "http://127.0.0.1:3001/api/predictions/markets?deskCategory=Crypto&limit=3"
curl.exe -s "http://127.0.0.1:3001/api/tokens/yoA2CoHk6HRNtFuTP1kVt5xkcvG7mr5raQ5zuNxpump/chain-trades?limit=5"
```

## 6. Performance notes to capture

For Pulse + one token desk + Portfolio, record:

- Time to first contentful row (stopwatch or Performance tab)
- Time after navigation from Pulse → token → back
- Buy quote latency (quote API → UI ready)
- Tx confirm time (sign → confirmed toast)

Compare qualitatively to Axiom on same network/machine.

## 7. Fix pass (after documenting)

Priority order:
1. **P0** — Wrong balance, wrong PnL, broken buy/sell, crashes, auth blockers
2. **P1** — Empty data when indexer should have rows; slow loads >5s on localhost; broken clicks
3. **P2** — Visual polish, Axiom layout deltas, Phase 2 features

Rules while fixing:
- Minimal diff; match existing code style
- No raw SQL in routes; use lib/db/*
- Theme tokens only
- Add/adjust tests when fixing logic bugs
- Do NOT commit unless user asks — but DO write docs/QA_RUN_REPORT_<date>.md

## 8. Deliverable format

Create `docs/QA_RUN_REPORT_<YYYY-MM-DD>.md` with:

1. **Executive summary** (5 bullets)
2. **Environment** (Node version, founder beta on/off, wallet funded Y/N)
3. **Axiom comparison table** (top 5 surfaces)
4. **Full checklist results** (PASS/FAIL/PARTIAL)
5. **Bugs filed** (severity, repro steps, file hints)
6. **Fixes applied** (file list + what changed)
7. **Remaining blockers** (need user action: keys, SOL, deploy webhook)
8. **Recommended next sprint** (ordered P0–P2)

Then give the user a short summary in chat with link to the report file.

## 9. Do not

- Force-push main
- Commit secrets
- Spend >0.01 SOL total on test trades without explicit user OK
- Scope-creep Phase 2 features (mobile, copy-trade, TGE, mainnet fee program)
- Edit dex-trader repo
- Fake data in live mode (no demo flags unless testing demo explicitly)

Start by reading HANDOFF.md, then npm run dev, then work the checklist systematically.
```

---

## After Claude finishes

Review `docs/QA_RUN_REPORT_*.md`, approve fixes, then ask Claude to commit if you want changes on GitHub.
