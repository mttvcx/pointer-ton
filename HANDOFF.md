# Pointer TON — Agent Handoff

> Last updated: 2026-05-30 · Commit: `3ec5080` on `main`

---

## What is Pointer? (read this so you're not lost)

**Pointer** is a **dark-themed crypto trading terminal** — think Axiom/Photon-style UX, but with Pointer's own design system and a built-in **AI Co-pilot**. Tagline: *"Where the sharpest traders are."*

This repo (`pointer-ton`) is the **main web app**. It's internal alpha / active development — not a toy demo, but not production-polished everywhere either.

### What the app does (user-facing)

| Surface | Route | What it is |
|---------|-------|------------|
| **Pulse** | `/pulse` | Live token board — 3 columns: **New**, **Stretch** (near migrate), **Migrated**. Streaming mints from launchpads, quick-buy on rows, column presets/filters, X Monitor rail, **Squads** side panel. **Primary QA surface.** |
| **Explore** | `/explore` | Token discovery — table + **Mindshare** bubble canvas (force layout, hover cards, AI overview on click). |
| **Token detail** | `/token/[mint]` | Chart, buy/sell panel, socials, holder/dev stats, AI explain. |
| **Track** | `/track` | Wallet tracking OS — lists, alerts, cross-check with Pulse. |
| **Squads** | `/squads/*` | Squad discovery, inbox, rooms, reputation — plus **Squads chat panel** docked/floating on Pulse (not a separate app). |
| **Portfolio** | `/portfolio` | Holdings / PnL view. |
| **Perps** | `/perps` | Perps desk (Hyperliquid-oriented). |
| **Co-pilot** | Topbar / dock | AI panel — token explain, quick ask, scan cache. |
| **Points** | `/points` | Campaign / points UI. |

### Multi-chain header

The **top bar chain switcher** (SOL / TON / BNB / Base) drives which launchpads, filters, and demo data show. Default chain in UI store may vary; Pulse protocol preset filters are **per active chain**. Backend ingest is strongest on **Solana** (Helius webhooks → NEW/STRETCH/MIGRATED columns).

### Trading & auth

- **Auth:** Pointer auth (Privy-style embedded wallets) — `usePointerAuth()`, `getAccessToken()`
- **Trading:** Jupiter swaps on Sol, quick-buy from Pulse rows, buy/sell panel on token pages
- **Fees / tiers:** Platform fee bps, AI daily quota — see `lib/db/tiers.ts`, `lib/utils/constants.ts`
- **Do not break:** working buy/sell flows, auth gates, demo mode gating (`useUiDemoMode`)

### AI

- Cascade: Gemini Flash → Claude Haiku → Claude Sonnet (`lib/ai/cascade.ts`)
- Used in Co-pilot, Explore hover → drawer overview, token explain, alert narratives
- Redis/Upstash scan cache with MC-drift invalidation

### Design language

- **Pointer theme tokens** in Tailwind: `bg-base`, `bg-raised`, `bg-hover`, `fg-primary`, `accent-primary`, `signal-bull/bear`, etc. — defined in `globals.css` + theme provider
- User explicitly **does not want** hardcoded Axiom clone colors (violet/emerald everywhere)
- Pulse rows: Axiom-*inspired* layout (MC hero, quick-buy chip, protocol avatar rings) but Pointer chrome
- Bottom bar dock: Wallet, Pulse, PnL, Alpha, Squads, Social — reorderable like trackers settings
- Floating panels: X Monitor, Squads, Pulse popup — edge-dock, drag, resize (see `tokenDockPeek` store)

### Stack (quick ref)

Next.js App Router · React 19 · TS strict · Tailwind · Zustand · TanStack Query · Supabase · Upstash Redis · Helius · Jupiter · Anthropic/Gemini AI

Full stack + setup: **`README.md`** in repo root. Canonical structure notes: `PHASE-1-PROMPT.md` if present.

### Who you're helping

Solo builder (`mttvcx`) iterating fast on UX parity with top Sol terminals while keeping Pointer identity. Expect blunt feedback ("doesn't look like chat", "filter doesn't work") — fix root cause, minimal diff.

---

## Repo & dev

| Item | Value |
|------|--------|
| GitHub | https://github.com/mttvcx/pointer-ton |
| Branch | `main` |
| Local path | `C:\Users\moust\Downloads\pointer-ton` |
| Dev server | `npm run dev` (Turbopack, port **3001**) |
| Primary QA URL | http://127.0.0.1:3001/pulse |
| Remote | `origin` → `https://github.com/mttvcx/pointer-ton.git` |

## Read this first

You are continuing work on **Pointer** (this repo). **Read this entire file + skim `README.md` before changing code.** The sections above explain *what the product is*; below is *what we just shipped* and *where things live*.

### Do NOT

- Commit `.env.local` or secrets
- Revert working buy/sell, auth, or demo gating
- Force-push `main`
- Commit unless the user explicitly asks
- Over-engineer or expand scope beyond what the user requests

### User preferences

- Pointer theme tokens (`accent-primary`, `bg-*`, `fg-*`) — not hardcoded Axiom violet/emerald clones
- Minimize diff scope; match existing conventions
- Squads panel header title is **"Squads"** (squad name lives in pill strip below)
- Bottom-right protocol badge on avatars was user-approved — keep it

---

## What was completed (recent session)

### Squads — chat-first UI + float/dock

- **`components/squads/SquadsAsidePanel.tsx`** — Chat-first layout: header "Squads", squad pill strip, optional alert/activity inline system lines, rounded composer, full-header drag
- **`components/squads/SquadSwitcherStrip.tsx`** — Scrollable squad pills with chevron arrows; bell/activity toggles on right
- **`store/squadsChatUi.ts`** — Persisted squad order, `showAlertsFeed`, `showActivityFeed`, `moveSquad`
- **`components/squads/SquadsLobbySettingsModal.tsx`** — Drag-reorder squad tabs (like dock tracker order)
- **`components/layout/DockSquadsFloatingPanel.tsx`** — Float/dock squads like X Monitor (edge snap, resize, embed on Pulse)
- **`lib/squads/openSquadsFloat.ts`** — `detachSquadsToFloat()`, `embedSquadsOnPulse()`
- **`store/tokenDockPeek.ts`** — `squadsPeekOpen`, dock snap/size state (persist v4)
- Lobby modals: profile (hover camera), friends, emoji picker, settings toggles

### Pulse — filters & visuals

- **`lib/tokens/columnPresetModel.ts`** — Fixed Sol protocol preset filter: was only detecting 4 launchpads; now uses full `launchPadToProtocolId` + metadata hints. Unknown-protocol tokens excluded when filter narrowed.
- **`store/pulseColumns.ts`** + **`ColumnFilterModal.tsx`** — Local filter apply for guests (no sign-in required); "Apply All" works locally
- **`components/tokens/PulseTokenAvatar.tsx`** — Fixed migrated gold double-border glitch (single stroke when ring complete)

### Performance

- **`lib/tokens/protocolPreload.ts`** — Stopped preloading ~2MB protocol PNG decks early
- **`components/layout/DeferredAppShellHosts.tsx`** — Float panels / heavy shell mount after idle
- **`app/(app)/layout.tsx`** — Slimmer sync imports
- **`app/layout.tsx`** — Preload critical chain logos + pointer bird only
- **`components/tokens/ProtocolBrandIcon.tsx`** — `loading="lazy"`

### Explore — mindshare hover

- **`components/explore/ExploreTokenBubble.tsx`** — Tooltip redesigned: stacked layout, 2-col button grid, better viewport positioning (no clipped "Buy" / "Full page" buttons)

### Layout / chrome

- **`components/layout/Topbar.tsx`** — Grid centering for co-pilot cluster (no absolute offset hack)
- **`components/layout/MarketLighthouseHover.tsx`** — Refactored
- X Monitor / Squads open helpers wired to Pulse rails

---

## Known issues / not done

| Issue | Notes |
|-------|--------|
| Hydration warning `ontouchstart` on `<body>` | Usually browser extension / Cursor embedded browser — not perf root cause. Optional fix: `suppressHydrationWarning` on `<body>` |
| App still feels slow sometimes | Heavy assets + dev HMR; stale dev processes were a past culprit. Kill port 3001 PIDs and restart Turbopack if wedged |
| Squads chat | Demo/local messages only — no real backend wire yet |
| Column filter keywords | UI fields in modal are UI-only until backend supports |
| `HANDOFF.md` | This file — update when shipping significant work |

---

## Key files map

| Area | Files |
|------|--------|
| Squads panel | `SquadsAsidePanel.tsx`, `SquadSwitcherStrip.tsx`, `PulseSquadsAside.tsx` |
| Squads float | `DockSquadsFloatingPanel.tsx`, `openSquadsFloat.ts`, `tokenDockPeek.ts` |
| Squads store | `squadsChatUi.ts`, `pulseSquadsRail.ts` |
| Pulse columns | `PulseColumn.tsx`, `PulsePageLayout.tsx`, `TokenRow.tsx` |
| Protocol filters | `columnPresetModel.ts`, `ColumnFilterModal.tsx`, `pulseProtocolRegistry.ts` |
| Avatar rings | `PulseTokenAvatar.tsx`, `launchpadAvatarChrome.ts` |
| Explore mindshare | `ExploreMindshareCanvas.tsx`, `ExploreTokenBubble.tsx` |
| Perf preload | `protocolPreload.ts`, `DeferredAppShellHosts.tsx`, `ProtocolLogoPreloader.tsx` |
| Dock reorder ref | `store/dockTrackers.ts`, `DockTrackersSettingsModal.tsx` |
| Topbar | `Topbar.tsx`, `CopilotTopbarSlot.tsx` |

---

## Demo / auth notes

- Demo mode merges showcase bundles into Pulse feed (`lib/dev/demoPulseBundles.ts`)
- Communities API works: `/api/communities/{mint}` — tested OK on port 3001
- Column presets require auth to **sync** to server; guests use **local** filters in `pulseColumns` store

---

## Recent commits

```
3ec5080 Add HANDOFF.md for agent session continuity across chats.
3fdb761 Squads chat UX, Pulse filters, perf, and Explore hover polish.
f239f68 Fix persist rehydration crashes, bump base UI scale, and speed up Pulse avatars.
449640b Checkpoint before perf and stability fixes: communities, squads rail, avatar outlines, auth.
```

---

## Suggested next work (if user asks)

- Further squads polish (real chat backend, member counts in header)
- More perf profiling if still slow (React profiler, bundle size)
- Fix hydration noise if annoying
- Any user-reported Pulse/Explore/Squads bugs from QA

---

## How to verify quickly

1. `npm run dev` → open http://127.0.0.1:3001/pulse
2. **Squads** — open rail, switch squads, send message, drag header to float, settings → reorder squads
3. **Pulse filters** — Filters → Protocols → select only Pump → Apply All → only pump rows
4. **Migrated column** — gold avatar rings should be single clean stroke, not double
5. **Explore → Mindshare** — hover bubble → tooltip buttons fully visible
