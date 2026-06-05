# Pointer TON — Agent Handoff

> **Last updated:** 2026-05-30 (end of long Cursor session — **many changes uncommitted on `main`**)
> **GitHub:** https://github.com/mttvcx/pointer-ton
> **Read this file first in every new chat.** Also skim `AGENTS.md` + `README.md`.

---

## Copy-paste prompt for a new chat

```
You are continuing work on Pointer (pointer-ton). Before doing anything:

1. Read HANDOFF.md at the repo root in full — it is the session continuity doc.
2. Read AGENTS.md for hard rules (no raw SQL in routes, Zod at API boundaries, theme tokens, etc.).
3. Check `git status` — there is a large uncommitted working tree on main from the prior session; do NOT assume everything is committed or pushed.
4. Dev: `npm run dev` from pointer-ton root, port 3001. Primary QA: http://127.0.0.1:3001/pulse

The prior session shipped UX fixes across Pulse quick-buy, search modal, token rows, bottom bar, wallet toasts, topbar nav reorder, deposit icons, and stock detail → perps layout. See HANDOFF.md sections "Session 2026-05-30" and "Uncommitted work" for exact files and bugs fixed.

Do not revert working buy/sell, auth, or demo gating. Minimize diff scope. Use Pointer theme tokens, not hardcoded Axiom clone colors. Only commit when the user explicitly asks.
```

---

## What is Pointer? (read this so you're not lost)

**Pointer** is a **dark-themed crypto trading terminal** — Axiom/Photon-*inspired* UX with Pointer's own design system and **AI Co-pilot**. Tagline: *"Where the sharpest traders are."*

| Surface | Route | What it is |
|---------|-------|------------|
| **Pulse** | `/pulse` | Live token board — **New / Stretch / Migrated** columns, quick-buy, presets, stocks board (`StocksPulseBoard`), X Monitor, Squads rail. **Primary QA surface.** |
| **Token detail** | `/token/[mint]` | Sol/TON token page — chart, buy/sell, activity tabs, AI. |
| **Stock perp detail** | `/stock/[symbol]` | Synthetic equity perps (OPENAI, TSLA, etc.) — **now uses same terminal shell as `/perps`**, not Pulse token desk. |
| **Perps** | `/perps` | Hyperliquid-style perps terminal — chart, L2 book, trade panel, positions tabs. **Reference layout for stock detail.** |
| **Explore** | `/explore` | Discovery — table + Mindshare bubbles. |
| **Track** | `/track` | Wallet tracking. |
| **Squads** | `/squads/*` + Pulse rail | Squad chat panel (float/dock). |
| **Portfolio** | `/portfolio` | Holdings / PnL. |
| **Points** | `/points` | Campaign UI. |

**Stack:** Next.js 16 App Router, React 19, TS strict, Tailwind, Zustand, TanStack Query, Supabase, Helius, Jupiter, Privy-style auth.

**Local path:** `C:\Users\moust\Downloads\pointer-ton` · **Port:** 3001 · **Branch:** `main` (at time of handoff)

---

## Session 2026-05-30 — What we shipped (this chat)

### 1. Pulse quick-buy queue (FIFO)

**Problem:** Quick-buy blocked the whole row with spinners; user wanted spam-click queue like Axiom.

**Fix:**
- `lib/hooks/usePulseQuickBuy.ts` — FIFO queue: `buyToken` / `sellTokenPct` enqueue instantly, drain serially. No global `busyMint` blocking other rows.
- `components/tokens/TokenRow.tsx` — buy buttons stay clickable (`loading={false}`); spinner centered via `absolute inset-0 flex` wrapper so `animate-spin` doesn't override translate.

### 2. Wallet-tracker toasts not showing

**Root cause:** `app/globals.css` hid all `[data-title]` inside wallet-tracker toaster; Sonner puts custom toast JSX inside `[data-title]`.

**Fix:**
- Only hide chrome on `[data-styled='true']` toasts.
- `lib/walletTracker/walletTrackerToast.tsx` — demo toasts bypass mute store.

### 3. Bottom bar regions glitched

**Fix:** `components/layout/BottomBar.tsx`, `bottomBar/BottomBarStatusRail.tsx`, `bottomBar/BottomBarRegionMenu.tsx`
- `justify-between` + `ml-auto` right cluster, fixed height, `z-[100]`, `overflow-visible`.
- Region menu portals to `document.body` with fixed positioning.
- Theme tokens: `border-border-subtle`, `bg-bg-hover`, `text-signal-bull` (not hardcoded hex whites/greens).

### 4. Global search modal

**Width & rows:**
- `GlobalSearchModal.tsx` — `max-w` **640px → 1080px**, taller rows, more padding.
- `SearchTokenRow.tsx` — identity `flex-1`, fixed-width MC/V/L columns, horizontal buy pill on right.

**Filter chips (Axiom-style):**
- New: `components/layout/SearchProtocolFilterChip.tsx`
- `lib/ui/searchModalChrome.ts` — `searchModalFilterChipIdleClass` / `ActiveClass`
- Chips: **Pump, Bonk, Bags** (replaced Printr), OG Mode (Flame), Graduated, Dex Paid (Shield)
- Real protocol logos at ~18px via `ProtocolBrandIcon`; meta icons grey-filled in bordered circles.

### 5. Token row — clickability + MC/V + button sizes

**Critical bugs fixed in `components/tokens/TokenRow.tsx`:**

| Bug | Cause | Fix |
|-----|-------|-----|
| V/MC area not clickable to open token | `ultraChrome` was true for *all* Pulse rows (`slotHeight != null`), rendering full-height Ultra dock with `pointer-events-auto` on entire right column | Split concepts: `ultraChrome = buyButtonStyle === 'ultra'` only; `pulseRow = slotHeight != null`; `useActionDock = hasRightActions && (pulseRow \|\| ultraChrome)` |
| V/MC disappeared on normal (small/medium/large) preset | Action dock branch gated on `ultraChrome` only — normal preset skipped dock (where V/MC live) but still reserved padding and hid inline V/MC | Outer dock condition changed to `useActionDock` (was wrongly still `ultraChrome &&` at one point — **must be `useActionDock`**) |
| Small/medium/large all looked identical | `QuickBuyPill` ignored `style` prop, uniform `h-5` | `quickBuyPillSizeClasses()` — small `h-6` tint, medium `h-8` semi-fill, large `h-11` solid green bar full dock width |

**Pointer-events:** Dock wrapper `pointer-events-none`; only buttons `pointer-events-auto` (Ultra zones too).

**Helpers at bottom of TokenRow.tsx:** `pulseDockWidthClass`, `pulseDockReservePadding`, `quickBuyPillSizeClasses`.

### 6. Topbar nav reorder (Display settings)

Like dock tracker reorder in `DockTrackersSettingsModal.tsx`:

- `store/topbarNav.ts` — persisted order (`pointer.topbar-nav.v1`), `moveItem`, `resetOrder`
- `lib/layout/topbarNav.ts` — `normalizeTopbarNavOrder`, `resolveTopbarNav`
- `components/preferences/TopbarNavReorderRow.tsx` — drag chips in **Display** popover + Settings → Display
- `components/layout/Topbar.tsx` — renders `navItems` from store, not static `APP_NAV` order

Default order: Pulse → Perps → Packs → Portfolio → Track → Squads → Championship → $PTR (`components/layout/navConfig.ts`).

### 7. Deposit modal — PYUSD logo

**Problem:** `public/logos/protocols/pyusd.png` was a wrong placeholder (generic blue “P”, not PayPal USD).

**Fix:** Replaced with official PayPal PYUSD brand asset. PYUSD is real (PayPal USD stablecoin by Paxos). `lib/wallet/depositAssetIcons.ts` + `ExchangeModal.tsx` Accepting chips slightly larger (`h-4`).

### 8. Stock detail → Perps terminal layout

**Problem:** `/stock/[symbol]` still used Pulse token UI (`TokenActivityTabs`, `TokenTradeDeskStrip`, token-style `StockHeader` with MC/liquidity/Pulse alerts).

**Fix — stock pages are perp contracts, same shell as `/perps`:**

| New / updated | Role |
|---------------|------|
| `components/stocks/StockTerminal.tsx` | Main layout: header + 3-col grid + bottom panel + resize split |
| `components/stocks/StockMarketHeader.tsx` | Mark, Oracle, 24h, Funding, OI, Volume, Max lev (not MC/liquidity) |
| `components/stocks/StockOrderPanel.tsx` | Mirrors `PerpsOrderPanel` — Long/Short, Market/Limit, leverage, limit price, TP/SL expand, margin footer |
| `lib/stocks/stockPerpUi.ts` | `stockOrderbookToL2`, funding helpers, `STOCK_MAX_LEVERAGE = 20` |
| `components/stocks/StockDetailView.tsx` | Thin wrapper → `StockTerminal` |
| `app/(app)/stock/[symbol]/page.tsx` | Full-height layout like perps page; removed `StockHeader` |

Reuses: `PerpsOrderBook`, `PerpsBottomPanel` (Positions / Open orders / Trades).

**Stocks list** still on Pulse via `StocksPulseBoard` → click row → `/stock/SYMBOL`.

**Legacy file (unused on stock page now):** `components/stocks/StockHeader.tsx` — token-style header; do not wire back without user ask.

---

## Uncommitted work (git status snapshot 2026-05-30)

**Nothing from this session was committed** unless the user committed separately after handoff. Expect a large dirty tree on `main`.

### New files (untracked `??`)

```
components/layout/SearchProtocolFilterChip.tsx
components/preferences/TopbarNavReorderRow.tsx
components/stocks/StockMarketHeader.tsx
components/stocks/StockTerminal.tsx
lib/layout/topbarNav.ts
lib/stocks/stockPerpUi.ts
store/topbarNav.ts
app/(app)/portfolio/PortfolioPageClient.tsx
lib/share/pnlShareLayout.ts
lib/share/shareCardTheme.ts
public/branding/pnl-share-card-purple.png
public/branding/pnl-share-reference.png
```

### Modified (high-signal `M`)

```
components/tokens/TokenRow.tsx          ← Pulse row dock / click / button sizes
components/layout/GlobalSearchModal.tsx
components/layout/SearchTokenRow.tsx
lib/ui/searchModalChrome.ts
lib/hooks/usePulseQuickBuy.ts
components/layout/BottomBar.tsx + bottomBar/*
app/globals.css
lib/walletTracker/walletTrackerToast.tsx
components/layout/Topbar.tsx
components/preferences/DisplayPopover.tsx
components/preferences/DisplayPreferences.tsx
components/stocks/StockDetailView.tsx
components/stocks/StockOrderPanel.tsx
app/(app)/stock/[symbol]/page.tsx
components/wallet/ExchangeModal.tsx
lib/wallet/depositAssetIcons.ts
public/logos/protocols/pyusd.png
```

### Other modified areas (earlier in same session / parallel)

Portfolio client split, PnL share composer/cards, Explore table/bubble, RoutePrefetcher, auth sync, pulse feed cache, MintTradesTable, ColumnFilterModal, WalletBalancePopover, etc. — see full `git status` and `git diff`.

---

## Key files map (quick reference)

| Area | Files |
|------|--------|
| Pulse quick-buy queue | `lib/hooks/usePulseQuickBuy.ts`, `components/tokens/PulseColumn.tsx` |
| Token row layout | `components/tokens/TokenRow.tsx` |
| Search modal | `GlobalSearchModal.tsx`, `SearchTokenRow.tsx`, `SearchProtocolFilterChip.tsx`, `searchModalChrome.ts` |
| Bottom bar | `BottomBar.tsx`, `bottomBar/*` |
| Wallet toasts | `app/globals.css`, `walletTrackerToast.tsx` |
| Topbar nav order | `store/topbarNav.ts`, `lib/layout/topbarNav.ts`, `TopbarNavReorderRow.tsx`, `Topbar.tsx`, `navConfig.ts` |
| Dock reorder (reference) | `store/dockTrackers.ts`, `DockTrackersSettingsModal.tsx` |
| Perps terminal (reference) | `PerpsTerminal.tsx`, `PerpsOrderPanel.tsx`, `PerpsBottomPanel.tsx`, `PerpsMarketHeader.tsx` |
| Stock perp terminal | `StockTerminal.tsx`, `StockMarketHeader.tsx`, `StockOrderPanel.tsx`, `stockPerpUi.ts` |
| Deposit icons | `depositAssetIcons.ts`, `ExchangeModal.tsx` |
| Stocks on Pulse | `StocksPulseBoard.tsx`, `StockRow.tsx`, `StocksPulseColumn.tsx` |

---

## Architecture notes agents must not break

1. **No raw SQL in API routes** — use `lib/db/*.ts`
2. **No direct LLM calls in features** — use `lib/ai/cascade.ts`
3. **Zod at API boundaries**
4. **Theme tokens** in `tailwind.config.ts` + `globals.css` — no ad-hoc `#5865F2` / random greens unless matching existing pattern
5. **`ultraChrome` vs `pulseRow` vs `useActionDock`** in TokenRow — do not conflate; regression causes missing V/MC and dead click zones
6. **Phase 2 TODOs** stay behind abstractions (`getFeeBpsForUser`, etc.)
7. **dex-trader** is a different project — don't edit unless user names it
8. **Commits / push** only when user explicitly asks

---

## Known issues / follow-ups

| Item | Status |
|------|--------|
| Large uncommitted diff on `main` | User may want commit + push in new chat |
| `user_tiers` DB error in screenshots | Migration/schema issue — unrelated to UI work; run `scripts/reload-postgrest-schema.sql` after DDL |
| PerpsBottomPanel column headers | Simplified vs Axiom reference (Positions vs Trades columns differ in reference imgs) — perps page deemed OK; could align later |
| Stock order execution | `StockOrderPanel` → TODO Phase 2 HIP-3 / TradeXYZ signing |
| `StockHeader.tsx` | Orphaned token-style header — stock page uses `StockMarketHeader` |
| Mobile search row MC/V/L | `SearchTokenRow` stats may be `hidden sm:flex` — optional follow-up |
| Hydration `ontouchstart` on body | Often extension/Cursor browser — optional `suppressHydrationWarning` |

---

## How to verify quickly (QA checklist)

1. `npm run dev` → http://127.0.0.1:3001/pulse
2. **Quick-buy** — spam-click buy on Pulse row; queue drains FIFO; no row-wide spinner lock
3. **Token row click** — on **medium/large** preset (not Ultra), click V/MC area above buy button → opens token page
4. **Button sizes** — column display preset small vs medium vs large → visibly different buy pills
5. **Search** — open global search → filter chips sized with real logos; Bags not Printr
6. **Display** → drag reorder topbar nav links → order persists refresh
7. **Deposit modal** → Accepting → PYUSD shows PayPal-style logo
8. **Stock** — Pulse stocks column → click OPENAI/TSLA → perps-style terminal (chart | book | trade | positions tabs), no holders/top traders tabs
9. **Bottom bar** — Stable/US-E cluster aligned; region menu works
10. **Wallet tracker** — demo toasts visible

---

## Prior session work (still relevant)

### Squads — chat-first UI + float/dock

- `SquadsAsidePanel.tsx`, `SquadSwitcherStrip.tsx`, `squadsChatUi.ts`, `DockSquadsFloatingPanel.tsx`, `tokenDockPeek.ts`

### Pulse — filters & visuals

- `columnPresetModel.ts` — full protocol preset filter fix
- `PulseTokenAvatar.tsx` — migrated gold ring fix

### Performance (partial)

- `protocolPreload.ts`, `DeferredAppShellHosts.tsx`, `RoutePrefetcher.tsx`, dynamic Topbar modals, parallel token page fetches, pulse `staleTime`, portfolio route lightening

### Explore mindshare hover

- `ExploreTokenBubble.tsx` tooltip layout fix

---

## User preferences (carry forward)

- Blunt feedback expected — fix root cause, minimal diff
- Axiom-*inspired* layout OK; not a violet/emerald clone theme
- Don't scope-creep Phase 2 features without `// TODO Phase 2`
- Real shell access — run commands, don't give up after one failure
- **Do not commit** unless explicitly asked

---

## Recent commits (may be behind working tree)

```
3ec5080 Add HANDOFF.md for agent session continuity across chats.
3fdb761 Squads chat UX, Pulse filters, perf, and Explore hover polish.
```

Everything in **Session 2026-05-30** above is likely **not** in these commits.

---

## Suggested next work (if user asks)

- Commit + push session changes with a clean message after user review
- PerpsBottomPanel tab-specific column headers (match Axiom reference)
- TP/SL + limit price parity on main `PerpsOrderPanel` (stock panel has them; perps may not)
- Theme-token pass on remaining `searchModalChrome.ts` hardcoded `white/[0.xx]`
- Mobile search row stats full width
- Real stock/perp order signing (Phase 2)
