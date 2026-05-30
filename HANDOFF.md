# Pointer TON — Agent Handoff

> Last updated: 2026-05-30 · Commit: `3fdb761` on `main`

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

You are continuing work on **Pointer TON** — a dark-themed crypto terminal (Pulse, Explore, Squads, Track, etc.). The prior session shipped a large squads/perf/filter polish pass. **Read this file fully before changing code.**

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
