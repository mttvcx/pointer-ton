# Pointer Mobile — Advanced Mode Plan

**Goal:** when the center bird → `Adv.` is toggled on, the app flips from "normie/Simple" to **operator mode** — every screen deepens and the full web-terminal arsenal (sniping intel, automation, AI scan, trackers, holder forensics) becomes reachable. Info-dense is the point; the bar is *legible + usable*, not minimal.

**Core principle (locked with founder on web):** Advanced is **not a separate app** — it's a **mode toggle** that (a) expands existing screens with deeper sections and (b) unlocks operator-only surfaces. Same backend, client-side flag.

---

## How the 4 tabs + center toggle morph in Advanced

| Tab | Simple | **Advanced (operator)** |
|---|---|---|
| **Home** | Balance, Weekly trades, sort chips, token list | + Pulse-style **multi-column** discovery (New / Migrating / Graduated), per-row mini-metrics (MC, vol, holders, age, dev%), quick-buy preset chips, watchlist |
| **Search** | Token search + % | + Risk/age/liquidity **filters**, smart-money-bought tags, lineage (creator's other tokens) |
| **Social** | Leaderboard + follow | **becomes Smart-Money / Trackers**: KOL & wallet trackers, custom wallet labels, "3 smart wallets bought" feed, copytrade alerts (gated) |
| **Profile** | PnL, cashback, settings | + **Multiwallet** switcher + labels, positions table (FIFO PnL), closed trades, **PnL share cards**, entry to **Automation** |
| **Token screen** (overlay) | Chart, basic stats, AI one-liner, Buy | **The operator console** — see below |

The **center `Adv.` button** = the global toggle (done). Long-press could later open an **Automation hub** (auto-buy / limit orders / alerts / X-monitor) — flag below.

---

## The Token screen = the heart of Advanced

Today (Simple): sparkline, Market cap / Liquidity / Vol / Holders / Age, Buy. Advanced expands the **same screen** with collapsible operator sections:

1. **Chart, leveled up** — interval row (1s·1m·5m·15m·1h·1d), candle option, **tracked-wallet buy/sell markers**, indicator toggles. *(web: `/api/tokens/[mint]/chart`, `/wallet-markers`)*
2. **AI Verdict chip + "Why?"** — Healthy / Caution / High-rug-risk above Buy, expands to 3 plain-English bullets on real on-chain data. *(`/api/ai/explain-token`)* — the #1 "better than FOMO" moment.
3. **Risk & Authority panel** — Top-10 %, dev holding %, **sniper %, bundler %, insider %**, LP burned %, mint/freeze authority revoked. *(`/extended-metrics`, `/desk-wallet-stats`)*
4. **Holders dossier** — ranked top holders w/ PnL, entry, realized %, pro-trader count; tap a wallet → mini wallet intel. *(`/holders`, `/top-traders`)*
5. **Trade tape** — live buys/sells stream for the token. *(Pulse trades)*
6. **Buy/Sell with operator controls** — preset amounts, **slippage (fixed/dynamic), MEV mode**, plus a **Limit order** tab (buy/sell at price, expiry). *(`/trade/quote`+`/execute`, `/limit-orders`, `/presets`)*

Simple keeps a one-line summary of each (so normies still benefit passively); Advanced un-collapses the full module.

---

## Operator-only surfaces (Advanced unlocks these)

- **Trackers / Smart money** — list tracked wallets + KOL starter packs, 7D/30D PnL + win rate, buy/sell alerts, custom labels, tracker rules. *(`/trackers*`, `/wallet-labels`, `/wallet/[address]/analytics`)*
- **Automation** — auto-buy rules (trigger, amount, cooldown, daily cap), **limit orders**, **X (Twitter) monitor → auto-launch**, alert rules → push. *(`/alert-rules`, `/limit-orders`, X-monitor)*
- **AI scan** — token brief, wallet brief, "why did this alert fire" narration. *(`/api/ai/*`)*
- **Portfolio depth** — multiwallet, positions, FIFO realized/unrealized PnL, cash flow, **PnL share cards**. *(`/portfolio`, `/wallet/[address]/analytics`, `/pnl-cards`)*

**Deferred / not on mobile v1:** Perps, Predictions, Squads, Championships, Packs (off iOS), Admin. (Reachable later or web/dApp-store only.)

---

## Mobile-first treatment (dense but not ugly)

- **Collapsible accordion sections** on the token screen (operator can expand what they care about; default a couple open).
- **Horizontal-scroll metric strips** + **sticky section headers** so dense tables read on a phone.
- **Bottom sheets** for holder detail, wallet intel, trade controls, limit order — keeps the main scroll calm.
- **Monospaced numbers are BANNED** (locked rule) — clean sans, tabular alignment via fixed-width columns, plain zero.
- **Tap targets ≥ 44px**, values right-aligned, labels muted, dotted leaders (already the Stat pattern).

---

## Demo-mode data strategy (no auth/economics touched)

- **Live now (public API):** token snapshot, holders/extended-metrics where public, Pulse feed, charts. Wire these for real in Advanced.
- **Demo stubs:** trackers, automation rules, multiwallet, PnL, share cards, AI verdict (canned 3-bullet brief keyed off real metrics like dev% / LP). Clearly fake data, real UI — same as the rest of the shell.
- No sign/broadcast/money path is touched.

---

## Proposed build order (so you can course-correct cheaply)

1. **Token operator console** (risk panel + holders dossier + chart intervals + AI verdict) — the highest-impact, most-demoable. *(start here)*
2. **Buy/Sell + Limit + slippage/MEV controls** on the token screen.
3. **Social → Smart-money/Trackers** in Advanced.
4. **Automation hub** (auto-buy / limit / alerts / X-monitor) — entry from Profile or long-press Adv.
5. **Portfolio depth + PnL share cards** in Profile.

---

## Open questions for you (answer any, or "looks right")

1. In Advanced, should **Social tab become Trackers/Smart-money**, or keep Leaderboard and put Trackers elsewhere?
2. **Automation hub** — its own surface reached by **long-pressing the Adv button**, or a section inside Profile?
3. Token console: **accordion** (collapsible sections, my default) vs **sub-tabs** (Chart / Risk / Holders / Trade)?
4. How real should the **AI verdict** be in demo — canned bullets derived from live metrics (dev%, LP, holders), or fully stubbed text?
5. Anything from the web terminal you want **pulled forward** to Simple mode (vs advanced-only)?
